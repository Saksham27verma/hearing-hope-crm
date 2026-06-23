'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Checkbox,
  FormControlLabel,
  Chip,
  Divider,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
  Alert,
  Paper,
  Stack,
  Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Close as CloseIcon,
  AssignmentReturn as ReturnIcon,
  Receipt as ReceiptIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxBlankIcon,
} from '@mui/icons-material';
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { logActivity } from '@/lib/activityLogger';
import { useAuth } from '@/context/AuthContext';

interface PurchaseProduct {
  productId: string;
  name: string;
  type: string;
  serialNumbers: string[];
  serialPairs?: [string, string][];
  quantity: number;
  dealerPrice: number;
  mrp: number;
  discountPercent?: number;
  discountAmount?: number;
  finalPrice?: number;
  gstApplicable?: boolean;
  quantityType?: 'piece' | 'pair';
}

interface Purchase {
  id?: string;
  invoiceNo: string;
  party: { id: string; name: string };
  company: string;
  location?: string;
  products: PurchaseProduct[];
  gstType: string;
  gstPercentage: number;
  totalAmount: number;
  reference?: string;
  purchaseDate: Timestamp;
}

interface PurchaseReturnDialogProps {
  open: boolean;
  purchase: Purchase | null;
  onClose: () => void;
  onSuccess: (returnId: string, returnNumber: string) => void;
}

interface SerialSelection {
  [productLineIndex: number]: Set<string>;
}

interface QtySelection {
  [productLineIndex: number]: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const getUnitPrice = (product: PurchaseProduct): number =>
  product.finalPrice ?? product.dealerPrice;

export default function PurchaseReturnDialog({
  open,
  purchase,
  onClose,
  onSuccess,
}: PurchaseReturnDialogProps) {
  const { user, userProfile } = useAuth();

  const [serialSelections, setSerialSelections] = useState<SerialSelection>({});
  const [qtySelections, setQtySelections] = useState<QtySelection>({});
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setSerialSelections({});
    setQtySelections({});
    setReason('');
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    if (saving) return;
    resetState();
    onClose();
  };

  const isSerialProduct = (product: PurchaseProduct) =>
    Array.isArray(product.serialNumbers) && product.serialNumbers.length > 0;

  const toggleSerial = (lineIndex: number, sn: string) => {
    setSerialSelections((prev) => {
      const set = new Set(prev[lineIndex] || []);
      if (set.has(sn)) set.delete(sn);
      else set.add(sn);
      return { ...prev, [lineIndex]: set };
    });
  };

  const toggleAllSerials = (lineIndex: number, serials: string[]) => {
    setSerialSelections((prev) => {
      const existing = prev[lineIndex] || new Set<string>();
      const allSelected = serials.every((sn) => existing.has(sn));
      const next = allSelected ? new Set<string>() : new Set(serials);
      return { ...prev, [lineIndex]: next };
    });
  };

  const setQty = (lineIndex: number, qty: number, max: number) => {
    const clamped = Math.max(0, Math.min(qty, max));
    setQtySelections((prev) => ({ ...prev, [lineIndex]: clamped }));
  };

  const { totalReturnAmount, selectedLineCount } = useMemo(() => {
    if (!purchase) return { totalReturnAmount: 0, selectedLineCount: 0 };
    let total = 0;
    let lineCount = 0;
    purchase.products.forEach((product, idx) => {
      const unitPrice = getUnitPrice(product);
      if (isSerialProduct(product)) {
        const selected = serialSelections[idx] || new Set<string>();
        if (selected.size > 0) {
          // For pair products, each pair = 2 serials, price is per pair
          const isPair = product.type === 'Hearing Aid' && product.quantityType === 'pair';
          const units = isPair ? Math.ceil(selected.size / 2) : selected.size;
          total += unitPrice * units;
          lineCount += 1;
        }
      } else {
        const qty = qtySelections[idx] || 0;
        if (qty > 0) {
          total += unitPrice * qty;
          lineCount += 1;
        }
      }
    });
    return { totalReturnAmount: total, selectedLineCount: lineCount };
  }, [purchase, serialSelections, qtySelections]);

  const hasSelection = selectedLineCount > 0;

