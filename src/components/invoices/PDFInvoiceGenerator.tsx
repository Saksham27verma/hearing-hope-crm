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
  WhatsApp as WhatsAppIcon,
} from '@mui/icons-material';
import { InvoiceData } from './InvoiceTemplate';
import InvoicePrintableBody, { type InvoiceVisualTemplate } from './InvoicePrintableBody';
import {
  createInvoicePdfBlobFromElement,
  openPdfBlobPrintDialog,
  type InvoicePdfSettings,
} from '@/utils/invoicePdfFromElement';

interface PDFInvoiceGeneratorProps {
  open: boolean;
  onClose: () => void;
  invoiceData: InvoiceData;
  template?: InvoiceVisualTemplate;
  customTemplate?: {
    id: string;
    htmlContent: string;
    images: Array<{
      placeholder: string;
      url: string;
    }>;
  };
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
  const [waOpen, setWaOpen] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [waSending, setWaSending] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const [pdfSettings, setPdfSettings] = useState<InvoicePdfSettings>({
    format: 'A4',
    orientation: 'portrait',
    quality: 1.0,
    margin: 10,
    includeBackground: true,
    watermark: '',
  });

  const normalizePhoneForWhatsApp = (raw: string) => {
    const digits = (raw || '').toString().replace(/\D/g, '');
    if (!digits) return '';
    // If user entered 10-digit Indian number, assume +91
    if (digits.length === 10) return `91${digits}`;
    // Strip leading 0 if present (e.g., 0XXXXXXXXXX)
    if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
    return digits;
  };

  const buildWhatsAppUrl = (phoneRaw: string, message: string) => {
    const phone = normalizePhoneForWhatsApp(phoneRaw);
    const text = encodeURIComponent(message || '');
    return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  };

