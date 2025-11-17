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
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, runTransaction } from 'firebase/firestore';
import { db } from '@/firebase/config';
import SimplifiedEnquiryForm from '@/components/enquiries/SimplifiedEnquiryForm';

interface EditEnquiryPageProps {
  params: Promise<{ id: string }>;
}

export default function EditEnquiryPage({ params }: EditEnquiryPageProps) {
  const router = useRouter();
  const [enquiry, setEnquiry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);

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
    try {
      setSaving(true);
      
      // Find new sales that need inventory reduction
      const oldVisits = enquiry?.visits || [];
      const newSalesProducts = findNewSales(oldVisits, data.visits || []);
      
      // Add updated timestamp
      const enquiryData = {
        ...data,
        updatedAt: serverTimestamp()
      };

      if (!resolvedParams) return;
      
      // Update in Firestore
      await updateDoc(doc(db, 'enquiries', resolvedParams.id), enquiryData);
      
      // Reduce inventory for new sales only
      if (newSalesProducts.length > 0) {
        await reduceInventoryForNewSales(newSalesProducts);
      }
      
      console.log('Enquiry updated successfully');
      
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
          fullPage={true}
        />
      </Box>
    </Box>
  );
} 