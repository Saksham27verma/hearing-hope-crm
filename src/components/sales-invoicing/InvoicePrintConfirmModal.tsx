'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Card,
  CardActionArea,
  CardMedia,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Print as PrintIcon } from '@mui/icons-material';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { InvoiceData } from '@/components/invoices/InvoiceTemplate';
import InvoicePrintableBody from '@/components/invoices/InvoicePrintableBody';
import type { InvoiceVisualTemplate } from '@/components/invoices/InvoicePrintableBody';
import {
  createInvoicePdfBlobFromElement,
  DEFAULT_INVOICE_PDF_SETTINGS,
  openPdfBlobPrintDialog,
  openPdfBlobInNewTab,
  downloadPdfBlob,
} from '@/utils/invoicePdfFromElement';

export const invoicePrintTemplateStorageKey = (uid: string) => `invoicePrintTemplate:${uid}`;

interface FirestoreTemplate {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  templateType?: 'visual' | 'html';
  htmlContent?: string;
  images?: Array<{ placeholder: string; url: string }>;
}

interface InvoicePrintConfirmModalProps {
  open: boolean;
  onClose: () => void;
  invoiceData: InvoiceData;
  userId: string | undefined;
  /** Patient profile / enquiry: also offer open-in-browser and download (same template as print). */
  extraPdfActions?: boolean;
}

export default function InvoicePrintConfirmModal({
  open,
  onClose,
  invoiceData,
  userId,
  extraPdfActions = false,
}: InvoicePrintConfirmModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [templates, setTemplates] = useState<FirestoreTemplate[]>([]);
  const [fullById, setFullById] = useState<Record<string, FirestoreTemplate>>({});
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [printing, setPrinting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = templates.find((t) => t.id === selectedId);
  const isHtml = selected?.templateType === 'html';
  const customTemplate =
    isHtml && selected && fullById[selected.id]?.htmlContent
      ? {
          id: selected.id,
          htmlContent: fullById[selected.id].htmlContent!,
          images: fullById[selected.id].images || [],
        }
      : null;

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, 'invoiceTemplates'));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as FirestoreTemplate[];
      setTemplates(list);
      const full: Record<string, FirestoreTemplate> = {};
      list.forEach((t) => {
        full[t.id] = t;
      });
      setFullById(full);

      const stored = userId ? localStorage.getItem(invoicePrintTemplateStorageKey(userId)) : null;
      if (stored && list.some((t) => t.id === stored)) setSelectedId(stored);
      else if (list.length > 0) setSelectedId(list[0].id);
    } catch (e) {
      console.error(e);
      setError('Could not load templates.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) loadTemplates();
  }, [open, loadTemplates]);

  const renderPdfBlob = async (): Promise<Blob> => {
    if (!printRef.current) throw new Error('Invoice preview is not ready yet.');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const { blob } = await createInvoicePdfBlobFromElement(
      printRef.current,
      invoiceData.invoiceNumber,
      DEFAULT_INVOICE_PDF_SETTINGS
    );
    return blob;
  };

  const persistTemplateChoice = () => {
    if (userId && selectedId) localStorage.setItem(invoicePrintTemplateStorageKey(userId), selectedId);
  };

  const handleConfirmPrint = async () => {
    if (!selectedId || !printRef.current) return;
    setPrinting(true);
    setError(null);
    try {
      const blob = await renderPdfBlob();
      openPdfBlobPrintDialog(blob);
      persistTemplateChoice();
      onClose();
    } catch (e) {
      console.error(e);
      setError('Failed to generate PDF. Try again.');
    } finally {
      setPrinting(false);
    }
  };

  const handleOpenInBrowser = async () => {
    if (!selectedId || !printRef.current) return;
    setPdfBusy(true);
    setError(null);
    try {
      const blob = await renderPdfBlob();
      openPdfBlobInNewTab(blob);
      persistTemplateChoice();
      onClose();
    } catch (e) {
      console.error(e);
      setError('Failed to generate PDF. Try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedId || !printRef.current) return;
    setPdfBusy(true);
    setError(null);
    try {
      const blob = await renderPdfBlob();
      const safe = `invoice-${invoiceData.invoiceNumber || 'INV'}.pdf`.replace(/[^\w.-]+/g, '-');
      downloadPdfBlob(blob, safe);
      persistTemplateChoice();
      onClose();
    } catch (e) {
      console.error(e);
      setError('Failed to generate PDF. Try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  const busy = printing || pdfBusy;

  const visualTemplate: InvoiceVisualTemplate = 'modern';

  return (
    <>
      <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>
          <Typography variant="h6" fontWeight={700}>
            {extraPdfActions ? 'Invoice PDF' : 'Print invoice'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {extraPdfActions
              ? 'Choose a template from Invoice Manager, then open, download, or print — same as Sales & Invoicing.'
              : 'Choose a template, then confirm to open the print dialog.'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {loading ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress />
            </Box>
          ) : templates.length === 0 ? (
            <Typography color="text.secondary">No templates in Firestore. Add templates in Invoice Manager.</Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', sm: 'repeat(3, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' },
                gap: 2,
              }}
            >
              {templates.map((t) => (
                <Card
                  key={t.id}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    borderColor: selectedId === t.id ? 'primary.main' : 'divider',
                    boxShadow: selectedId === t.id ? '0 0 0 2px rgba(79, 70, 229, 0.35)' : undefined,
                  }}
                >
                  <CardActionArea onClick={() => setSelectedId(t.id)}>
                    <CardMedia
                      component="div"
                      sx={{
                        height: 100,
                        bgcolor: 'grey.100',
                        backgroundImage: t.thumbnail ? `url(${t.thumbnail})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                    <Box sx={{ p: 1 }}>
                      <Typography variant="caption" fontWeight={600} noWrap display="block">
                        {t.name}
                      </Typography>
                    </Box>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 2,
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={onClose} disabled={busy} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          {extraPdfActions && (
            <>
              <Button
                variant="outlined"
                onClick={handleOpenInBrowser}
                disabled={busy || !selectedId || templates.length === 0}
                sx={{ borderRadius: 2 }}
              >
                {pdfBusy && !printing ? 'Generating…' : 'Open in browser'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleDownloadPdf}
                disabled={busy || !selectedId || templates.length === 0}
                sx={{ borderRadius: 2 }}
              >
                {pdfBusy && !printing ? 'Generating…' : 'Download PDF'}
              </Button>
            </>
          )}
          <Button
            variant="contained"
            startIcon={printing ? <CircularProgress size={18} color="inherit" /> : <PrintIcon />}
            onClick={handleConfirmPrint}
            disabled={busy || !selectedId || templates.length === 0}
            sx={{ borderRadius: 2 }}
          >
            {printing ? 'Generating…' : 'Confirm & print'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Off-screen render target for html2canvas */}
      {open && selectedId && (
        <Box
          aria-hidden
          sx={{
            position: 'fixed',
            left: -9999,
            top: 0,
            width: 820,
            zIndex: -1,
            opacity: 0.02,
            pointerEvents: 'none',
          }}
        >
          <InvoicePrintableBody
            ref={printRef}
            invoiceData={invoiceData}
            template={visualTemplate}
            customTemplate={customTemplate}
          />
        </Box>
      )}
    </>
  );
}