  const getDeviceSummary = () => {
    const names = (invoiceData.items || [])
      .map((i) => (i?.name || '').toString().trim())
      .filter(Boolean);
    if (names.length === 0) return 'your device';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} & ${names[1]}`;
    return `${names[0]} + ${names.length - 1} more`;
  };

  const canNativeShareFiles = () => {
    const nav: any = navigator as any;
    return typeof nav?.share === 'function' && typeof nav?.canShare === 'function';
  };

  const safeCanShareFiles = (file: File) => {
    try {
      const nav: any = navigator as any;
      if (typeof nav?.canShare !== 'function') return false;
      return !!nav.canShare({ files: [file] });
    } catch {
      return false;
    }
  };

  const isMobileDevice = () => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const createPdfBlob = async (): Promise<{ blob: Blob; fileName: string }> =>
    createInvoicePdfBlobFromElement(invoiceRef.current, invoiceData.invoiceNumber, pdfSettings);

  const generatePDF = async (action: 'download' | 'print' | 'share' = 'download') => {
    if (!invoiceRef.current) return;

    setIsGenerating(true);
    try {
      const { blob, fileName } = await createPdfBlob();

      switch (action) {
        case 'download': {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          break;
        }
        case 'print': {
          openPdfBlobPrintDialog(blob);
          break;
        }
        case 'share': {
          if ((navigator as any).share) {
            const file = new File([blob], fileName, { type: 'application/pdf' });
            await (navigator as any).share({
              title: `Invoice ${invoiceData.invoiceNumber}`,
              text: `Invoice for ${invoiceData.customerName}`,
              files: [file],
            });
          } else {
            // Fallback: download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          }
          break;
        }
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const openWhatsAppDialog = () => {
    setWaError(null);
    setWaPhone(invoiceData.customerPhone || '');
    const devices = getDeviceSummary();
    setWaMessage(
      `Hello ${invoiceData.customerName || 'Sir/Ma’am'},\n\n` +
        `Thank you for visiting Hearing Hope.\n` +
        `Please find your invoice PDF attached for: ${devices}.\n` +
        `Invoice #: ${invoiceData.invoiceNumber}\n\n` +
        `Regards,\nHearing Hope`
    );
    setWaOpen(true);
  };

  const handleSendWhatsApp = async () => {
    setWaError(null);
    try {
      setWaSending(true);
      setIsGenerating(true);

      const { blob, fileName } = await createPdfBlob();

      const finalMessage = (waMessage || '').trim();
      const file = new File([blob], fileName, { type: 'application/pdf' });

      // Best-possible: native share (sends PDF directly in WhatsApp on mobile)
      const phone = normalizePhoneForWhatsApp(waPhone);
      const openWhatsAppAndDownload = () => {
        // Fallback: open WhatsApp with text; user attaches PDF manually (browser limitation)
        const waUrl = buildWhatsAppUrl(phone, finalMessage);
        window.open(waUrl, '_blank', 'noopener,noreferrer');

        // Also download the PDF so it’s easy to attach
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      };

      // IMPORTANT: On desktop, Web Share opens the OS share sheet (often without WhatsApp)
      // and browsers can't auto-attach files to WhatsApp Web. So we only use native share on mobile.
      if (isMobileDevice() && canNativeShareFiles() && safeCanShareFiles(file)) {
        try {
          await (navigator as any).share({
            title: `Invoice ${invoiceData.invoiceNumber}`,
            text: finalMessage,
            files: [file],
          });
        } catch (err: any) {
          // If user cancels share sheet, don't show an error
          if (err?.name === 'AbortError') {
            return;
          }
          // If WhatsApp share fails for any reason, fallback gracefully
          openWhatsAppAndDownload();
        }
      } else {
        openWhatsAppAndDownload();
      }

      setWaOpen(false);
    } catch (err) {
      console.error('WhatsApp send failed:', err);
      const msg =
        (err as any)?.message?.toString?.() ||
        'Failed to prepare WhatsApp message. Please try again.';
      setWaError(msg);
    } finally {
      setWaSending(false);
      setIsGenerating(false);
    }
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

          <InvoicePrintableBody
            ref={invoiceRef}
            invoiceData={invoiceData}
            template={template}
            customTemplate={customTemplate}
          />
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
            onClick={openWhatsAppDialog}
            startIcon={<WhatsAppIcon />}
            variant="outlined"
            disabled={isGenerating}
            sx={{ borderColor: '#25D366', color: '#25D366', '&:hover': { borderColor: '#1DA851', bgcolor: 'rgba(37, 211, 102, 0.04)' } }}
          >
            WhatsApp
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

      {/* WhatsApp Send Dialog */}
      <Dialog open={waOpen} onClose={() => setWaOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Invoice on WhatsApp</DialogTitle>
        <DialogContent dividers>
          {waError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {waError}
            </Alert>
          )}
          <TextField
            label="WhatsApp Number"
            value={waPhone}
            onChange={(e) => setWaPhone(e.target.value)}
            fullWidth
            margin="normal"
            placeholder="e.g. 9876543210 or +91 9876543210"
            helperText="Optional. If you enter a 10-digit number, we’ll assume +91. (On desktop, this only helps open the right chat.)"
          />
          <TextField
            label="Message"
            value={waMessage}
            onChange={(e) => setWaMessage(e.target.value)}
            fullWidth
            margin="normal"
            multiline
            minRows={6}
            helperText={
              isMobileDevice() && canNativeShareFiles()
                ? 'On mobile, this will send the PDF directly via the share sheet.'
                : 'On desktop browsers, WhatsApp cannot auto-attach files. We will open WhatsApp with this message and download the PDF so you can attach it.'
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWaOpen(false)} disabled={waSending}>
            Cancel
          </Button>
          <Button
            onClick={handleSendWhatsApp}
            variant="contained"
            startIcon={waSending ? <CircularProgress size={20} /> : <WhatsAppIcon />}
            disabled={waSending}
            sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1DA851' } }}
          >
            {waSending ? 'Preparing…' : 'Send on WhatsApp'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PDFInvoiceGenerator;
