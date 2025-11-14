'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Divider,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Close as CloseIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  Visibility as PreviewIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { 
  downloadInvoicePDF, 
  openInvoicePDF, 
  printInvoicePDF, 
  emailInvoicePDF,
  convertSaleToInvoiceData 
} from '@/utils/pdfGenerator';

interface InvoicePreviewProps {
  open: boolean;
  onClose: () => void;
  sale: any;
  onEdit?: () => void;
}

const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  open,
  onClose,
  sale,
  onEdit,
}) => {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  if (!sale) return null;

  const invoiceData = convertSaleToInvoiceData(sale);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      switch (action) {
        case 'download':
          await downloadInvoicePDF(sale);
          setSnackbar({
            open: true,
            message: 'Invoice downloaded successfully!',
            severity: 'success',
          });
          break;
        case 'preview':
          await openInvoicePDF(sale);
          break;
        case 'print':
          await printInvoicePDF(sale);
          setSnackbar({
            open: true,
            message: 'Invoice sent to printer!',
            severity: 'success',
          });
          break;
        case 'email':
          // You can add an email dialog here
          const email = prompt('Enter email address:');
          if (email) {
            await emailInvoicePDF(sale, email);
            setSnackbar({
              open: true,
              message: 'Invoice email prepared!',
              severity: 'info',
            });
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(`Error with ${action}:`, error);
      setSnackbar({
        open: true,
        message: `Failed to ${action} invoice. Please try again.`,
        severity: 'error',
      });
    } finally {
      setActionLoading(null);
      setMenuAnchor(null);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" component="div">
              Invoice Preview - #{invoiceData.invoiceNumber}
            </Typography>
            <Box>
              <IconButton
                onClick={handleMenuClick}
                disabled={!!actionLoading}
              >
                <MoreVertIcon />
              </IconButton>
              <IconButton onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {/* Invoice Header */}
          <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h5" color="primary" gutterBottom>
                  {invoiceData.companyName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {invoiceData.companyAddress.split('\n').map((line, index) => (
                    <React.Fragment key={index}>
                      {line}
                      {index < invoiceData.companyAddress.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Phone: {invoiceData.companyPhone}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Email: {invoiceData.companyEmail}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box textAlign="right">
                  <Typography variant="h4" color="primary" gutterBottom>
                    INVOICE
                  </Typography>
                  <Typography variant="body1">
                    <strong>Invoice #:</strong> {invoiceData.invoiceNumber}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Date:</strong> {invoiceData.invoiceDate}
                  </Typography>
                  {invoiceData.dueDate && (
                    <Typography variant="body1">
                      <strong>Due Date:</strong> {invoiceData.dueDate}
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Customer Information */}
          <Paper elevation={0} sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom color="primary">
                  Bill To:
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>{invoiceData.customerName}</strong>
                </Typography>
                {invoiceData.customerAddress && (
                  <Typography variant="body2" color="text.secondary">
                    {invoiceData.customerAddress}
                  </Typography>
                )}
                {invoiceData.customerPhone && (
                  <Typography variant="body2" color="text.secondary">
                    Phone: {invoiceData.customerPhone}
                  </Typography>
                )}
                {invoiceData.customerEmail && (
                  <Typography variant="body2" color="text.secondary">
                    Email: {invoiceData.customerEmail}
                  </Typography>
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                {invoiceData.referenceDoctor && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" color="primary">
                      Reference Doctor:
                    </Typography>
                    <Typography variant="body2">
                      {invoiceData.referenceDoctor}
                    </Typography>
                  </Box>
                )}
                {invoiceData.salesperson && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" color="primary">
                      Salesperson:
                    </Typography>
                    <Typography variant="body2">
                      {invoiceData.salesperson}
                    </Typography>
                  </Box>
                )}
                {invoiceData.branch && (
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      Branch:
                    </Typography>
                    <Typography variant="body2">
                      {invoiceData.branch}
                    </Typography>
                  </Box>
                )}
              </Grid>
            </Grid>
          </Paper>

          {/* Items Table */}
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>
                    Product/Service
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">
                    Serial #
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">
                    Qty
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">
                    MRP
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">
                    Rate
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">
                    GST%
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">
                    Amount
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoiceData.items.map((item, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {item.name}
                      </Typography>
                      {item.description && (
                        <Typography variant="caption" color="text.secondary">
                          {item.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {item.serialNumber ? (
                        <Chip 
                          label={item.serialNumber} 
                          size="small" 
                          variant="outlined" 
                        />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={item.quantity} 
                        size="small" 
                        color="primary" 
                        variant="outlined" 
                      />
                    </TableCell>
                    <TableCell align="right">
                      {item.mrp ? formatCurrency(item.mrp) : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(item.rate)}
                    </TableCell>
                    <TableCell align="center">
                      {item.gstPercent || 0}%
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(item.amount)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Totals Section */}
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'grey.50' }}>
            <Grid container justifyContent="flex-end">
              <Grid item xs={12} md={6}>
                <Box>
                  <Box display="flex" justifyContent="space-between" py={1}>
                    <Typography variant="body1">Subtotal:</Typography>
                    <Typography variant="body1">
                      {formatCurrency(invoiceData.subtotal)}
                    </Typography>
                  </Box>
                  {invoiceData.totalDiscount && invoiceData.totalDiscount > 0 && (
                    <Box display="flex" justifyContent="space-between" py={1}>
                      <Typography variant="body1" color="success.main">
                        Discount:
                      </Typography>
                      <Typography variant="body1" color="success.main">
                        -{formatCurrency(invoiceData.totalDiscount)}
                      </Typography>
                    </Box>
                  )}
                  {invoiceData.totalGST && invoiceData.totalGST > 0 && (
                    <Box display="flex" justifyContent="space-between" py={1}>
                      <Typography variant="body1">GST:</Typography>
                      <Typography variant="body1">
                        {formatCurrency(invoiceData.totalGST)}
                      </Typography>
                    </Box>
                  )}
                  <Divider sx={{ my: 1 }} />
                  <Box display="flex" justifyContent="space-between" py={1}>
                    <Typography variant="h6" color="primary">
                      Grand Total:
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {formatCurrency(invoiceData.grandTotal)}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Notes and Terms */}
          {(invoiceData.notes || invoiceData.terms) && (
            <Paper elevation={0} sx={{ p: 3, mt: 2 }}>
              {invoiceData.notes && (
                <Box mb={2}>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Notes:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {invoiceData.notes}
                  </Typography>
                </Box>
              )}
              {invoiceData.terms && (
                <Box>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Terms & Conditions:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {invoiceData.terms}
                  </Typography>
                </Box>
              )}
            </Paper>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} color="inherit">
            Close
          </Button>
          {onEdit && (
            <Button onClick={onEdit} startIcon={<EditIcon />} color="primary">
              Edit
            </Button>
          )}
          <Button
            onClick={() => handleAction('preview')}
            startIcon={actionLoading === 'preview' ? <CircularProgress size={16} /> : <PreviewIcon />}
            disabled={!!actionLoading}
            variant="outlined"
          >
            Preview PDF
          </Button>
          <Button
            onClick={() => handleAction('download')}
            startIcon={actionLoading === 'download' ? <CircularProgress size={16} /> : <DownloadIcon />}
            disabled={!!actionLoading}
            variant="contained"
          >
            Download PDF
          </Button>
        </DialogActions>
      </Dialog>

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleAction('print')} disabled={!!actionLoading}>
          <ListItemIcon>
            {actionLoading === 'print' ? <CircularProgress size={16} /> : <PrintIcon />}
          </ListItemIcon>
          <ListItemText>Print Invoice</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleAction('email')} disabled={!!actionLoading}>
          <ListItemIcon>
            {actionLoading === 'email' ? <CircularProgress size={16} /> : <EmailIcon />}
          </ListItemIcon>
          <ListItemText>Email Invoice</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose} disabled={!!actionLoading}>
          <ListItemIcon>
            <ShareIcon />
          </ListItemIcon>
          <ListItemText>Share Invoice</ListItemText>
        </MenuItem>
      </Menu>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default InvoicePreview;
