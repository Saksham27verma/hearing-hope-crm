import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Timestamp, Firestore } from 'firebase/firestore';

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

interface ConvertToPurchaseDialogProps {
  open: boolean;
  onClose: () => void;
  material: MaterialInward;
  onConvert: (invoiceNo: string) => void;
  db?: Firestore; // Make db optional
}

const ConvertToPurchaseDialog: React.FC<ConvertToPurchaseDialogProps> = ({
  open,
  onClose,
  material,
  onConvert,
}) => {
  const [invoiceNo, setInvoiceNo] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  useEffect(() => {
    if (open) {
      generateInvoiceNumber();
    }
  }, [open]);
  
  // Format currency for display
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Generate a unique invoice number
  const generateInvoiceNumber = async () => {
    setIsGenerating(true);
    try {
      // Generate a unique invoice number based on current date and a random number
      const today = new Date();
      const year = today.getFullYear().toString().substr(-2); // Last 2 digits of year
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const day = today.getDate().toString().padStart(2, '0');
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      
      const newInvoiceNo = `INV-${year}${month}${day}-${random}`;
      setInvoiceNo(newInvoiceNo);
    } catch (error) {
      console.error('Error generating invoice number:', error);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Handle convert button click
  const handleConvert = () => {
    if (!invoiceNo.trim()) return;
    onConvert(invoiceNo);
  };
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Convert to Purchase</DialogTitle>
      <DialogContent>
        <Box sx={{ my: 2 }}>
          <Typography variant="body1" gutterBottom>
            You are about to convert Delivery Challan <strong>{material.challanNumber}</strong> into a Purchase Invoice.
          </Typography>
          
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
            This will create a new Purchase record with all the products from this delivery challan.
            The challan will be marked as converted and will be highlighted in red in the list.
            Converted challans cannot be edited or deleted, but they remain in the system for reference.
          </Typography>
          
          <TextField
            margin="normal"
            label="Purchase Invoice Number"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            fullWidth
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={generateInvoiceNumber}
                    disabled={isGenerating}
                    edge="end"
                  >
                    <Tooltip title="Generate New Number">
                      {isGenerating ? <CircularProgress size={24} /> : <RefreshIcon />}
                    </Tooltip>
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Summary:
            </Typography>
            <Box sx={{ ml: 2 }}>
              <Typography variant="body2">
                Supplier: <strong>{material.supplier.name}</strong>
              </Typography>
              <Typography variant="body2">
                Company: <strong>{material.company}</strong>
              </Typography>
              <Typography variant="body2">
                Product Count: <strong>{material.products.length}</strong>
              </Typography>
              <Typography variant="body2">
                Total Amount: <strong>{formatCurrency(material.totalAmount)}</strong>
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={handleConvert}
          color="primary" 
          variant="contained"
          disabled={!invoiceNo.trim() || isGenerating}
        >
          Convert to Purchase
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConvertToPurchaseDialog; 