  const handleConfirm = async () => {
    if (!purchase?.id || !hasSelection) return;
    setError(null);
    setSaving(true);
    try {
      // Build return products array
      const returnProducts = purchase.products
        .map((product, idx) => {
          if (isSerialProduct(product)) {
            const selected = Array.from(serialSelections[idx] || new Set<string>());
            if (selected.length === 0) return null;
            const isPair = product.type === 'Hearing Aid' && product.quantityType === 'pair';
            const returnQty = isPair ? Math.ceil(selected.length / 2) : selected.length;
            return {
              productId: product.productId,
              name: product.name,
              type: product.type,
              serialNumbers: selected,
              quantity: returnQty,
              dealerPrice: product.dealerPrice,
              mrp: product.mrp,
              discountPercent: product.discountPercent ?? 0,
              discountAmount: product.discountAmount ?? 0,
              finalPrice: product.finalPrice ?? product.dealerPrice,
              gstApplicable: product.gstApplicable ?? false,
              quantityType: product.quantityType,
            };
          } else {
            const qty = qtySelections[idx] || 0;
            if (qty === 0) return null;
            return {
              productId: product.productId,
              name: product.name,
              type: product.type,
              serialNumbers: [],
              quantity: qty,
              dealerPrice: product.dealerPrice,
              mrp: product.mrp,
              discountPercent: product.discountPercent ?? 0,
              discountAmount: product.discountAmount ?? 0,
              finalPrice: product.finalPrice ?? product.dealerPrice,
              gstApplicable: product.gstApplicable ?? false,
              quantityType: product.quantityType,
            };
          }
        })
        .filter(Boolean);

      // Generate return number
      const returnNumber = `PR-${purchase.invoiceNo}-${Date.now().toString(36).toUpperCase()}`;

      const returnData = {
        returnNumber,
        originalPurchaseId: purchase.id,
        originalInvoiceNo: purchase.invoiceNo,
        party: purchase.party,
        company: purchase.company,
        location: purchase.location ?? '',
        returnDate: serverTimestamp(),
        products: returnProducts,
        gstType: purchase.gstType,
        gstPercentage: purchase.gstPercentage,
        totalReturnAmount,
        reason: reason.trim(),
        notes: notes.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid ?? '',
      };

      const docRef = await addDoc(collection(db, 'purchaseReturns'), returnData);

      void logActivity(db, userProfile, userProfile?.centerId, {
        action: 'CREATE',
        module: 'Purchases',
        entityId: docRef.id,
        entityName: returnNumber,
        description: `Created purchase return ${returnNumber} for invoice ${purchase.invoiceNo} — ₹${totalReturnAmount}`,
        metadata: {
          returnNumber,
          originalInvoiceNo: purchase.invoiceNo,
          party: purchase.party,
          totalReturnAmount,
        },
      }, user);

      resetState();
      onSuccess(docRef.id, returnNumber);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save purchase return. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!purchase) return null;

  const formatDate = (ts: Timestamp) =>
    new Date(ts.seconds * 1000).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' } }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2.5,
          bgcolor: (t) =>
            t.palette.mode === 'dark' ? alpha(t.palette.warning.main, 0.15) : 'warning.lighter',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box display="flex" alignItems="center" gap={1.5}>
          <ReturnIcon color="warning" />
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Purchase Return
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Invoice: {purchase.invoiceNo} &bull; {formatDate(purchase.purchaseDate)} &bull;{' '}
              {purchase.party.name}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} disabled={saving} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
          Select the items you want to return. The return value is automatically calculated using
          the original purchase prices.
        </Typography>

