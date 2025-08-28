import React from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Divider,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  DialogActions,
} from '@mui/material';
import {
  Print as PrintIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Timestamp } from 'firebase/firestore';

// Define interfaces for the component props
interface MaterialProduct {
  productId: string;
  name: string;
  type: string;
  serialNumbers: string[];
  quantity: number;
  dealerPrice?: number;
  mrp?: number;
  quantityType?: 'piece' | 'pair';
  remarks?: string;
  condition?: string;
}

interface MaterialInward {
  id?: string;
  challanNumber: string;
  supplier: {
    id: string;
    name: string;
  };
  company: string;
  products: MaterialProduct[];
  totalAmount: number;
  receivedDate: Timestamp;
  status: 'pending' | 'received' | 'rejected';
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  convertedToPurchase?: boolean;
  purchaseId?: string;
  purchaseInvoiceNo?: string;
}

interface MaterialInPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  material: MaterialInward;
}

const MaterialInPreviewDialog: React.FC<MaterialInPreviewDialogProps> = ({
  open,
  onClose,
  material,
}) => {
  // Format currency for display
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Format date for display
  const formatDate = (timestamp: Timestamp) => {
    return new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };
  
  // Handle print button click
  const handlePrint = () => {
    window.print();
  };
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          '@media print': {
            width: '100%',
            height: '100%',
            maxWidth: 'none',
            maxHeight: 'none',
            boxShadow: 'none',
          }
        }
      }}
    >
      <Box
        sx={{
          p: 4,
          '@media print': {
            p: 2
          }
        }}
        className="print-content"
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 3 
        }}>
          <Box>
            <Typography variant="h5" gutterBottom>
              {material.company}
            </Typography>
            <Typography variant="body2">
              Material Inward Challan
            </Typography>
          </Box>
          
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h6" gutterBottom>
              Challan #{material.challanNumber}
            </Typography>
            <Typography variant="body2">
              Date: {formatDate(material.receivedDate)}
            </Typography>
          </Box>
        </Box>
        
        <Divider sx={{ mb: 3 }} />
        
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={6}>
            <Typography variant="subtitle2" gutterBottom>
              Supplier Information:
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>{material.supplier.name}</strong>
            </Typography>
          </Grid>
          
          <Grid item xs={6}>
            <Typography variant="subtitle2" gutterBottom>
              Status:
            </Typography>
            <Typography variant="body2" gutterBottom>
              {material.status.charAt(0).toUpperCase() + material.status.slice(1)}
              {material.convertedToPurchase && (
                <Box component="span" sx={{ ml: 1, color: 'success.main' }}>
                  (Converted to Purchase: {material.purchaseInvoiceNo})
                </Box>
              )}
            </Typography>
            
            {material.notes && (
              <>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Notes:
                </Typography>
                <Typography variant="body2" gutterBottom>
                  {material.notes}
                </Typography>
              </>
            )}
          </Grid>
        </Grid>
        
        <Typography variant="subtitle2" gutterBottom>
          Product Details:
        </Typography>
        
        <TableContainer sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Quantity</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Price</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {material.products.map((product, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">{product.name}</Typography>
                      {product.serialNumbers.length > 0 && (
                        <Typography variant="caption">
                          SN: {product.serialNumbers.join(', ')}
                        </Typography>
                      )}
                      {product.remarks && (
                        <Typography variant="caption" display="block">
                          Remarks: {product.remarks}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{product.type}</TableCell>
                  <TableCell align="center">{product.quantity} {product.quantityType}</TableCell>
                  <TableCell align="right">{formatCurrency(product.dealerPrice || 0)}</TableCell>
                  <TableCell align="right">{formatCurrency((product.dealerPrice || 0) * product.quantity)}</TableCell>
                </TableRow>
              ))}
              
              <TableRow>
                <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold' }}>
                  Total Amount:
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {formatCurrency(material.totalAmount)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        
        <Grid container spacing={8} sx={{ mt: 4 }}>
          <Grid item xs={6}>
            <Box sx={{ borderTop: '1px solid #ddd', pt: 1, mt: 6 }}>
              <Typography variant="body2" align="center">
                Received By (Signature)
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={6}>
            <Box sx={{ borderTop: '1px solid #ddd', pt: 1, mt: 6 }}>
              <Typography variant="body2" align="center">
                Authorized Signature
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
      
      <DialogActions sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          onClick={onClose}
          color="inherit"
          startIcon={<CloseIcon />}
        >
          Close
        </Button>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
        >
          Print
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MaterialInPreviewDialog; 