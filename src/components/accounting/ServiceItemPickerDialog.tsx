'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Stack,
  Typography,
  IconButton,
  Avatar,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Grid,
  Divider,
  Badge,
  useTheme,
  Checkbox,
  Tooltip,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Hearing as HearingIcon,
  Biotech as BiotechIcon,
  MedicalServices as MedicalIcon,
  AddCircle as AddCircleIcon,
  Category as CategoryIcon,
  Check as CheckIcon,
  Bookmark as BookmarkIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import type { ServiceCatalog, ServiceCatalogItem } from '@/lib/accounting/serviceCatalog';
import {
  addCustomCatalogItem,
  deleteCustomCatalogItem,
  fetchServiceCatalog,
  updateCustomCatalogItem,
} from '@/lib/accounting/serviceCatalog';
import { formatINR } from '@/lib/accounting/computations';

type Props = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  onPick: (items: ServiceCatalogItem[]) => void;
};

type TabKey = 'hearing_aid' | 'test' | 'ent' | 'custom';

const KIND_META: Record<
  TabKey,
  { color: string; label: string; icon: React.ReactNode }
> = {
  hearing_aid: { color: '#1976d2', label: 'Hearing Aid', icon: <HearingIcon fontSize="small" /> },
  test: { color: '#7b1fa2', label: 'Test', icon: <BiotechIcon fontSize="small" /> },
  ent: { color: '#00897b', label: 'ENT', icon: <MedicalIcon fontSize="small" /> },
  custom: { color: '#ef6c00', label: 'Custom', icon: <BookmarkIcon fontSize="small" /> },
};

type CustomDraft = {
  editingId: string | null;
  name: string;
  hsnSac: string;
  gstPercent: number;
  suggestedRate: number;
};

const emptyDraft: CustomDraft = {
  editingId: null,
  name: '',
  hsnSac: '',
  gstPercent: 18,
  suggestedRate: 0,
};