        <Stack spacing={2}>
          {purchase.products.map((product, idx) => {
            const unitPrice = getUnitPrice(product);
            const isPair =
              product.type === 'Hearing Aid' && product.quantityType === 'pair';
            const selectedSerials = serialSelections[idx] || new Set<string>();
            const selectedQty = qtySelections[idx] || 0;
            const hasSerials = isSerialProduct(product);
            const lineSelected = hasSerials ? selectedSerials.size > 0 : selectedQty > 0;
            const returnUnits = hasSerials
              ? isPair
                ? Math.ceil(selectedSerials.size / 2)
                : selectedSerials.size
              : selectedQty;
            const lineReturnValue = returnUnits * unitPrice;

            return (
              <Paper
                key={idx}
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 1.5,
                  borderColor: lineSelected ? 'warning.main' : 'divider',
                  bgcolor: lineSelected
                    ? (t) =>
                        t.palette.mode === 'dark'
                          ? alpha(t.palette.warning.main, 0.08)
                          : alpha(t.palette.warning.light, 0.1)
                    : 'background.paper',
                  transition: 'border-color 0.2s, background-color 0.2s',
                }}
              >
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  mb={hasSerials ? 1.5 : 0}
                >
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {product.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {product.type}
                      {isPair ? ' (pairs)' : ''}
                      &nbsp;&bull;&nbsp;Unit price: {formatCurrency(unitPrice)}
                      &nbsp;&bull;&nbsp;Purchased qty: {product.quantity}
                      {isPair ? ' pairs' : ' pcs'}
                    </Typography>
                  </Box>
                  {lineSelected && (
                    <Chip
                      label={`Return value: ${formatCurrency(lineReturnValue)}`}
                      color="warning"
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 600, whiteSpace: 'nowrap', ml: 1 }}
                    />
                  )}
                </Box>

                {hasSerials ? (
                  <>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Tooltip
                        title={
                          product.serialNumbers.every((sn) => selectedSerials.has(sn))
                            ? 'Deselect all'
                            : 'Select all'
                        }
                      >
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => toggleAllSerials(idx, product.serialNumbers)}
                          startIcon={
                            product.serialNumbers.every((sn) => selectedSerials.has(sn)) ? (
                              <CheckBoxIcon fontSize="small" />
                            ) : (
                              <CheckBoxBlankIcon fontSize="small" />
                            )
                          }
                          sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1 }}
                        >
                          {product.serialNumbers.every((sn) => selectedSerials.has(sn))
                            ? 'Deselect all'
                            : 'Select all'}
                        </Button>
                      </Tooltip>
                      <Typography variant="caption" color="text.secondary">
                        {selectedSerials.size} of {product.serialNumbers.length} selected
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.75,
                        maxHeight: 160,
                        overflowY: 'auto',
                        p: 1,
                        bgcolor: (t) =>
                          t.palette.mode === 'dark'
                            ? alpha(t.palette.common.white, 0.03)
                            : '#f8f9fa',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {product.serialNumbers.map((sn) => {
                        const checked = selectedSerials.has(sn);
                        return (
                          <Chip
                            key={sn}
                            label={sn}
                            size="small"
                            clickable
                            onClick={() => toggleSerial(idx, sn)}
                            color={checked ? 'warning' : 'default'}
                            variant={checked ? 'filled' : 'outlined'}
                            icon={
                              checked ? (
                                <CheckBoxIcon fontSize="small" />
                              ) : (
                                <CheckBoxBlankIcon fontSize="small" />
                              )
                            }
                            sx={{
                              fontWeight: checked ? 600 : 400,
                              transition: 'all 0.15s ease',
                            }}
                          />
                        );
                      })}
                    </Box>
                  </>
                ) : (
                  <Box display="flex" alignItems="center" gap={2} mt={1}>
                    <TextField
                      label="Return Quantity"
                      type="number"
                      size="small"
                      value={selectedQty}
                      onChange={(e) => setQty(idx, parseInt(e.target.value, 10) || 0, product.quantity)}
                      inputProps={{ min: 0, max: product.quantity }}
                      sx={{ width: 160 }}
                      helperText={`Max: ${product.quantity} pcs`}
                    />
                    {selectedQty > 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Return value: <strong>{formatCurrency(lineReturnValue)}</strong>
                      </Typography>
                    )}
                  </Box>
                )}
              </Paper>
            );
          })}
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
            mb: 3,
          }}
        >
          <TextField
            label="Reason for Return"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            size="small"
            fullWidth
            placeholder="e.g. Defective, Wrong model..."
          />
          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            size="small"
            fullWidth
            placeholder="Additional remarks"
          />
        </Box>

        {hasSelection && (
          <Paper
            sx={{
              p: 2,
              borderRadius: 1.5,
              bgcolor: (t) =>
                t.palette.mode === 'dark'
                  ? alpha(t.palette.warning.main, 0.1)
                  : alpha(t.palette.warning.light, 0.15),
              border: '1px solid',
              borderColor: 'warning.main',
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total Return Value
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {purchase.gstType !== 'GST Exempted'
                    ? `(excl. GST ${purchase.gstPercentage}%)`
                    : '(GST Exempted)'}
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={700} color="warning.dark">
                {formatCurrency(totalReturnAmount)}
              </Typography>
            </Box>
            {purchase.gstType !== 'GST Exempted' && (
              <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                <Typography variant="caption" color="text.secondary">
                  GST ({purchase.gstPercentage}%)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatCurrency(totalReturnAmount * (purchase.gstPercentage / 100))}
                </Typography>
              </Box>
            )}
            {purchase.gstType !== 'GST Exempted' && (
              <Box display="flex" justifyContent="space-between" alignItems="center" mt={0.5}>
                <Typography variant="body2" fontWeight={600} color="text.primary">
                  Grand Total (incl. GST)
                </Typography>
                <Typography variant="body2" fontWeight={700} color="warning.dark">
                  {formatCurrency(
                    totalReturnAmount * (1 + purchase.gstPercentage / 100),
                  )}
                </Typography>
              </Box>
            )}
          </Paper>
        )}
      </DialogContent>

      <DialogActions
        sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', gap: 1 }}
      >
        <Button onClick={handleClose} disabled={saving} variant="outlined" color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!hasSelection || saving}
          variant="contained"
          color="warning"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <ReturnIcon />}
          sx={{ minWidth: 160 }}
        >
          {saving ? 'Processing...' : `Confirm Return${hasSelection ? ` (${formatCurrency(totalReturnAmount)})` : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
