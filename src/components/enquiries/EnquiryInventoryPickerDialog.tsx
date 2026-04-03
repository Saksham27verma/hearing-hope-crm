'use client';

import React, { useCallback, useEffect, useMemo, useState, memo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  InputAdornment,
  Button,
  Stack,
  Chip,
  IconButton,
  Fade,
  useTheme,
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Search as SearchIcon,
  Business as BusinessIcon,
  Category as CategoryIcon,
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import type { EnquiryInventoryRow } from './enquiryInventoryUtils';
import { resolveGstFromProductMaster } from './enquiryInventoryUtils';

export type InventoryPickerMode = 'hearing_device' | 'accessory';

export type EnquiryInventoryPickerDialogProps = {
  open: boolean;
  onClose: () => void;
  items: EnquiryInventoryRow[];
  mode: InventoryPickerMode;
  selectedInventoryId?: string;
  formatCurrency: (n: number) => string;
  onSelectItem: (item: EnquiryInventoryRow) => void;
};

const FONT_STACK = 'var(--font-inter), Inter, system-ui, -apple-system, sans-serif';

/** Qty-only rows: avoid "Bulk" for serial-tracked products (those are unit counts without serial # on file). */
function quantityRowChipLabel(item: EnquiryInventoryRow): string {
  const q = item.quantity;
  if (q == null || !Number.isFinite(Number(q))) return '';
  const n = Math.floor(Number(q));
  if (n < 1) return '';
  if (item.productHasSerialNumber) return `Units × ${n}`;
  return `Bulk × ${n}`;
}

function getInventoryByCompany(list: EnquiryInventoryRow[]) {
  const companyGroups: Record<string, EnquiryInventoryRow[]> = {};
  list.forEach((item) => {
    const company = item.company || 'Unknown Company';
    if (!companyGroups[company]) companyGroups[company] = [];
    companyGroups[company].push(item);
  });
  return companyGroups;
}

function getModelsByCompany(list: EnquiryInventoryRow[], company: string) {
  const modelGroups: Record<string, EnquiryInventoryRow[]> = {};
  list
    .filter((item) => (item.company || 'Unknown Company') === company)
    .forEach((item) => {
      const model = item.productName || 'Unknown Model';
      if (!modelGroups[model]) modelGroups[model] = [];
      modelGroups[model].push(item);
    });
  return modelGroups;
}

function filterInventory(list: EnquiryInventoryRow[], term: string) {
  if (!term.trim()) return list;
  const q = term.toLowerCase();
  return list.filter(
    (item) =>
      item.productName?.toLowerCase().includes(q) ||
      item.company?.toLowerCase().includes(q) ||
      item.serialNumber?.toLowerCase().includes(q) ||
      item.location?.toLowerCase().includes(q) ||
      String(item.locationId || '')
        .toLowerCase()
        .includes(q)
  );
}

/** Group by stable center id; section title uses resolved display name from each row. */
function groupItemsByLocation(rows: EnquiryInventoryRow[]): [string, EnquiryInventoryRow[]][] {
  const m = new Map<string, { label: string; rows: EnquiryInventoryRow[] }>();
  rows.forEach((item) => {
    const id = String(item.locationId || item.location || '').trim() || 'unknown';
    const label = String(item.location || item.locationId || 'Unknown location').trim();
    if (!m.has(id)) m.set(id, { label, rows: [] });
    m.get(id)!.rows.push(item);
  });
  return Array.from(m.values())
    .map((v) => [v.label, v.rows] as [string, EnquiryInventoryRow[]])
    .sort(([a], [b]) => a.localeCompare(b));
}

const GstStatusChip = memo(function GstStatusChip({ item }: { item: EnquiryInventoryRow }) {
  const { gstApplicable, gstPercent } = resolveGstFromProductMaster(item);
  if (!gstApplicable) {
    return (
      <Chip
        size="small"
        label="GST exempt"
        sx={{
          height: 26,
          fontWeight: 600,
          fontSize: '0.75rem',
          letterSpacing: '0.01em',
          bgcolor: 'rgba(16, 185, 129, 0.14)',
          color: '#047857',
          border: '1px solid rgba(16, 185, 129, 0.38)',
          '& .MuiChip-label': { px: 1.25 },
        }}
      />
    );
  }
  return (
    <Chip
      size="small"
      label={`GST ${gstPercent}%`}
      variant="outlined"
      sx={{
        height: 26,
        fontWeight: 600,
        fontSize: '0.75rem',
        borderColor: 'rgba(59, 130, 246, 0.35)',
        color: 'primary.dark',
        bgcolor: 'rgba(59, 130, 246, 0.06)',
      }}
    />
  );
});

const tileTransition =
  'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.22s ease, border-color 0.22s ease';

type TileProps = {
  children: React.ReactNode;
  onClick: () => void;
  selected?: boolean;
  isDark: boolean;
};

const InteractiveTile = memo(function InteractiveTile({ children, onClick, selected, isDark }: TileProps) {
  return (
    <Box
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        cursor: 'pointer',
        borderRadius: '14px',
        border: selected
          ? '1px solid rgba(59, 130, 246, 0.55)'
          : isDark
            ? '1px solid rgba(255,255,255,0.08)'
            : '1px solid rgba(0, 0, 0, 0.05)',
        bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
        boxShadow: isDark
          ? '0 1px 3px rgba(0,0,0,0.25)'
          : '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        transition: tileTransition,
        outline: 'none',
        '&:hover': {
          transform: 'scale(1.02)',
          borderColor: 'rgba(59, 130, 246, 0.45)',
          boxShadow: isDark
            ? '0 0 0 1px rgba(96, 165, 250, 0.35), 0 20px 40px rgba(0,0,0,0.35)'
            : '0 0 0 1px rgba(59, 130, 246, 0.35), 0 16px 48px rgba(59, 130, 246, 0.14), 0 8px 24px rgba(15, 23, 42, 0.08)',
        },
        ...(selected && {
          bgcolor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.06)',
        }),
      }}
    >
      {children}
    </Box>
  );
});

