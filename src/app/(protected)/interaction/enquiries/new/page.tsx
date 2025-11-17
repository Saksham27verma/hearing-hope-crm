'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button,
  Breadcrumbs,
  Link,
  CircularProgress
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Home as HomeIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, runTransaction, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import SimplifiedEnquiryForm from '@/components/enquiries/SimplifiedEnquiryForm';

export default function NewEnquiryPage() {
  const router = useRouter();
  const { userProfile, loading: authLoading } = useAuth();
  const [saving, setSaving] = useState(false);

  // Redirect audiologists away from new enquiry page
  useEffect(() => {
    if (!authLoading && userProfile?.role === 'audiologist') {
      router.push('/interaction/enquiries');
    }
  }, [userProfile, authLoading, router]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  // Don't render if audiologist (will redirect)
  if (userProfile?.role === 'audiologist') {
    return null;
  }

  // Helper function to reduce inventory for sales
  const reduceInventoryForSales = async (visits: any[]) => {
    const inventoryUpdates: any[] = [];
    
    visits.forEach(visit => {
      if (visit.hearingAidSale && visit.products && visit.products.length > 0) {
        visit.products.forEach((product: any) => {
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
        console.error('Error updating inventory for sale:', update, error);
      }
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      setSaving(true);
      
      // Add timestamp and status
      const enquiryData = {
        ...data,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'enquiries'), enquiryData);
      
      // Reduce inventory for any sales in the visits
      if (data.visits && data.visits.length > 0) {
        await reduceInventoryForSales(data.visits);
      }
      
      console.log('Enquiry saved with ID:', docRef.id);
      
      // Redirect to the enquiry details page
      router.push(`/interaction/enquiries/${docRef.id}`);
      
    } catch (error) {
      console.error('Error saving enquiry:', error);
      alert('Failed to save enquiry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/interaction/enquiries');
  };

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
          <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
            <AddIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            New Enquiry
          </Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Create New Enquiry
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Fill in the patient information, schedule visits, and track payments
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
            Back to Enquiries
          </Button>
        </Box>
      </Box>

      {/* Form Container */}
      <Box sx={{ flex: 1 }}>
        <SimplifiedEnquiryForm
          open={true}
          onClose={handleCancel}
          onSubmit={handleSubmit}
          enquiry={null}
          isEditMode={false}
          fullPage={true}
        />
      </Box>
    </Box>
  );
} 