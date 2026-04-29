'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button,
  Breadcrumbs,
  Link,
  CircularProgress,
  Alert
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Home as HomeIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  runTransaction,
  query,
  where,
  limit,
  addDoc,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import SimplifiedEnquiryForm from '@/components/enquiries/SimplifiedEnquiryForm';
import { resolveEnquirySaleInvoiceNumber } from '@/lib/sales-invoicing/enquiryInvoiceNumber';
import { assignReceiptNumbersToVisits } from '@/lib/sales-invoicing/enquiryReceiptNumber';
import { enquiryVisitSaleDateToTimestamp } from '@/lib/sales-invoicing/enquiryVisitSaleTimestamp';
import { notifyAdminsNewSale } from '@/lib/notifications/notifyNewSaleClient';
import { logActivity, computeChanges } from '@/lib/activityLogger';

interface EditEnquiryPageProps {
  params: Promise<{ id: string }>;
}

export default function EditEnquiryPage({ params }: EditEnquiryPageProps) {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [enquiry, setEnquiry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);

  const normalizeEnquiryPhone = (value: unknown) =>
    String(value || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 10);

  const assertUniquePhoneForEdit = async (rawPhone: unknown, enquiryId: string) => {
    const phone = normalizeEnquiryPhone(rawPhone);
    if (phone.length !== 10) {
      throw new Error('Contact phone must be exactly 10 letters or digits');
    }
    const dupSnap = await getDocs(
      query(collection(db, 'enquiries'), where('phone', '==', phone), limit(5)),
    );
    const hasOther = dupSnap.docs.some((d) => d.id !== enquiryId);
    if (hasOther) {
      throw new Error('Another enquiry with this phone number already exists');
    }
    return phone;
  };

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params;
      setResolvedParams(resolved);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!resolvedParams) return;
    
    const fetchEnquiry = async () => {
      try {
        setLoading(true);
        const enquiryDoc = await getDoc(doc(db, 'enquiries', resolvedParams.id));
        
        if (enquiryDoc.exists()) {
          setEnquiry({
            id: enquiryDoc.id,
            ...enquiryDoc.data()
          });
        } else {
          setError('Enquiry not found');
        }
      } catch (err) {
        console.error('Error fetching enquiry:', err);
        setError('Failed to load enquiry details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEnquiry();
  }, [resolvedParams]);

  // Helper function to find new sales (products that didn't exist before)
  const findNewSales = (oldVisits: any[], newVisits: any[]) => {
    const newSales: any[] = [];
    
    newVisits.forEach((newVisit, visitIndex) => {
      if (newVisit.hearingAidSale && newVisit.products && newVisit.products.length > 0) {
        const oldVisit = oldVisits[visitIndex];
        const oldProducts = oldVisit?.products || [];
        
        newVisit.products.forEach((newProduct: any) => {
          // Check if this product existed in the old version
          const existedBefore = oldProducts.some((oldProduct: any) => 
            oldProduct.serialNumber === newProduct.serialNumber && 
            oldProduct.productId === newProduct.productId
          );
          
          if (!existedBefore) {
            newSales.push(newProduct);
          }
        });
      }
    });
    
    return newSales;
  };

  // Helper function to reduce inventory for new sales only
  const reduceInventoryForNewSales = async (newSalesProducts: any[]) => {
    const inventoryUpdates: any[] = [];
    
    newSalesProducts.forEach((product: any) => {
      if (product.serialNumber) {
        // For serial-tracked items, find and remove the specific serial number
        inventoryUpdates.push({
          type: 'serial',
          productId: product.productId,
          serialNumber: product.serialNumber,
          quantity: 1
        });
      } else if (product.quantity > 0) {
        // For quantity-tracked items, reduce the quantity
        inventoryUpdates.push({
          type: 'quantity',
          productId: product.productId,
          quantity: product.quantity
        });
      }
    });
    
    // Process inventory updates
    for (const update of inventoryUpdates) {
      try {
        if (update.type === 'serial') {
          // Remove serial number from materialInward collection
          await runTransaction(db, async (transaction) => {
            const materialInQuery = collection(db, 'materialInward');
            const materialsSnapshot = await getDocs(materialInQuery);
            
            for (const materialDoc of materialsSnapshot.docs) {
              const materialData = materialDoc.data();
              let updated = false;
              
              materialData.products = materialData.products.map((prod: any) => {
                if (prod.productId === update.productId && prod.serialNumbers?.includes(update.serialNumber)) {
                  prod.serialNumbers = prod.serialNumbers.filter((sn: string) => sn !== update.serialNumber);
                  updated = true;
                }
                return prod;
              });
              
              if (updated) {
                transaction.update(doc(db, 'materialInward', materialDoc.id), {
                  products: materialData.products,
                  updatedAt: serverTimestamp()
                });
                break;
              }
            }
          });
        } else if (update.type === 'quantity') {
          // Reduce quantity in materialInward collection
          await runTransaction(db, async (transaction) => {
            const materialInQuery = collection(db, 'materialInward');
            const materialsSnapshot = await getDocs(materialInQuery);
            
            let remainingToReduce = update.quantity;
            
            for (const materialDoc of materialsSnapshot.docs) {
              if (remainingToReduce <= 0) break;
              
              const materialData = materialDoc.data();
              let updated = false;
              
              materialData.products = materialData.products.map((prod: any) => {
                if (prod.productId === update.productId && prod.quantity > 0 && remainingToReduce > 0) {
                  const reduction = Math.min(prod.quantity, remainingToReduce);
                  prod.quantity -= reduction;
                  remainingToReduce -= reduction;
                  updated = true;
                }
                return prod;
              });
              
              if (updated) {
                transaction.update(doc(db, 'materialInward', materialDoc.id), {
                  products: materialData.products,
                  updatedAt: serverTimestamp()
                });
              }
            }
          });
        }
      } catch (error) {
        console.error('Error updating inventory for new sale:', update, error);
      }
    }
  };

  const handleSubmit = async (data: any) => {
    if (saving) return;
    try {
      setSaving(true);
      
      if (!resolvedParams?.id) return;
      const actor = {
        uid: user?.uid || null,
        name: userProfile?.displayName || user?.displayName || userProfile?.email || user?.email || 'Unknown user',
        email: userProfile?.email || user?.email || null,
        role: userProfile?.role || null,
      };
      const phone = await assertUniquePhoneForEdit(data?.phone, resolvedParams.id);

      // Find new sales that need inventory reduction
      const oldVisits = enquiry?.visits || [];
      const newSalesProducts = findNewSales(oldVisits, data.visits || []);
      
      const visits = Array.isArray(data.visits)
        ? data.visits.map((visit: Record<string, unknown>) => ({
            ...visit,
            createdByUid: visit.createdByUid ?? actor.uid,
            createdByName: visit.createdByName ?? actor.name,
            createdByEmail: visit.createdByEmail ?? actor.email,
            createdByRole: visit.createdByRole ?? actor.role,
            updatedByUid: actor.uid,
            updatedByName: actor.name,
            updatedByEmail: actor.email,
            updatedByRole: actor.role,
          }))
        : [];
      const visitSchedules = Array.isArray(data.visitSchedules)
        ? data.visitSchedules.map((visit: Record<string, unknown>) => ({
            ...visit,
            createdByUid: visit.createdByUid ?? actor.uid,
            createdByName: visit.createdByName ?? actor.name,
            createdByEmail: visit.createdByEmail ?? actor.email,
            createdByRole: visit.createdByRole ?? actor.role,
            updatedByUid: actor.uid,
            updatedByName: actor.name,
            updatedByEmail: actor.email,
            updatedByRole: actor.role,
          }))
        : [];
      const paymentRecords = Array.isArray(data.paymentRecords)
        ? data.paymentRecords.map((payment: Record<string, unknown>) => ({
            ...payment,
            createdByUid: payment.createdByUid ?? actor.uid,
            createdByName: payment.createdByName ?? actor.name,
            createdByEmail: payment.createdByEmail ?? actor.email,
            createdByRole: payment.createdByRole ?? actor.role,
            updatedByUid: actor.uid,
            updatedByName: actor.name,
            updatedByEmail: actor.email,
            updatedByRole: actor.role,
          }))
        : [];
      const payments = Array.isArray(data.payments)
        ? data.payments.map((payment: Record<string, unknown>) => ({
            ...payment,
            createdByUid: payment.createdByUid ?? actor.uid,
            createdByName: payment.createdByName ?? actor.name,
            createdByEmail: payment.createdByEmail ?? actor.email,
            createdByRole: payment.createdByRole ?? actor.role,
            updatedByUid: actor.uid,
            updatedByName: actor.name,
            updatedByEmail: actor.email,
            updatedByRole: actor.role,
          }))
        : [];

      // Allocate strict BR-NNNNNN / TR-NNNNNN numbers for any new bookings or home trials
      // that don't already carry one (skips in-office trials). Mutates the local `visits` /
      // `visitSchedules` arrays so the downstream sale-mirror loop and final updateDoc both
      // persist the freshly assigned numbers.
      {
        const receiptResult = await assignReceiptNumbersToVisits(db, visits, visitSchedules);
        if (receiptResult.changed) {
          visits.length = 0;
          visits.push(...receiptResult.visits);
          visitSchedules.length = 0;
          visitSchedules.push(...receiptResult.visitSchedules);
        }
      }

      // Upsert sale visits into `sales` collection and ensure invoice numbers.
      for (let visitIndex = 0; visitIndex < visits.length; visitIndex++) {
        const visit = visits[visitIndex] || {};
        const products = Array.isArray(visit.products) ? visit.products : [];
        // Only treat as invoicable "sale" when the visit is explicitly marked as a sale.
        // This prevents "booking-only" visits (which can still carry amounts/products) from
        // being mirrored into `sales` and getting invoice numbers.
        const isSale = Boolean(
          visit?.hearingAidSale ||
            visit?.purchaseFromTrial ||
            visit?.hearingAidStatus === 'sold'
        );
        if (!isSale || !resolvedParams?.id) continue;

        const saleDateRaw = visit.purchaseDate || visit.visitDate;
        const saleDate = enquiryVisitSaleDateToTimestamp(saleDateRaw);
        const grossSalesBeforeTax = Number(visit.grossSalesBeforeTax) || 0;
        const gstAmount = Number(visit.taxAmount) || 0;
        const grandTotal = Number(visit.salesAfterTax) || grossSalesBeforeTax + gstAmount;

        const existing = await getDocs(
          query(
            collection(db, 'sales'),
            where('enquiryId', '==', resolvedParams.id),
            where('enquiryVisitIndex', '==', visitIndex),
            limit(1)
          )
        );
        const existingSaleDoc = existing.empty ? null : existing.docs[0];
        const existingVisitInvoice = String(visit.invoiceNumber || '').trim();
        const invoiceNumber = await resolveEnquirySaleInvoiceNumber({
          db,
          existingVisitInvoice,
          existingSalesInvoice: existingSaleDoc?.data()?.invoiceNumber,
          priorVisitInvoice: oldVisits?.[visitIndex]?.invoiceNumber,
          currentSaleId: existingSaleDoc?.id,
        });
        if (invoiceNumber !== existingVisitInvoice) {
          visits[visitIndex] = { ...visit, invoiceNumber };
        }

        const payload = {
          invoiceNumber,
          patientName: data.name || 'Patient',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          customerGstNumber: data.customerGstNumber || '',
          products,
          accessories: [],
          manualLineItems: [],
          referenceDoctor: { name: '' },
          salesperson: { id: '', name: '' },
          totalAmount: grossSalesBeforeTax,
          gstAmount,
          gstPercentage: 0,
          grandTotal,
          netProfit: 0,
          branch: '',
          centerId: visit.centerId || data.visitingCenter || data.center || '',
          paymentMethod: 'cash',
          paymentStatus: 'pending',
          notes: visit.visitNotes || '',
          saleDate,
          source: 'enquiry',
          enquiryId: resolvedParams.id,
          enquiryVisitIndex: visitIndex,
          createdByUid: existingSaleDoc?.data()?.createdByUid ?? actor.uid,
          createdByName: existingSaleDoc?.data()?.createdByName ?? actor.name,
          createdByEmail: existingSaleDoc?.data()?.createdByEmail ?? actor.email,
          createdByRole: existingSaleDoc?.data()?.createdByRole ?? actor.role,
          updatedByUid: actor.uid,
          updatedByName: actor.name,
          updatedByEmail: actor.email,
          updatedByRole: actor.role,
          updatedAt: serverTimestamp(),
        } as Record<string, unknown> as any;

        if (existingSaleDoc == null) {
          const saleRef = await addDoc(collection(db, 'sales'), {
            ...payload,
            createdAt: serverTimestamp(),
          });
          void notifyAdminsNewSale(saleRef.id);
        } else {
          await updateDoc(doc(db, 'sales', existingSaleDoc.id), payload);
        }
      }

      // Add updated timestamp
      const enquiryData = {
        ...data,
        phone,
        visits,
        visitSchedules,
        paymentRecords,
        payments,
        updatedByUid: actor.uid,
        updatedByName: actor.name,
        updatedByEmail: actor.email,
        updatedByRole: actor.role,
        updatedAt: serverTimestamp()
      };

      // Update in Firestore
      await updateDoc(doc(db, 'enquiries', resolvedParams.id), enquiryData);

      const ENQUIRY_SCALAR_FIELDS = [
        'name', 'customerName', 'customerGstNumber', 'phone', 'email', 'address', 'status',
        'reference', 'enquiryType', 'assignedTo', 'telecaller', 'subject',
        'message', 'notes', 'visitingCenter', 'visitorType', 'companyName',
        'contactPerson', 'purposeOfVisit', 'priority', 'source',
        'journeyStatusOverride',
      ];
      const beforeSnap: Record<string, unknown> = {};
      const afterSnap: Record<string, unknown> = {};
      for (const f of ENQUIRY_SCALAR_FIELDS) {
        if (enquiry?.[f] !== undefined || data?.[f] !== undefined) {
          beforeSnap[f] = enquiry?.[f] ?? null;
          afterSnap[f] = data?.[f] ?? null;
        }
      }
      const fieldChanges = computeChanges(beforeSnap, afterSnap);
      const changedNames = fieldChanges ? Object.keys(fieldChanges).join(', ') : '';
      void logActivity(db, userProfile, userProfile?.centerId, {
        action: 'UPDATE',
        module: 'Enquiries',
        entityId: resolvedParams.id,
        entityName: data.name || data.phone || 'Enquiry',
        description: changedNames
          ? `Updated enquiry for ${data.name || data.phone || 'patient'} — changed: ${changedNames}`
          : `Updated enquiry for ${data.name || data.phone || 'patient'}`,
        changes: fieldChanges,
        metadata: { phone: data.phone },
      }, user);
      
      // Reduce inventory for new sales only
      if (newSalesProducts.length > 0) {
        await reduceInventoryForNewSales(newSalesProducts);
      }
      
      // Redirect to the enquiry details page
      router.push(`/interaction/enquiries/${resolvedParams.id}`);
      
    } catch (error) {
      console.error('Error updating enquiry:', error);
      alert('Failed to update enquiry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (resolvedParams) {
      router.push(`/interaction/enquiries/${resolvedParams.id}`);
    } else {
      router.push('/interaction/enquiries');
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !enquiry) {
    return (
      <Box sx={{ minHeight: '100vh', p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || 'Enquiry not found'}
        </Alert>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/interaction/enquiries')}
        >
          Back to Enquiries
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header with Breadcrumbs */}
      <Box sx={{ bgcolor: 'white', borderBottom: 1, borderColor: 'divider', px: 3, py: 2 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
          <Link 
            color="inherit" 
            href="/dashboard"
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Dashboard
          </Link>
          <Link 
            color="inherit" 
            href="/interaction"
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <GroupIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Interaction
          </Link>
          <Link 
            color="inherit" 
            href="/interaction/enquiries"
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          >
            Enquiries
          </Link>
          {resolvedParams && (
            <Link 
              color="inherit" 
              href={`/interaction/enquiries/${resolvedParams.id}`}
              sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
            >
              {enquiry.name || 'Enquiry Details'}
            </Link>
          )}
          <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
            <EditIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Edit
          </Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Edit Enquiry
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Update patient information, visits, and payment records for {enquiry.name}
            </Typography>
          </Box>
          
          <Button 
            variant="outlined" 
            startIcon={<ArrowBackIcon />}
            onClick={handleCancel}
            sx={{ 
              borderColor: '#f57c00', 
              color: '#f57c00', 
              '&:hover': { 
                borderColor: '#e65100', 
                backgroundColor: 'rgba(245, 124, 0, 0.04)' 
              } 
            }}
          >
            Back to Details
          </Button>
        </Box>
      </Box>

      {/* Form Container */}
      <Box sx={{ flex: 1 }}>
        <SimplifiedEnquiryForm
          open={true}
          onClose={handleCancel}
          onSubmit={handleSubmit}
          enquiry={enquiry}
          isEditMode={true}
          isSubmitting={saving}
          fullPage={true}
        />
      </Box>
    </Box>
  );
} 