export default function ServiceItemPickerDialog({ open, onClose, companyId, onPick }: Props) {
  const theme = useTheme();
  const [tab, setTab] = useState<TabKey>('hearing_aid');
  const [catalog, setCatalog] = useState<ServiceCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<Record<string, ServiceCatalogItem>>({});
  const [draft, setDraft] = useState<CustomDraft>(emptyDraft);
  const [savingDraft, setSavingDraft] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  const reload = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const c = await fetchServiceCatalog(companyId);
      setCatalog(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !companyId) return;
    setSelection({});
    setSearch('');
    setDraft(emptyDraft);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companyId]);

  const activeList: ServiceCatalogItem[] = useMemo(() => {
    if (!catalog) return [];
    if (tab === 'hearing_aid') return catalog.hearingAids;
    if (tab === 'test') return catalog.tests;
    if (tab === 'ent') return catalog.entProcedures;
    return catalog.custom;
  }, [catalog, tab]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return activeList;
    return activeList.filter(
      (i) =>
        i.name.toLowerCase().includes(s) ||
        (i.company || '').toLowerCase().includes(s) ||
        (i.productType || '').toLowerCase().includes(s) ||
        (i.hsnSac || '').toLowerCase().includes(s),
    );
  }, [activeList, search]);

  const toggle = (item: ServiceCatalogItem) => {
    setSelection((s) => {
      const next = { ...s };
      if (next[item.key]) delete next[item.key];
      else next[item.key] = item;
      return next;
    });
  };

  const selectedCount = Object.keys(selection).length;

  const handleConfirm = () => {
    onPick(Object.values(selection));
    onClose();
  };

  const counts = {
    hearing_aid: catalog?.hearingAids.length || 0,
    test: catalog?.tests.length || 0,
    ent: catalog?.entProcedures.length || 0,
    custom: catalog?.custom.length || 0,
  };

  const startEditCustom = (it: ServiceCatalogItem) => {
    if (!it.customId) return;
    setDraft({
      editingId: it.customId,
      name: it.name,
      hsnSac: it.hsnSac || '',
      gstPercent: it.gstPercent,
      suggestedRate: it.suggestedRate,
    });
  };

  const resetDraft = () => setDraft(emptyDraft);

  const saveDraft = async () => {
    if (!draft.name.trim()) {
      setSnack({ msg: 'Name is required', sev: 'error' });
      return;
    }
    setSavingDraft(true);
    try {
      if (draft.editingId) {
        await updateCustomCatalogItem(draft.editingId, {
          name: draft.name,
          hsnSac: draft.hsnSac,
          gstPercent: draft.gstPercent,
          suggestedRate: draft.suggestedRate,
        });
        setSnack({ msg: 'Updated', sev: 'success' });
      } else {
        await addCustomCatalogItem(companyId, {
          name: draft.name,
          hsnSac: draft.hsnSac,
          gstPercent: draft.gstPercent,
          suggestedRate: draft.suggestedRate,
        });
        setSnack({ msg: 'Added to catalog', sev: 'success' });
      }
      resetDraft();
      await reload();
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Save failed', sev: 'error' });
    } finally {
      setSavingDraft(false);
    }
  };

  const deleteCustom = async (it: ServiceCatalogItem) => {
    if (!it.customId) return;
    if (!confirm(`Delete "${it.name}" from your custom catalog?`)) return;
    try {
      await deleteCustomCatalogItem(it.customId);
      setSelection((s) => {
        const next = { ...s };
        delete next[it.key];
        return next;
      });
      setSnack({ msg: 'Deleted', sev: 'success' });
      await reload();
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Delete failed', sev: 'error' });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', height: '88vh' } }}
    >
      <Box
        sx={{
          position: 'relative',
          px: 3,
          pt: 2.5,
          pb: 2,
          color: '#fff',
          background: `linear-gradient(135deg, #6a1b9a 0%, #4527a0 55%, #1a237e 100%)`,
        }}
      >
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', top: 8, right: 8, color: 'rgba(255,255,255,0.85)' }}
          size="small"
        >
          <CloseIcon />
        </IconButton>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', width: 48, height: 48 }}>
            <CategoryIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Add Service Items
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Pick from products, tests, ENT procedures or your own custom catalog.
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ bgcolor: 'grey.100', px: 2, pt: 1 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{ minHeight: 44 }}
        >
          {(['hearing_aid', 'test', 'ent', 'custom'] as TabKey[]).map((k) => (
            <Tab
              key={k}
              value={k}
              iconPosition="start"
              icon={KIND_META[k].icon}
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>{KIND_META[k].label}s</span>
                  <Chip size="small" label={counts[k]} sx={{ height: 18, fontSize: 11 }} />
                </Stack>
              }
              sx={{ textTransform: 'none', minHeight: 44 }}
            />
          ))}
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 2, bgcolor: 'grey.50', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {tab === 'custom' && (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 1.5,
              borderRadius: 2,
              borderColor: KIND_META.custom.color,
              borderStyle: 'dashed',
              bgcolor: `${KIND_META.custom.color}08`,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" mb={1.25}>
              <Avatar
                variant="rounded"
                sx={{ bgcolor: `${KIND_META.custom.color}22`, color: KIND_META.custom.color, width: 32, height: 32 }}
              >
                {draft.editingId ? <EditIcon fontSize="small" /> : <AddIcon fontSize="small" />}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  {draft.editingId ? 'Edit custom item' : 'Add a new custom item'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Stored per company and reusable across future invoices.
                </Typography>
              </Box>
              {draft.editingId && (
                <Button size="small" onClick={resetDraft} sx={{ textTransform: 'none' }}>
                  Cancel edit
                </Button>
              )}
            </Stack>
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={5}>
                <TextField
                  size="small"
                  fullWidth
                  label="Item Name"
                  placeholder="e.g. Home Visit Consultation"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField
                  size="small"
                  fullWidth
                  label="HSN/SAC"
                  value={draft.hsnSac}
                  onChange={(e) => setDraft((d) => ({ ...d, hsnSac: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField
                  size="small"
                  select
                  fullWidth
                  label="GST %"
                  value={draft.gstPercent}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, gstPercent: Number(e.target.value) }))
                  }
                  SelectProps={{ native: true }}
                >
                  {[0, 5, 12, 18, 28].map((g) => (
                    <option key={g} value={g}>
                      {g}%
                    </option>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField
                  size="small"
                  type="number"
                  fullWidth
                  label="Default Rate"
                  value={draft.suggestedRate}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, suggestedRate: Number(e.target.value) }))
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography fontWeight={700}>&#8377;</Typography>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={6} md={1}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={saveDraft}
                  disabled={savingDraft}
                  startIcon={<SaveIcon />}
                  sx={{
                    textTransform: 'none',
                    borderRadius: 2,
                    height: 40,
                    bgcolor: KIND_META.custom.color,
                    '&:hover': { bgcolor: '#e65100' },
                  }}
                >
                  {savingDraft ? '…' : draft.editingId ? 'Save' : 'Add'}
                </Button>
              </Grid>
            </Grid>
          </Paper>
        )}

        <TextField
          size="small"
          fullWidth
          placeholder={
            tab === 'hearing_aid'
              ? 'Search by product name, company, type or HSN'
              : tab === 'custom'
              ? 'Search your custom catalog'
              : 'Search by name'
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 1.5, bgcolor: '#fff', borderRadius: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        {loading ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : filtered.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 1,
              p: 4,
              borderRadius: 2,
            }}
          >
            <Avatar sx={{ bgcolor: 'grey.200' }}>{KIND_META[tab].icon}</Avatar>
            <Typography color="text.secondary" variant="body2" textAlign="center">
              {activeList.length === 0
                ? tab === 'hearing_aid'
                  ? 'No products found. Add hearing aids in the Products module.'
                  : tab === 'custom'
                  ? 'No custom items yet. Use the form above to add one.'
                  : 'No entries configured yet.'
                : 'No matches for your search.'}
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
            <Grid container spacing={1.25}>
              {filtered.map((item) => {
                const isSelected = !!selection[item.key];
                const meta = KIND_META[item.kind];
                return (
                  <Grid item xs={12} sm={6} key={item.key}>
                    <Paper
                      variant="outlined"
                      onClick={() => toggle(item)}
                      sx={{
                        p: 1.5,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.25,
                        borderRadius: 2,
                        borderColor: isSelected ? meta.color : undefined,
                        borderWidth: isSelected ? 2 : 1,
                        bgcolor: isSelected ? `${meta.color}0d` : '#fff',
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: meta.color, boxShadow: 1 },
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        size="small"
                        sx={{ p: 0.5, color: meta.color, '&.Mui-checked': { color: meta.color } }}
                      />
                      <Avatar
                        variant="rounded"
                        sx={{ bgcolor: `${meta.color}22`, color: meta.color, width: 36, height: 36 }}
                      >
                        {meta.icon}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography fontWeight={600} noWrap title={item.name} sx={{ flex: 1 }}>
                            {item.name}
                          </Typography>
                          {item.kind === 'custom' && (
                            <>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditCustom(item);
                                  }}
                                >
                                  <EditIcon fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void deleteCustom(item);
                                  }}
                                >
                                  <DeleteIcon fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Stack>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                          {item.company && (
                            <Chip size="small" label={item.company} sx={{ height: 20 }} />
                          )}
                          {item.productType && (
                            <Chip size="small" variant="outlined" label={item.productType} sx={{ height: 20 }} />
                          )}
                          {item.hsnSac && (
                            <Chip size="small" variant="outlined" label={`HSN ${item.hsnSac}`} sx={{ height: 20 }} />
                          )}
                          <Chip
                            size="small"
                            variant="outlined"
                            color="primary"
                            label={`${item.gstPercent}% GST`}
                            sx={{ height: 20 }}
                          />
                          {item.suggestedRate > 0 && (
                            <Chip
                              size="small"
                              color="success"
                              variant="outlined"
                              label={formatINR(item.suggestedRate)}
                              sx={{ height: 20, fontWeight: 600 }}
                            />
                          )}
                          {item.isFree && (
                            <Chip size="small" color="warning" label="FOC" sx={{ height: 20 }} />
                          )}
                        </Stack>
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}
      </DialogContent>

      <Divider />
      <Box
        sx={{
          px: 3,
          py: 2,
          bgcolor: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Badge badgeContent={selectedCount} color="primary" showZero={false}>
            <AddCircleIcon color="action" />
          </Badge>
          <Typography variant="body2" color="text.secondary">
            {selectedCount === 0
              ? 'Nothing selected yet'
              : `${selectedCount} item${selectedCount > 1 ? 's' : ''} ready to add`}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            startIcon={<CheckIcon />}
            sx={{ borderRadius: 2, textTransform: 'none', minWidth: 140 }}
          >
            Add {selectedCount || ''} to Invoice
          </Button>
        </Stack>
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={2500}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? <Alert severity={snack.sev}>{snack.msg}</Alert> : undefined}
      </Snackbar>
    </Dialog>
  );
}