const MrpText = memo(function MrpText({
  amount,
  formatCurrency,
}: {
  amount: number;
  formatCurrency: (n: number) => string;
}) {
  return (
    <Typography
      component="span"
      sx={{
        fontWeight: 600,
        fontSize: '1.0625rem',
        letterSpacing: '-0.02em',
        color: 'text.primary',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {formatCurrency(amount)}
    </Typography>
  );
});

export default function EnquiryInventoryPickerDialog({
  open,
  onClose,
  items,
  mode,
  selectedInventoryId,
  formatCurrency,
  onSelectItem,
}: EnquiryInventoryPickerDialogProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [serialDetail, setSerialDetail] = useState<{ company: string; model: string } | null>(null);
  const [detailEnter, setDetailEnter] = useState(false);

  useEffect(() => {
    if (!open) {
      setInventorySearchTerm('');
      setSelectedCompany('');
      setSerialDetail(null);
      setDetailEnter(false);
    }
  }, [open]);

  useEffect(() => {
    if (inventorySearchTerm.trim()) setSerialDetail(null);
  }, [inventorySearchTerm]);

  useEffect(() => {
    if (serialDetail) {
      const id = requestAnimationFrame(() => setDetailEnter(true));
      return () => cancelAnimationFrame(id);
    }
    setDetailEnter(false);
  }, [serialDetail]);

  const byCompany = useMemo(() => getInventoryByCompany(items), [items]);
  const modelsForCompany = useMemo(
    () => (selectedCompany ? getModelsByCompany(items, selectedCompany) : {}),
    [items, selectedCompany]
  );
  const filtered = useMemo(
    () => filterInventory(items, inventorySearchTerm),
    [items, inventorySearchTerm]
  );

  const detailRows = useMemo(() => {
    if (!serialDetail) return [];
    const map = getModelsByCompany(items, serialDetail.company);
    return map[serialDetail.model] || [];
  }, [items, serialDetail]);

  const detailByLocation = useMemo(() => groupItemsByLocation(detailRows), [detailRows]);

  const handleSelect = useCallback(
    (row: EnquiryInventoryRow) => {
      onSelectItem(row);
      onClose();
    },
    [onSelectItem, onClose]
  );

  const openSerialDetail = useCallback((company: string, model: string) => {
    setSerialDetail({ company, model });
  }, []);

  const closeSerialDetail = useCallback(() => {
    setDetailEnter(false);
    setSerialDetail(null);
  }, []);

  const title = mode === 'accessory' ? 'Accessory stock' : 'Devices & serial stock';
  const subtitle =
    mode === 'accessory'
      ? `${items.length} line${items.length === 1 ? '' : 's'} available`
      : `${items.length} line${items.length === 1 ? '' : 's'} available`;

  const canvasBg = isDark ? '#18181b' : '#f8fafc';
  const paperBg = isDark ? 'rgba(24, 24, 27, 0.98)' : '#ffffff';

  /** Fixed below title; scrollable body lives in a sibling so overflow works inside max-height dialog. */
  const searchBarSx = {
    flexShrink: 0,
    px: 3,
    pt: 2,
    pb: 2,
    backgroundColor: paperBg,
    borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.05)',
  };

  const renderSearchResults = () => (
    <Box sx={{ px: 3, pb: 3, pt: 1 }}>
      <Typography
        variant="caption"
        sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: '0.04em', textTransform: 'uppercase' }}
      >
        {filtered.length} result{filtered.length === 1 ? '' : 's'}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mt: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        }}
      >
        {filtered.map((item) => {
          const selected = selectedInventoryId === item.id;
          const qtyLabel = quantityRowChipLabel(item);
          return (
            <InteractiveTile
              key={item.id}
              selected={selected}
              isDark={isDark}
              onClick={() => handleSelect(item)}
            >
              <Box sx={{ p: 2.25 }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.35 }} noWrap title={item.productName}>
                      {item.productName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
                      {item.company}
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.25 }}>
                      {item.serialNumber && (
                        <Chip label={item.serialNumber} size="small" sx={{ height: 24, fontWeight: 600, fontSize: '0.7rem' }} />
                      )}
                      {!item.serialNumber && item.quantity != null && qtyLabel && (
                        <Chip label={qtyLabel} size="small" sx={{ height: 24, fontWeight: 600 }} />
                      )}
                      <GstStatusChip item={item} />
                    </Stack>
                  </Box>
                  <MrpText amount={item.mrp || 0} formatCurrency={formatCurrency} />
                </Stack>
              </Box>
            </InteractiveTile>
          );
        })}
      </Box>
    </Box>
  );

  const renderBrowsePanel = () => (
    <Box
      sx={{
        minHeight: 400,
        px: 3,
        pb: 3,
        pt: 1,
        bgcolor: canvasBg,
        fontFamily: FONT_STACK,
      }}
    >
      {!selectedCompany ? (
        <>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '0.8125rem',
              color: 'text.secondary',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <BusinessIcon sx={{ fontSize: 18, opacity: 0.7 }} />
            Brands ({Object.keys(byCompany).length})
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            }}
          >
            {Object.entries(byCompany).map(([company, invItems]) => (
              <InteractiveTile key={company} isDark={isDark} onClick={() => setSelectedCompany(company)}>
                <Box sx={{ p: 2.5, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '12px',
                      mx: 'auto',
                      mb: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                      color: 'primary.main',
                    }}
                  >
                    <BusinessIcon />
                  </Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem' }}>{company}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {invItems.length} SKU{invItems.length === 1 ? '' : 's'}
                  </Typography>
                </Box>
              </InteractiveTile>
            ))}
          </Box>
        </>
      ) : (
        <>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: '0.8125rem',
                color: 'text.secondary',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <CategoryIcon sx={{ fontSize: 18, opacity: 0.7 }} />
              {selectedCompany}
            </Typography>
            <Button
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={() => setSelectedCompany('')}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '10px',
                color: 'text.secondary',
              }}
            >
              Brands
            </Button>
          </Stack>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
            {Object.entries(modelsForCompany).map(([model, invItems]) => (
              <InteractiveTile key={model} isDark={isDark} onClick={() => openSerialDetail(selectedCompany, model)}>
                <Box sx={{ p: 2.25 }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem' }} noWrap title={model}>
                        {model}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {invItems.length} unit{invItems.length === 1 ? '' : 's'} · Select serial
                      </Typography>
                      {invItems[0] && (
                        <Box sx={{ mt: 1.25 }}>
                          <GstStatusChip item={invItems[0]} />
                        </Box>
                      )}
                    </Box>
                    <MrpText amount={invItems[0]?.mrp || 0} formatCurrency={formatCurrency} />
                  </Stack>
                </Box>
              </InteractiveTile>
            ))}
          </Box>
        </>
      )}
    </Box>
  );

  const renderSerialDetailPanel = () => {
    if (!serialDetail) return null;
    const sample = detailRows[0] as EnquiryInventoryRow | undefined;
    return (
      <Box
        sx={{
          minHeight: 400,
          px: 3,
          pb: 3,
          pt: 1,
          bgcolor: canvasBg,
          fontFamily: FONT_STACK,
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2} sx={{ mb: 2.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Button
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={closeSerialDetail}
              sx={{ mb: 1.5, textTransform: 'none', fontWeight: 600, borderRadius: '10px', color: 'text.secondary' }}
            >
              Models
            </Button>
            <Fade in={detailEnter} timeout={280}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                  {serialDetail.model}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {serialDetail.company}
                </Typography>
                <Stack direction="row" alignItems="center" gap={1.5} sx={{ mt: 1.5 }} flexWrap="wrap">
                  {sample && <GstStatusChip item={sample} />}
                  {sample && (
                    <Typography sx={{ fontWeight: 600, fontSize: '1.125rem', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(sample.mrp || 0)}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Fade>
          </Box>
        </Stack>

        <Fade in={detailEnter} timeout={360}>
          <Box>
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: '0.8125rem',
                color: 'text.secondary',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                mb: 2,
              }}
            >
              Select serial by location
            </Typography>
            {detailRows.length === 0 ? (
              <Typography color="text.secondary" variant="body2">
                No units found for this model.
              </Typography>
            ) : (
              <Stack spacing={3}>
                {detailByLocation.map(([location, rows]) => (
                  <Box key={location}>
                    <Typography
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        mb: 1.25,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {location}
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {rows.map((item) => {
                        const selected = selectedInventoryId === item.id;
                        const label = item.serialNumber?.trim()
                          ? item.serialNumber
                          : item.quantity != null
                            ? quantityRowChipLabel(item) || item.id
                            : item.id;
                        return (
                          <Chip
                            key={item.id}
                            label={label}
                            onClick={() => handleSelect(item)}
                            sx={{
                              height: 36,
                              fontWeight: 600,
                              fontSize: '0.8125rem',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              border: selected
                                ? '2px solid'
                                : isDark
                                  ? '1px solid rgba(255,255,255,0.12)'
                                  : '1px solid rgba(0,0,0,0.08)',
                              borderColor: selected ? 'primary.main' : undefined,
                              bgcolor: selected
                                ? isDark
                                  ? 'rgba(59, 130, 246, 0.2)'
                                  : 'rgba(59, 130, 246, 0.1)'
                                : isDark
                                  ? 'rgba(255,255,255,0.06)'
                                  : '#ffffff',
                              boxShadow: isDark ? 'none' : '0 1px 2px rgba(15,23,42,0.05)',
                              transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                              '&:hover': {
                                transform: 'scale(1.04)',
                                boxShadow: isDark
                                  ? '0 0 0 1px rgba(96, 165, 250, 0.4)'
                                  : '0 0 0 1px rgba(59, 130, 246, 0.35), 0 4px 14px rgba(59, 130, 246, 0.15)',
                              },
                            }}
                          />
                        );
                      })}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Fade>
      </Box>
    );
  };

  const searching = inventorySearchTerm.trim().length > 0;
  const detailOpen = serialDetail !== null && !searching;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(15, 23, 42, 0.25)',
            backdropFilter: 'blur(10px)',
          },
        },
      }}
      PaperProps={{
        elevation: 0,
        sx: {
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          overflow: 'hidden',
          maxHeight: '90vh',
          fontFamily: FONT_STACK,
          bgcolor: paperBg,
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0, 0, 0, 0.05)',
          boxShadow: isDark
            ? '0 25px 50px -12px rgba(0,0,0,0.55), 0 12px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)'
            : '0 25px 50px -12px rgba(15, 23, 42, 0.14), 0 12px 24px rgba(15, 23, 42, 0.1), 0 0 0 1px rgba(0,0,0,0.02)',
        },
      }}
    >
      <DialogTitle
        sx={{
          flexShrink: 0,
          py: 2.25,
          px: 3,
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.05)',
          bgcolor: paperBg,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.75}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                color: 'primary.main',
              }}
            >
              <InventoryIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.03em' }}>{title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.15, fontSize: '0.8125rem' }}>
                {subtitle}
              </Typography>
            </Box>
          </Stack>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              color: 'text.secondary',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)',
              borderRadius: '10px',
            }}
            aria-label="Close"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'hidden',
          bgcolor: paperBg,
        }}
      >
        <Box sx={searchBarSx}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search product, brand, serial, warehouse…"
            value={inventorySearchTerm}
            onChange={(e) => setInventorySearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                fontFamily: FONT_STACK,
                '& fieldset': {
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                },
                '&:hover fieldset': {
                  borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)',
                },
              },
            }}
          />
        </Box>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {items.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 10, px: 3, bgcolor: canvasBg }}>
              <InventoryIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 2, opacity: 0.5 }} />
              <Typography sx={{ fontWeight: 600, color: 'text.secondary' }}>Nothing in stock for this view</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Check center selection or add stock in inventory.
              </Typography>
            </Box>
          ) : searching ? (
            renderSearchResults()
          ) : (
            <Box sx={{ position: 'relative' }}>
              <Box
                sx={{
                  display: 'flex',
                  width: '200%',
                  transform: detailOpen ? 'translate3d(-50%, 0, 0)' : 'translate3d(0, 0, 0)',
                  transition: 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
                  willChange: 'transform',
                }}
              >
                <Box sx={{ width: '50%', flexShrink: 0, minHeight: 400 }}>{renderBrowsePanel()}</Box>
                <Box sx={{ width: '50%', flexShrink: 0, minHeight: 400 }}>
                  {serialDetail ? renderSerialDetailPanel() : null}
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          flexShrink: 0,
          px: 3,
          py: 2,
          borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.05)',
          bgcolor: paperBg,
        }}
      >
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 600,
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
