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
} from '@mui/icons-material';
import type { ServiceCatalog, ServiceCatalogItem } from '@/lib/accounting/serviceCatalog';
import { fetchServiceCatalog } from '@/lib/accounting/serviceCatalog';
import { formatINR } from '@/lib/accounting/computations';

type Props = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  onPick: (items: ServiceCatalogItem[]) => void;
};

const KIND_META: Record<
  ServiceCatalogItem['kind'],
  { color: string; label: string; icon: React.ReactNode }
> = {
  hearing_aid: { color: '#1976d2', label: 'Hearing Aid', icon: <HearingIcon fontSize="small" /> },
  test: { color: '#7b1fa2', label: 'Test', icon: <BiotechIcon fontSize="small" /> },
  ent: { color: '#00897b', label: 'ENT', icon: <MedicalIcon fontSize="small" /> },
};

export default function ServiceItemPickerDialog({ open, onClose, companyId, onPick }: Props) {
  const theme = useTheme();
  const [tab, setTab] = useState<'hearing_aid' | 'test' | 'ent'>('hearing_aid');
  const [catalog, setCatalog] = useState<ServiceCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<Record<string, ServiceCatalogItem>>({});

  useEffect(() => {
    if (!open || !companyId) return;
    let cancelled = false;
    setLoading(true);
    setSelection({});
    setSearch('');
    (async () => {
      try {
        const c = await fetchServiceCatalog(companyId);
        if (!cancelled) setCatalog(c);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, companyId]);

  const activeList: ServiceCatalogItem[] = useMemo(() => {
    if (!catalog) return [];
    if (tab === 'hearing_aid') return catalog.hearingAids;
    if (tab === 'test') return catalog.tests;
    return catalog.entProcedures;
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
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', height: '85vh' } }}
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
              Pick from your product catalog and test library.
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
          <Tab
            value="hearing_aid"
            iconPosition="start"
            icon={<HearingIcon fontSize="small" />}
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Hearing Aids</span>
                <Chip size="small" label={counts.hearing_aid} sx={{ height: 18, fontSize: 11 }} />
              </Stack>
            }
            sx={{ textTransform: 'none', minHeight: 44 }}
          />
          <Tab
            value="test"
            iconPosition="start"
            icon={<BiotechIcon fontSize="small" />}
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Tests</span>
                <Chip size="small" label={counts.test} sx={{ height: 18, fontSize: 11 }} />
              </Stack>
            }
            sx={{ textTransform: 'none', minHeight: 44 }}
          />
          <Tab
            value="ent"
            iconPosition="start"
            icon={<MedicalIcon fontSize="small" />}
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>ENT</span>
                <Chip size="small" label={counts.ent} sx={{ height: 18, fontSize: 11 }} />
              </Stack>
            }
            sx={{ textTransform: 'none', minHeight: 44 }}
          />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 2, bgcolor: 'grey.50', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TextField
          size="small"
          fullWidth
          placeholder={
            tab === 'hearing_aid'
              ? 'Search by product name, company, type or HSN'
              : 'Search by test / procedure name'
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
            <Typography color="text.secondary" variant="body2">
              {activeList.length === 0
                ? tab === 'hearing_aid'
                  ? 'No products found. Add hearing aids in the Products module.'
                  : 'No test types configured yet.'
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
                        '&:hover': {
                          borderColor: meta.color,
                          boxShadow: 1,
                        },
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        size="small"
                        sx={{
                          p: 0.5,
                          color: meta.color,
                          '&.Mui-checked': { color: meta.color },
                        }}
                      />
                      <Avatar
                        variant="rounded"
                        sx={{ bgcolor: `${meta.color}22`, color: meta.color, width: 36, height: 36 }}
                      >
                        {meta.icon}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={600} noWrap title={item.name}>
                          {item.name}
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                          {item.company && (
                            <Chip size="small" label={item.company} sx={{ height: 20 }} />
                          )}
                          {item.productType && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={item.productType}
                              sx={{ height: 20 }}
                            />
                          )}
                          {item.hsnSac && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`HSN ${item.hsnSac}`}
                              sx={{ height: 20 }}
                            />
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
    </Dialog>
  );
}
