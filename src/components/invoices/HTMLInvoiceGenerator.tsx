'use client';

import React, { useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  Print as PrintIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { InvoiceData } from './InvoiceTemplate';

interface HTMLInvoiceGeneratorProps {
  open: boolean;
  onClose: () => void;
  invoiceData: InvoiceData;
  template?: 'classic' | 'modern' | 'minimal';
}

const HTMLInvoiceGenerator: React.FC<HTMLInvoiceGeneratorProps> = ({
  open,
  onClose,
  invoiceData,
  template = 'modern',
}) => {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const handlePrint = () => {
    if (invoiceRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Invoice ${invoiceData.invoiceNumber}</title>
              <style>
                ${getInvoiceStyles(template)}
              </style>
            </head>
            <body>
              ${invoiceRef.current.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const handleDownloadHTML = () => {
    if (invoiceRef.current) {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invoice ${invoiceData.invoiceNumber}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              ${getInvoiceStyles(template)}
            </style>
          </head>
          <body>
            ${invoiceRef.current.innerHTML}
          </body>
        </html>
      `;
      
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoiceData.invoiceNumber}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const getInvoiceStyles = (templateType: string) => {
    const baseStyles = `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333;
        background: #f5f5f5;
        padding: 20px;
      }
      
      .invoice-container {
        max-width: 800px;
        margin: 0 auto;
        background: white;
        box-shadow: 0 0 20px rgba(0,0,0,0.1);
        border-radius: 8px;
        overflow: hidden;
      }
      
      .invoice-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 30px;
        text-align: center;
      }
      
      .company-name {
        font-size: 2.5em;
        font-weight: bold;
        margin-bottom: 10px;
      }
      
      .invoice-title {
        font-size: 1.8em;
        margin-top: 20px;
        opacity: 0.9;
      }
      
      .invoice-body {
        padding: 30px;
      }
      
      .invoice-info {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
        margin-bottom: 30px;
      }
      
      .info-section h3 {
        color: #667eea;
        margin-bottom: 15px;
        font-size: 1.2em;
        border-bottom: 2px solid #667eea;
        padding-bottom: 5px;
      }
      
      .info-section p {
        margin-bottom: 8px;
        color: #666;
      }
      
      .items-table {
        width: 100%;
        border-collapse: collapse;
        margin: 30px 0;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        border-radius: 8px;
        overflow: hidden;
      }
      
      .items-table th {
        background: #667eea;
        color: white;
        padding: 15px;
        text-align: left;
        font-weight: 600;
      }
      
      .items-table td {
        padding: 15px;
        border-bottom: 1px solid #eee;
      }
      
      .items-table tr:hover {
        background: #f8f9ff;
      }
      
      .totals-section {
        margin-top: 30px;
        text-align: right;
      }
      
      .totals-table {
        display: inline-block;
        min-width: 300px;
      }
      
      .total-row {
        display: flex;
        justify-content: space-between;
        padding: 10px 0;
        border-bottom: 1px solid #eee;
      }
      
      .grand-total {
        background: #667eea;
        color: white;
        padding: 15px;
        border-radius: 5px;
        margin-top: 10px;
        font-size: 1.2em;
        font-weight: bold;
      }
      
      .terms-section {
        margin-top: 40px;
        padding: 20px;
        background: #f8f9ff;
        border-radius: 5px;
        border-left: 4px solid #667eea;
      }
      
      .footer {
        text-align: center;
        margin-top: 40px;
        padding-top: 20px;
        border-top: 2px solid #eee;
        color: #666;
        font-style: italic;
      }
      
      @media print {
        body {
          background: white;
          padding: 0;
        }
        
        .invoice-container {
          box-shadow: none;
          border-radius: 0;
        }
      }
    `;

    const templateStyles = {
      classic: `
        .invoice-header {
          background: #2c3e50;
          text-align: left;
        }
        .company-name {
          font-size: 2em;
        }
        .items-table th {
          background: #34495e;
        }
        .grand-total {
          background: #2c3e50;
        }
      `,
      modern: baseStyles,
      minimal: `
        .invoice-header {
          background: white;
          color: #333;
          border-bottom: 3px solid #3498db;
        }
        .company-name {
          color: #3498db;
        }
        .items-table th {
          background: #3498db;
        }
        .grand-total {
          background: #3498db;
        }
        .info-section h3 {
          color: #3498db;
          border-bottom-color: #3498db;
        }
      `,
    };

    return baseStyles + (templateStyles[templateType as keyof typeof templateStyles] || '');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            Invoice Preview - {invoiceData.invoiceNumber}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <div ref={invoiceRef} className="invoice-container">
          {/* Header */}
          <div className="invoice-header">
            <div className="company-name">{invoiceData.companyName}</div>
            <div style={{ fontSize: '1.1em', marginTop: '10px', opacity: 0.9 }}>
              {invoiceData.companyAddress.split('\n').map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </div>
            <div style={{ marginTop: '10px' }}>
              {invoiceData.companyPhone} • {invoiceData.companyEmail}
            </div>
            {invoiceData.companyGST && (
              <div style={{ marginTop: '5px' }}>GST: {invoiceData.companyGST}</div>
            )}
            <div className="invoice-title">INVOICE</div>
          </div>

          {/* Body */}
          <div className="invoice-body">
            {/* Invoice Info */}
            <div className="invoice-info">
              <div className="info-section">
                <h3>Bill To:</h3>
                <p><strong>{invoiceData.customerName}</strong></p>
                {invoiceData.customerAddress && (
                  <p>{invoiceData.customerAddress}</p>
                )}
                {invoiceData.customerPhone && (
                  <p>Phone: {invoiceData.customerPhone}</p>
                )}
                {invoiceData.customerEmail && (
                  <p>Email: {invoiceData.customerEmail}</p>
                )}
                {invoiceData.customerGST && (
                  <p>GST: {invoiceData.customerGST}</p>
                )}
              </div>
              
              <div className="info-section">
                <h3>Invoice Details:</h3>
                <p><strong>Invoice #:</strong> {invoiceData.invoiceNumber}</p>
                <p><strong>Date:</strong> {invoiceData.invoiceDate}</p>
                {invoiceData.dueDate && (
                  <p><strong>Due Date:</strong> {invoiceData.dueDate}</p>
                )}
                {invoiceData.referenceDoctor && (
                  <p><strong>Reference Doctor:</strong> {invoiceData.referenceDoctor}</p>
                )}
                {invoiceData.salesperson && (
                  <p><strong>Salesperson:</strong> {invoiceData.salesperson}</p>
                )}
                {invoiceData.branch && (
                  <p><strong>Branch:</strong> {invoiceData.branch}</p>
                )}
              </div>
            </div>

            {/* Items Table */}
            <table className="items-table">
              <thead>
                <tr>
                  <th>Product/Service</th>
                  <th>Serial #</th>
                  <th>Qty</th>
                  <th>MRP</th>
                  <th>Rate</th>
                  <th>GST%</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoiceData.items.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <strong>{item.name}</strong>
                      {item.description && (
                        <div style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td>{item.serialNumber || '—'}</td>
                    <td>{item.quantity}</td>
                    <td>{item.mrp ? formatCurrency(item.mrp) : '—'}</td>
                    <td>{formatCurrency(item.rate)}</td>
                    <td>{item.gstPercent || 0}%</td>
                    <td><strong>{formatCurrency(item.amount)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="totals-section">
              <div className="totals-table">
                <div className="total-row">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(invoiceData.subtotal)}</span>
                </div>
                {invoiceData.totalDiscount && invoiceData.totalDiscount > 0 && (
                  <div className="total-row">
                    <span>Discount:</span>
                    <span>-{formatCurrency(invoiceData.totalDiscount)}</span>
                  </div>
                )}
                {invoiceData.totalGST && invoiceData.totalGST > 0 && (
                  <div className="total-row">
                    <span>GST:</span>
                    <span>{formatCurrency(invoiceData.totalGST)}</span>
                  </div>
                )}
                <div className="grand-total">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Grand Total:</span>
                    <span>{formatCurrency(invoiceData.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms and Notes */}
            {(invoiceData.terms || invoiceData.notes) && (
              <div className="terms-section">
                {invoiceData.terms && (
                  <>
                    <h3 style={{ marginBottom: '15px', color: '#667eea' }}>Terms & Conditions:</h3>
                    <p style={{ marginBottom: '15px' }}>{invoiceData.terms}</p>
                  </>
                )}
                {invoiceData.notes && (
                  <>
                    <h3 style={{ marginBottom: '15px', color: '#667eea' }}>Notes:</h3>
                    <p>{invoiceData.notes}</p>
                  </>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="footer">
              <p>Thank you for your business!</p>
              <p>This invoice was generated electronically and is valid without signature.</p>
            </div>
          </div>
        </div>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
        <Button
          onClick={() => {/* TODO: Email functionality */}}
          startIcon={<EmailIcon />}
          variant="outlined"
        >
          Email
        </Button>
        <Button
          onClick={handleDownloadHTML}
          startIcon={<DownloadIcon />}
          variant="outlined"
        >
          Download HTML
        </Button>
        <Button
          onClick={handlePrint}
          startIcon={<PrintIcon />}
          variant="contained"
        >
          Print
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HTMLInvoiceGenerator;
