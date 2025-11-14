'use client';

import React, { useRef, useState } from 'react';
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
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Print as PrintIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  Share as ShareIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { InvoiceData } from './InvoiceTemplate';

interface PDFInvoiceGeneratorProps {
  open: boolean;
  onClose: () => void;
  invoiceData: InvoiceData;
  template?: 'classic' | 'modern' | 'minimal' | 'professional';
  customTemplate?: {
    id: string;
    htmlContent: string;
    images: Array<{
      placeholder: string;
      url: string;
    }>;
  };
}

interface PDFSettings {
  format: 'A4' | 'Letter' | 'A5';
  orientation: 'portrait' | 'landscape';
  quality: number;
  margin: number;
  includeBackground: boolean;
  watermark: string;
}

const PDFInvoiceGenerator: React.FC<PDFInvoiceGeneratorProps> = ({
  open,
  onClose,
  invoiceData,
  template = 'modern',
  customTemplate,
}) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pdfSettings, setPdfSettings] = useState<PDFSettings>({
    format: 'A4',
    orientation: 'portrait',
    quality: 1.0,
    margin: 10,
    includeBackground: true,
    watermark: '',
  });

  // Process HTML template with invoice data
  const processHTMLTemplate = (html: string): string => {
    let processed = html;

    // Replace image placeholders
    if (customTemplate?.images) {
      customTemplate.images.forEach(img => {
        processed = processed.replace(new RegExp(img.placeholder, 'g'), img.url);
      });
    }

    // Replace invoice data placeholders
    processed = processed
      .replace(/\{\{CUSTOMER_NAME\}\}/g, invoiceData.customerName || '')
      .replace(/\{\{CUSTOMER_ADDRESS\}\}/g, invoiceData.customerAddress || '')
      .replace(/\{\{CUSTOMER_PHONE\}\}/g, invoiceData.customerPhone || '')
      .replace(/\{\{CUSTOMER_EMAIL\}\}/g, invoiceData.customerEmail || '')
      .replace(/\{\{CUSTOMER_GSTIN\}\}/g, invoiceData.customerGSTIN || 'N/A')
      .replace(/\{\{INVOICE_NUMBER\}\}/g, invoiceData.invoiceNumber || '')
      .replace(/\{\{INVOICE_DATE\}\}/g, invoiceData.invoiceDate || new Date().toLocaleDateString('en-IN'))
      .replace(/\{\{DUE_DATE\}\}/g, invoiceData.dueDate || '')
      .replace(/\{\{PAYMENT_MODE\}\}/g, invoiceData.paymentMode || 'Cash')
      .replace(/\{\{WARRANTY_PERIOD\}\}/g, invoiceData.warrantyPeriod || '1 Year')
      .replace(/\{\{TRIAL_PERIOD\}\}/g, invoiceData.trialPeriod || '7')
      .replace(/\{\{SUBTOTAL\}\}/g, formatCurrency(invoiceData.subtotal || 0))
      .replace(/\{\{TAX_RATE\}\}/g, String(invoiceData.taxRate || 0))
      .replace(/\{\{TAX_AMOUNT\}\}/g, formatCurrency(invoiceData.taxAmount || 0))
      .replace(/\{\{TOTAL\}\}/g, formatCurrency(invoiceData.total || 0));

    // Replace items table
    if (invoiceData.items && invoiceData.items.length > 0) {
      const itemsHTML = invoiceData.items.map((item, index) => {
        const mrp = item.mrp || item.unitPrice || 0;
        const quantity = item.quantity || 1;
        const totalMRP = mrp * quantity;
        const discount = item.discountPercent || item.discount || 0;
        const sellingPrice = item.sellingPrice || (mrp - (mrp * discount / 100));
        const totalSellingPrice = sellingPrice * quantity;
        const gstPercent = item.gstPercent || invoiceData.taxRate || 5;
        const gstAmount = totalSellingPrice * gstPercent / 100;
        
        return `
        <tr>
          <td style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc;width:25px" valign="top"><b>${index + 1}</b></td>
          <td style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc"><b><font size="2">${item.name || item.description || ''}</font></b><br><pre wrap="soft" style="width:150px">${item.description || ''}</pre></td>
          <td valign="top" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc;width:80px">${item.serialNumber || 'N/A'}</td>
          <td valign="top" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc">${item.hsnCode || '9021'}</td>
          <td valign="top" align="right" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc;width:80px">${formatCurrency(mrp)}</td>
          <td valign="top" align="right" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc;width:25px">${quantity}</td>
          <td valign="top" align="right" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc;width:80px">${formatCurrency(totalMRP)}</td>
          <td valign="top" align="right" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc">${discount}%</td>
          <td valign="top" align="right" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc;width:90px">${formatCurrency(totalSellingPrice)}</td>
          <td valign="top" align="right" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc;width:27px">${gstPercent}%</td>
          <td valign="top" align="right" style="border-bottom:2px dotted #c0c6cc">${formatCurrency(gstAmount)}</td>
        </tr>
        `;
      }).join('');
      processed = processed.replace(/\{\{ITEMS_PLACEHOLDER\}\}/g, itemsHTML);
    }

    return processed;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const generatePDF = async (action: 'download' | 'print' | 'share' = 'download') => {
    if (!invoiceRef.current) return;

    setIsGenerating(true);
    
    try {
      // Create canvas from HTML
      const canvas = await html2canvas(invoiceRef.current, {
        scale: pdfSettings.quality,
        useCORS: true,
        allowTaint: true,
        backgroundColor: pdfSettings.includeBackground ? '#ffffff' : null,
        width: invoiceRef.current.scrollWidth,
        height: invoiceRef.current.scrollHeight,
      });

      // Calculate PDF dimensions
      const imgWidth = pdfSettings.format === 'A4' ? 210 : pdfSettings.format === 'Letter' ? 216 : 148;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Create PDF
      const pdf = new jsPDF({
        orientation: pdfSettings.orientation,
        unit: 'mm',
        format: pdfSettings.format.toLowerCase() as any,
      });

      // Add watermark if specified
      if (pdfSettings.watermark) {
        pdf.setTextColor(200, 200, 200);
        pdf.setFontSize(50);
        pdf.text(pdfSettings.watermark, imgWidth / 2, imgHeight / 2, {
          angle: 45,
          align: 'center',
        });
      }

      // Add image to PDF
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(
        imgData,
        'PNG',
        pdfSettings.margin,
        pdfSettings.margin,
        imgWidth - (pdfSettings.margin * 2),
        imgHeight - (pdfSettings.margin * 2)
      );

      // Handle different actions
      const fileName = `invoice-${invoiceData.invoiceNumber}.pdf`;
      
      switch (action) {
        case 'download':
          pdf.save(fileName);
          break;
        case 'print':
          pdf.autoPrint();
          window.open(pdf.output('bloburl'), '_blank');
          break;
        case 'share':
          const blob = pdf.output('blob');
          if (navigator.share) {
            const file = new File([blob], fileName, { type: 'application/pdf' });
            await navigator.share({
              title: `Invoice ${invoiceData.invoiceNumber}`,
              text: `Invoice for ${invoiceData.customerName}`,
              files: [file],
            });
          } else {
            // Fallback: download
            pdf.save(fileName);
          }
          break;
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getTemplateStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      fontFamily: 'Arial, sans-serif',
      lineHeight: 1.6,
      color: '#333',
      backgroundColor: '#fff',
      padding: '40px',
      maxWidth: '800px',
      margin: '0 auto',
    };

    const templateStyles = {
      classic: {
        ...baseStyles,
        fontFamily: 'Times New Roman, serif',
      },
      modern: {
        ...baseStyles,
        fontFamily: 'Helvetica, Arial, sans-serif',
      },
      minimal: {
        ...baseStyles,
        fontFamily: 'Arial, sans-serif',
        padding: '20px',
      },
      professional: {
        ...baseStyles,
        fontFamily: 'Calibri, Arial, sans-serif',
        backgroundColor: '#fafafa',
      },
    };

    return templateStyles[template] || templateStyles.modern;
  };

  const getHeaderStyles = (): React.CSSProperties => {
    const headerStyles = {
      classic: {
        borderBottom: '3px solid #333',
        paddingBottom: '20px',
        marginBottom: '30px',
      },
      modern: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '30px',
        borderRadius: '8px',
        marginBottom: '30px',
      },
      minimal: {
        borderBottom: '1px solid #eee',
        paddingBottom: '15px',
        marginBottom: '25px',
      },
      professional: {
        backgroundColor: '#2c3e50',
        color: 'white',
        padding: '25px',
        marginBottom: '30px',
      },
    };

    return headerStyles[template] || headerStyles.modern;
  };

  return (
    <>
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
              PDF Invoice Generator - {invoiceData.invoiceNumber}
            </Typography>
            <Box>
              <IconButton onClick={() => setShowSettings(!showSettings)}>
                <SettingsIcon />
              </IconButton>
              <IconButton onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {showSettings && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                PDF Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Format</InputLabel>
                    <Select
                      value={pdfSettings.format}
                      onChange={(e) => setPdfSettings(prev => ({ ...prev, format: e.target.value as any }))}
                    >
                      <MenuItem value="A4">A4</MenuItem>
                      <MenuItem value="Letter">Letter</MenuItem>
                      <MenuItem value="A5">A5</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Orientation</InputLabel>
                    <Select
                      value={pdfSettings.orientation}
                      onChange={(e) => setPdfSettings(prev => ({ ...prev, orientation: e.target.value as any }))}
                    >
                      <MenuItem value="portrait">Portrait</MenuItem>
                      <MenuItem value="landscape">Landscape</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Quality (0.1-2.0)"
                    type="number"
                    inputProps={{ min: 0.1, max: 2.0, step: 0.1 }}
                    value={pdfSettings.quality}
                    onChange={(e) => setPdfSettings(prev => ({ ...prev, quality: parseFloat(e.target.value) }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Margin (mm)"
                    type="number"
                    inputProps={{ min: 0, max: 50 }}
                    value={pdfSettings.margin}
                    onChange={(e) => setPdfSettings(prev => ({ ...prev, margin: parseInt(e.target.value) }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Watermark Text (optional)"
                    value={pdfSettings.watermark}
                    onChange={(e) => setPdfSettings(prev => ({ ...prev, watermark: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={pdfSettings.includeBackground}
                        onChange={(e) => setPdfSettings(prev => ({ ...prev, includeBackground: e.target.checked }))}
                      />
                    }
                    label="Include Background"
                  />
                </Grid>
              </Grid>
            </Paper>
          )}

          <div ref={invoiceRef}>
            {customTemplate && customTemplate.htmlContent ? (
              // Render custom HTML template
              <div
                dangerouslySetInnerHTML={{
                  __html: processHTMLTemplate(customTemplate.htmlContent)
                }}
              />
            ) : (
              // Render default template
              <div style={getTemplateStyles()}>
                {/* Header */}
                <div style={getHeaderStyles()}>
                  <div style={{ textAlign: template === 'modern' ? 'center' : 'left' }}>
                    <h1 style={{ margin: 0, fontSize: '2.5em', fontWeight: 'bold' }}>
                      {invoiceData.companyName}
                    </h1>
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
                <h2 style={{ marginTop: '20px', fontSize: '1.8em' }}>INVOICE</h2>
              </div>
            </div>

            {/* Invoice Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
              <div>
                <h3 style={{ color: template === 'modern' ? '#667eea' : '#333', marginBottom: '15px', borderBottom: '2px solid', paddingBottom: '5px' }}>
                  Bill To:
                </h3>
                <p style={{ margin: '8px 0', fontWeight: 'bold' }}>{invoiceData.customerName}</p>
                {invoiceData.customerAddress && <p style={{ margin: '8px 0' }}>{invoiceData.customerAddress}</p>}
                {invoiceData.customerPhone && <p style={{ margin: '8px 0' }}>Phone: {invoiceData.customerPhone}</p>}
                {invoiceData.customerEmail && <p style={{ margin: '8px 0' }}>Email: {invoiceData.customerEmail}</p>}
                {invoiceData.customerGST && <p style={{ margin: '8px 0' }}>GST: {invoiceData.customerGST}</p>}
              </div>
              
              <div>
                <h3 style={{ color: template === 'modern' ? '#667eea' : '#333', marginBottom: '15px', borderBottom: '2px solid', paddingBottom: '5px' }}>
                  Invoice Details:
                </h3>
                <p style={{ margin: '8px 0' }}><strong>Invoice #:</strong> {invoiceData.invoiceNumber}</p>
                <p style={{ margin: '8px 0' }}><strong>Date:</strong> {invoiceData.invoiceDate}</p>
                {invoiceData.dueDate && <p style={{ margin: '8px 0' }}><strong>Due Date:</strong> {invoiceData.dueDate}</p>}
                {invoiceData.referenceDoctor && <p style={{ margin: '8px 0' }}><strong>Reference Doctor:</strong> {invoiceData.referenceDoctor}</p>}
                {invoiceData.salesperson && <p style={{ margin: '8px 0' }}><strong>Salesperson:</strong> {invoiceData.salesperson}</p>}
                {invoiceData.branch && <p style={{ margin: '8px 0' }}><strong>Branch:</strong> {invoiceData.branch}</p>}
              </div>
            </div>

            {/* Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', margin: '30px 0', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
              <thead>
                <tr style={{ backgroundColor: template === 'modern' ? '#667eea' : '#f5f5f5', color: template === 'modern' ? 'white' : '#333' }}>
                  <th style={{ padding: '15px', textAlign: 'left', border: '1px solid #ddd' }}>Product/Service</th>
                  <th style={{ padding: '15px', textAlign: 'left', border: '1px solid #ddd' }}>Serial #</th>
                  <th style={{ padding: '15px', textAlign: 'center', border: '1px solid #ddd' }}>Qty</th>
                  <th style={{ padding: '15px', textAlign: 'right', border: '1px solid #ddd' }}>MRP</th>
                  <th style={{ padding: '15px', textAlign: 'right', border: '1px solid #ddd' }}>Rate</th>
                  <th style={{ padding: '15px', textAlign: 'center', border: '1px solid #ddd' }}>GST%</th>
                  <th style={{ padding: '15px', textAlign: 'right', border: '1px solid #ddd' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoiceData.items.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '15px', border: '1px solid #ddd' }}>
                      <strong>{item.name}</strong>
                      {item.description && (
                        <div style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '15px', border: '1px solid #ddd' }}>{item.serialNumber || '—'}</td>
                    <td style={{ padding: '15px', textAlign: 'center', border: '1px solid #ddd' }}>{item.quantity}</td>
                    <td style={{ padding: '15px', textAlign: 'right', border: '1px solid #ddd' }}>{item.mrp ? formatCurrency(item.mrp) : '—'}</td>
                    <td style={{ padding: '15px', textAlign: 'right', border: '1px solid #ddd' }}>{formatCurrency(item.rate)}</td>
                    <td style={{ padding: '15px', textAlign: 'center', border: '1px solid #ddd' }}>{item.gstPercent || 0}%</td>
                    <td style={{ padding: '15px', textAlign: 'right', border: '1px solid #ddd', fontWeight: 'bold' }}>{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ textAlign: 'right', marginTop: '30px' }}>
              <div style={{ display: 'inline-block', minWidth: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                  <span>Subtotal:</span>
                  <span>{formatCurrency(invoiceData.subtotal)}</span>
                </div>
                {invoiceData.totalDiscount && invoiceData.totalDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                    <span>Discount:</span>
                    <span>-{formatCurrency(invoiceData.totalDiscount)}</span>
                  </div>
                )}
                {invoiceData.totalGST && invoiceData.totalGST > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                    <span>GST:</span>
                    <span>{formatCurrency(invoiceData.totalGST)}</span>
                  </div>
                )}
                <div style={{ 
                  backgroundColor: template === 'modern' ? '#667eea' : '#333', 
                  color: 'white', 
                  padding: '15px', 
                  borderRadius: '5px', 
                  marginTop: '10px',
                  fontSize: '1.2em',
                  fontWeight: 'bold'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Grand Total:</span>
                    <span>{formatCurrency(invoiceData.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms and Notes */}
            {(invoiceData.terms || invoiceData.notes) && (
              <div style={{ 
                marginTop: '40px', 
                padding: '20px', 
                backgroundColor: '#f8f9ff', 
                borderRadius: '5px',
                borderLeft: '4px solid ' + (template === 'modern' ? '#667eea' : '#333')
              }}>
                {invoiceData.terms && (
                  <>
                    <h3 style={{ marginBottom: '15px', color: template === 'modern' ? '#667eea' : '#333' }}>Terms & Conditions:</h3>
                    <p style={{ marginBottom: '15px' }}>{invoiceData.terms}</p>
                  </>
                )}
                {invoiceData.notes && (
                  <>
                    <h3 style={{ marginBottom: '15px', color: template === 'modern' ? '#667eea' : '#333' }}>Notes:</h3>
                    <p>{invoiceData.notes}</p>
                  </>
                )}
              </div>
            )}

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: '40px', paddingTop: '20px', borderTop: '2px solid #eee', color: '#666', fontStyle: 'italic' }}>
              <p>Thank you for your business!</p>
              <p>This invoice was generated electronically and is valid without signature.</p>
            </div>
              </div>
            )}
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
            disabled={isGenerating}
          >
            Email
          </Button>
          <Button
            onClick={() => generatePDF('share')}
            startIcon={<ShareIcon />}
            variant="outlined"
            disabled={isGenerating}
          >
            Share
          </Button>
          <Button
            onClick={() => generatePDF('print')}
            startIcon={<PrintIcon />}
            variant="outlined"
            disabled={isGenerating}
          >
            Print
          </Button>
          <Button
            onClick={() => generatePDF('download')}
            startIcon={isGenerating ? <CircularProgress size={20} /> : <DownloadIcon />}
            variant="contained"
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PDFInvoiceGenerator;
