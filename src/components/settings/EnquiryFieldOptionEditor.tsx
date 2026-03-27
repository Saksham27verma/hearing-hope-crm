'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Switch,
  IconButton,
  Stack,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowUpward as UpIcon,
  ArrowDownward as DownIcon,
  Save as SaveIcon,
  CloudUpload as SeedIcon,
} from '@mui/icons-material';
import { db } from '@/firebase/config';
import { getDefaultOptionsForField } from '@/lib/field-options/registry';
import type { FieldOptionResolved } from '@/lib/field-options/types';
import {
  addFieldOption,
  deleteFieldOption,
  listFieldOptionsAll,
  seedDefaultsToFirestore,
  updateFieldOption,
} from '@/services/fieldOptionsService';

const MODULE_KEY = 'enquiries';

interface Props {
  fieldKey: string;
  displayName: string;
  usedIn: string;
}

export default function EnquiryFieldOptionEditor({ fieldKey, displayName, usedIn }: Props) {
  const [rows, setRows] = useState<FieldOptionResolved[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [addOpen, setAddOpen] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const load = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const list = await listFieldOptionsAll(db, MODULE_KEY, fieldKey);
      setRows(list);
    } catch (e: any) {
      setSnack({ open: true, message: e?.message || 'Failed to load', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [fieldKey]);

  useEffect(() => {
    load();
  }, [load]);

  const builtinCount = getDefaultOptionsForField(MODULE_KEY, fieldKey).length;

  const handleSeed = async () => {
    if (!db) return;
    try {
      setSaving(true);
      const r = await seedDefaultsToFirestore(db, MODULE_KEY, fieldKey);
      if (r.created === 0) {
        setSnack({
          open: true,
          message: r.skipped ? 'Options already exist in Firestore for this field.' : 'Nothing to seed.',
          severity: 'info',
        });
      } else {
        setSnack({ open: true, message: `Saved ${r.created} built-in option(s) to the database.`, severity: 'success' });
      }
      await load();
    } catch (e: any) {
      setSnack({ open: true, message: e?.message || 'Seed failed', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row: FieldOptionResolved) => {
    if (!db || !row.id) return;
    try {
      setSaving(true);
      await updateFieldOption(db, row.id, { isActive: !row.isActive });
      await load();
    } catch (e: any) {
      setSnack({ open: true, message: e?.message || 'Update failed', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: FieldOptionResolved) => {
    if (!db || !row.id) return;
    if (!window.confirm(`Remove "${row.optionLabel}" (${row.optionValue})?`)) return;
    try {
      setSaving(true);
      await deleteFieldOption(db, row.id);
      await load();
    } catch (e: any) {
      setSnack({ open: true, message: e?.message || 'Delete failed', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleLabelBlur = async (row: FieldOptionResolved, label: string) => {
    if (!db || !row.id || label.trim() === row.optionLabel) return;
    try {
      await updateFieldOption(db, row.id, { optionLabel: label.trim() });
      await load();
    } catch (e: any) {
      setSnack({ open: true, message: e?.message || 'Save failed', severity: 'error' });
    }
  };

  const moveRow = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= rows.length || !db) return;
    const next = [...rows];
    const tmp = next[index];
    next[index] = next[j];
    next[j] = tmp;
    const withOrder = next.map((r, i) => ({ ...r, sortOrder: (i + 1) * 10 }));
    setRows(withOrder);
    try {
      setSaving(true);
      await Promise.all(
        withOrder
          .filter((r): r is FieldOptionResolved & { id: string } => Boolean(r.id))
          .map((r) => updateFieldOption(db, r.id, { sortOrder: r.sortOrder }))
      );
      await load();
    } catch (e: any) {
      setSnack({ open: true, message: e?.message || 'Reorder failed', severity: 'error' });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!db) return;
    const v = newValue.trim();
    const l = newLabel.trim() || v;
    if (!v) {
      setSnack({ open: true, message: 'Option value is required.', severity: 'error' });
      return;
    }
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.sortOrder), 0);
    try {
      setSaving(true);
      await addFieldOption(db, MODULE_KEY, fieldKey, {
        optionValue: v,
        optionLabel: l,
        sortOrder: maxOrder + 10,
        isActive: true,
      });
      setAddOpen(false);
      setNewValue('');
      setNewLabel('');
      await load();
      setSnack({ open: true, message: 'Option added.', severity: 'success' });
    } catch (e: any) {
      setSnack({ open: true, message: e?.message || 'Add failed', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ pt: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.5 }}>
        {usedIn}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
        <Chip size="small" variant="outlined" label={`Built-in list: ${builtinCount} options`} />
        <Chip size="small" variant="outlined" label={`Firestore key: ${fieldKey}`} sx={{ fontFamily: 'monospace' }} />
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Copy built-in defaults into Firestore (only if this field is empty)">
          <Button
            size="small"
            variant="outlined"
            startIcon={saving ? <CircularProgress size={14} /> : <SeedIcon />}
            onClick={handleSeed}
            disabled={saving || !db}
            sx={{ textTransform: 'none' }}
          >
            Seed from built-in list
          </Button>
        </Tooltip>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} disabled={!db} sx={{ textTransform: 'none' }}>
          Add option
        </Button>
      </Stack>

      {!loading && rows.length === 0 && (
        <Alert
          severity="info"
          variant="outlined"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              variant="contained"
              disableElevation
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SeedIcon />}
              onClick={handleSeed}
              disabled={saving || !db}
              sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
            >
              Copy to Firestore
            </Button>
          }
        >
          <Typography variant="body2" component="span" sx={{ display: 'block', pr: 1 }}>
            This field is still using the <strong>{builtinCount} built-in</strong> options (shown in the chip above). That is
            normal until you save a copy to the database — then you can edit labels, reorder, or turn options off for everyone.
          </Typography>
        </Alert>
      )}

      {loading ? (
        <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : rows.length > 0 ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={88}>Order</TableCell>
              <TableCell>Value (stored)</TableCell>
              <TableCell>Label (display)</TableCell>
              <TableCell width={72} align="center">
                On
              </TableCell>
              <TableCell width={56} align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={row.id!}>
                <TableCell>
                  <Stack direction="row" spacing={0}>
                    <IconButton size="small" onClick={() => moveRow(i, -1)} disabled={saving || i === 0}>
                      <UpIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => moveRow(i, 1)} disabled={saving || i === rows.length - 1}>
                      <DownIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {row.optionValue}
                  </Typography>
                </TableCell>
                <TableCell>
                  <EditableLabel initial={row.optionLabel} disabled={saving} onCommit={(t) => handleLabelBlur(row, t)} />
                </TableCell>
                <TableCell align="center">
                  <Switch size="small" checked={row.isActive} onChange={() => handleToggleActive(row)} disabled={saving} />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" color="error" onClick={() => handleDelete(row)} disabled={saving}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      <Dialog open={addOpen} onClose={() => !saving && setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add option — {displayName}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Stored value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              fullWidth
              size="small"
              helperText="Never change after data is saved (e.g. whatsapp)"
            />
            <TextField
              label="Display label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              fullWidth
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAdd} disabled={saving} startIcon={<SaveIcon />}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={5000} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity === 'info' ? 'info' : snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function EditableLabel({
  initial,
  disabled,
  onCommit,
}: {
  initial: string;
  disabled?: boolean;
  onCommit: (text: string) => void;
}) {
  const [val, setVal] = useState(initial);
  useEffect(() => setVal(initial), [initial]);
  return (
    <TextField
      size="small"
      fullWidth
      value={val}
      disabled={disabled}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onCommit(val)}
    />
  );
}
