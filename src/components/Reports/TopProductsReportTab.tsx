/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

/**
 * Top Products report — ranks invoiced product lines by units sold / revenue.
 * Filters: date, center, salesperson, brand, product type.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  FormControl,
  Grid as MuiGrid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Download as DownloadIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { collection, getDocs } from 'firebase/firestore';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { db } from '@/firebase/config';
import EnquiryProfileLink from '@/components/common/EnquiryProfileLink';
import { buildUnifiedInvoiceRows } from '@/lib/sales-invoicing/mergeUnifiedRows';
import {
  type Center,
  type NormalizedSale,
  buildCenterResolveContext,
  mapUnifiedRowsToRecords,
} from '@/lib/sales-invoicing/salesReportNormalize';
import type { SaleRecord, UnifiedInvoiceRow } from '@/lib/sales-invoicing/types';
import {
  PRODUCT_SALE_TYPES,
  aggregateProductSales,
  buildProductCatalogMap,
  filterProductSaleLines,
  flattenProductSaleLines,
  type ProductAggregate,
  type ProductCatalogEntry,
  type ProductSaleLine,
} from '@/lib/sales-invoicing/productSalesAggregate';

const Grid = ({ children, ...props }: any) => <MuiGrid {...props}>{children}</MuiGrid>;

const CHART_COLORS = [
  '#1565c0',
  '#2e7d32',
  '#ed6c02',
  '#6a1b9a',
  '#00838f',
  '#c62828',
  '#455a64',
  '#5d4037',
  '#283593',
  '#00695c',
  '#f9a825',
  '#ad1457',
  '#37474f',
  '#0277bd',
  '#558b2f',
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);

const formatAxisInr = (n: number) => {
  if (!Number.isFinite(n)) return '0';
  const v = Math.abs(n);
  if (v >= 1e7) return `${(n / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return String(Math.round(n));
};

function getLocalMonthDateStrings() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastDay = new Date(y, m + 1, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    fromStr: `${y}-${pad(m + 1)}-01`,
    toStr: `${y}-${pad(m + 1)}-${pad(lastDay.getDate())}`,
  };
}

function escapeCsv(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, rows: string[][]) {
  const body = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function truncateLabel(s: string, max = 28): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function TopProductsReportTab() {
  const [dateFrom, setDateFrom] = useState(() => getLocalMonthDateStrings().fromStr);
  const [dateTo, setDateTo] = useState(() => getLocalMonthDateStrings().toStr);
  const [centerFilter, setCenterFilter] = useState<string>('all');
  const [execFilter, setExecFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('Hearing Aid');

  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [records, setRecords] = useState<NormalizedSale[]>([]);
  const [unifiedByRowId, setUnifiedByRowId] = useState<Map<string, UnifiedInvoiceRow>>(
    () => new Map(),
  );
  const [catalog, setCatalog] = useState<Map<string, ProductCatalogEntry>>(() => new Map());
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const dateFromObj = useMemo(
    () => (dateFrom ? new Date(`${dateFrom}T00:00:00`) : null),
    [dateFrom],
  );
  const dateToObj = useMemo(
    () => (dateTo ? new Date(`${dateTo}T23:59:59.999`) : null),
    [dateTo],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [centersSnap, salesSnap, enquiriesSnap, productsSnap] = await Promise.all([
        getDocs(collection(db, 'centers')),
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'enquiries')),
        getDocs(collection(db, 'products')),
      ]);

      const centersList: Center[] = centersSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setCenters(centersList);
      const resolveCtx = buildCenterResolveContext(centersList);

      const enquiryDocs = enquiriesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const enquiryById = new Map<string, any>(enquiryDocs.map((e) => [e.id, e]));

      const saleRecords: SaleRecord[] = salesSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as object),
      })) as SaleRecord[];

      const unified = buildUnifiedInvoiceRows(saleRecords, []);
      const mapped = mapUnifiedRowsToRecords(unified, resolveCtx, enquiryById);
      setRecords(mapped);
      setUnifiedByRowId(new Map(unified.map((r) => [r.rowId, r])));

      const catalogEntries: ProductCatalogEntry[] = productsSnap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: data.name != null ? String(data.name) : undefined,
          type: data.type != null ? String(data.type) : undefined,
          company: data.company != null ? String(data.company) : undefined,
        };
      });
      setCatalog(buildProductCatalogMap(catalogEntries));
    } catch (err) {
      console.error('Failed to fetch top products report:', err);
      setRecords([]);
      setUnifiedByRowId(new Map());
      setCatalog(new Map());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const allLines = useMemo(
    () => flattenProductSaleLines(records, unifiedByRowId, catalog),
    [records, unifiedByRowId, catalog],
  );

  const filteredLines = useMemo(
    () =>
      filterProductSaleLines(allLines, {
        dateFrom: dateFromObj,
        dateTo: dateToObj,
        centerKey: centerFilter,
        executiveName: execFilter,
        company: companyFilter,
        productType: typeFilter,
      }),
    [allLines, dateFromObj, dateToObj, centerFilter, execFilter, companyFilter, typeFilter],
  );

  const aggregates = useMemo(() => aggregateProductSales(filteredLines), [filteredLines]);

  const centerOptions = useMemo(() => {
    const opts = centers
      .map((c) => ({ key: c.id, label: (c.name || c.id).toString() }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [centers]);

  const execOptions = useMemo(() => {
    const names = new Set<string>();
    for (const line of allLines) {
      if (line.executiveName && line.executiveName !== '—') names.add(line.executiveName);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [allLines]);

  const companyOptions = useMemo(() => {
    const names = new Set<string>();
    for (const line of allLines) {
      if (line.company) names.add(line.company);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [allLines]);

  const typeOptions = useMemo(() => {
    const fromData = new Set<string>(PRODUCT_SALE_TYPES);
    for (const line of allLines) {
      if (line.productType) fromData.add(line.productType);
    }
    return [...fromData].sort((a, b) => a.localeCompare(b));
  }, [allLines]);

  const summary = useMemo(() => {
    const totalUnits = aggregates.reduce((s, a) => s + a.unitsSold, 0);
    const totalRevenue = aggregates.reduce((s, a) => s + a.revenue, 0);
    const top = aggregates[0] ?? null;
    return {
      totalUnits,
      distinctProducts: aggregates.length,
      totalRevenue,
      topProductName: top?.productName ?? null,
      topProductUnits: top?.unitsSold ?? 0,
    };
  }, [aggregates]);

  const chartData = useMemo(() => {
    return aggregates.slice(0, 12).map((a) => ({
      key: a.productKey,
      label: truncateLabel(a.productName, 22),
      labelFull: a.company ? `${a.productName} (${a.company})` : a.productName,
      units: a.unitsSold,
      revenue: a.revenue,
    }));
  }, [aggregates]);

  const handleExportCsv = () => {
    const header = [
      'Rank',
      'Product',
      'Brand',
      'Type',
      'Units Sold',
      'Invoices',
      'Revenue (pre-GST)',
      'Avg Selling Price',
    ];
    const rows: string[][] = [header];
    aggregates.forEach((a, i) => {
      rows.push([
        String(i + 1),
        a.productName,
        a.company || '',
        a.productType,
        String(a.unitsSold),
        String(a.invoiceCount),
        String(Math.round(a.revenue)),
        String(Math.round(a.avgSellingPrice)),
      ]);
    });
    rows.push([]);
    rows.push(['Detail lines']);
    rows.push([
      'Product',
      'Brand',
      'Date',
      'Center',
      'Sold By',
      'Patient',
      'Invoice',
      'Serial',
      'Qty',
      'Revenue',
    ]);
    for (const a of aggregates) {
      for (const line of a.lines) {
        rows.push([
          a.productName,
          a.company || '',
          line.saleDate.toLocaleDateString('en-IN'),
          line.centerName,
          line.executiveName,
          line.patientName,
          line.invoiceNumber || '',
          line.serialNumber || '',
          String(line.quantity),
          String(Math.round(line.revenue)),
        ]);
      }
    }
    const stamp = `${dateFrom || 'start'}_to_${dateTo || 'end'}`;
    downloadCsv(`top-products-${stamp}.csv`, rows);
  };

  const toggleExpand = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="From"
              type="date"
              size="small"
              fullWidth
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="To"
              type="date"
              size="small"
              fullWidth
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl size="small" fullWidth>
              <InputLabel id="top-prod-center-label">Center</InputLabel>
              <Select
                labelId="top-prod-center-label"
                label="Center"
                value={centerFilter}
                onChange={(e) => setCenterFilter(e.target.value)}
              >
                <MenuItem value="all">All centers</MenuItem>
                {centerOptions.map((c) => (
                  <MenuItem key={c.key} value={c.key}>
                    {c.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl size="small" fullWidth>
              <InputLabel id="top-prod-exec-label">Sold by</InputLabel>
              <Select
                labelId="top-prod-exec-label"
                label="Sold by"
                value={execFilter}
                onChange={(e) => setExecFilter(e.target.value)}
              >
                <MenuItem value="all">All salespeople</MenuItem>
                {execOptions.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl size="small" fullWidth>
              <InputLabel id="top-prod-brand-label">Brand</InputLabel>
              <Select
                labelId="top-prod-brand-label"
                label="Brand"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
              >
                <MenuItem value="all">All brands</MenuItem>
                {companyOptions.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl size="small" fullWidth>
              <InputLabel id="top-prod-type-label">Product type</InputLabel>
              <Select
                labelId="top-prod-type-label"
                label="Product type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <MenuItem value="all">All types</MenuItem>
                {typeOptions.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => void fetchData()}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleExportCsv}
              disabled={loading || aggregates.length === 0}
            >
              Export CSV
            </Button>
            <Chip
              size="small"
              label={`${filteredLines.length} line${filteredLines.length === 1 ? '' : 's'}`}
              sx={{ alignSelf: 'center' }}
            />
          </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  Units sold
                </Typography>
                <Typography variant="h5" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {summary.totalUnits.toLocaleString('en-IN')}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  Distinct products
                </Typography>
                <Typography variant="h5" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {summary.distinctProducts.toLocaleString('en-IN')}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  Revenue (pre-GST)
                </Typography>
                <Typography variant="h5" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(summary.totalRevenue)}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  Top seller
                </Typography>
                <Typography variant="subtitle1" fontWeight={700} noWrap title={summary.topProductName || undefined}>
                  {summary.topProductName || '—'}
                </Typography>
                {summary.topProductName ? (
                  <Typography variant="caption" color="text.secondary">
                    {summary.topProductUnits.toLocaleString('en-IN')} units
                  </Typography>
                ) : null}
              </Paper>
            </Grid>
          </Grid>

          {chartData.length > 0 ? (
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                Top products by units sold
              </Typography>
              <Box sx={{ width: '100%', height: Math.max(280, chartData.length * 36) }}>
                <ResponsiveContainer>
                  <BarChart
                    layout="vertical"
                    data={chartData}
                    margin={{ top: 8, right: 48, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tickFormatter={(v) => String(v)} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={140}
                      tick={{ fontSize: 12 }}
                    />
                    <RechartsTooltip
                      formatter={(value: any, name: any) => {
                        if (name === 'units') return [value, 'Units'];
                        if (name === 'revenue') return [formatCurrency(Number(value)), 'Revenue'];
                        return [value, name];
                      }}
                      labelFormatter={(_, payload) => {
                        const row = payload?.[0]?.payload as { labelFull?: string } | undefined;
                        return row?.labelFull || '';
                      }}
                    />
                    <Bar dataKey="units" name="units" radius={[0, 4, 4, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={chartData[i].key} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                      <LabelList dataKey="units" position="right" style={{ fontSize: 12 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Showing top {chartData.length} of {aggregates.length} products
                {summary.totalRevenue > 0
                  ? ` · combined revenue ${formatAxisInr(summary.totalRevenue)}`
                  : ''}
              </Typography>
            </Paper>
          ) : null}

          <Paper variant="outlined">
            <TableContainer sx={{ maxHeight: 560 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={48} />
                    <TableCell width={56}>Rank</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Brand</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Units</TableCell>
                    <TableCell align="right">Invoices</TableCell>
                    <TableCell align="right">Revenue</TableCell>
                    <TableCell align="right">Avg price</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {aggregates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          No product sales found for the selected filters.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    aggregates.map((agg, index) => (
                      <ProductRankRows
                        key={agg.productKey}
                        agg={agg}
                        rank={index + 1}
                        expanded={expandedKey === agg.productKey}
                        onToggle={() => toggleExpand(agg.productKey)}
                      />
                    ))
                  )}
                  {aggregates.length > 0 ? (
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell />
                      <TableCell />
                      <TableCell colSpan={3}>
                        <Typography variant="subtitle2" fontWeight={700}>
                          Total
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {summary.totalUnits.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell />
                      <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(summary.totalRevenue)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
}

function ProductRankRows({
  agg,
  rank,
  expanded,
  onToggle,
}: {
  agg: ProductAggregate;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow
        hover
        onClick={onToggle}
        sx={{ cursor: 'pointer', '& > *': { borderBottom: expanded ? 'none' : undefined } }}
      >
        <TableCell padding="checkbox">
          <IconButton size="small" aria-label={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{rank}</TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={600}>
            {agg.productName}
          </Typography>
        </TableCell>
        <TableCell>{agg.company || '—'}</TableCell>
        <TableCell>
          <Chip size="small" label={agg.productType} variant="outlined" />
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {agg.unitsSold.toLocaleString('en-IN')}
        </TableCell>
        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {agg.invoiceCount.toLocaleString('en-IN')}
        </TableCell>
        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(agg.revenue)}
        </TableCell>
        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(agg.avgSellingPrice)}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={9} sx={{ py: 0, borderBottom: expanded ? undefined : 'none' }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ py: 1.5, px: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Sale lines ({agg.lines.length})
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Center</TableCell>
                    <TableCell>Sold by</TableCell>
                    <TableCell>Patient</TableCell>
                    <TableCell>Invoice</TableCell>
                    <TableCell>Serial</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {agg.lines.map((line: ProductSaleLine, i: number) => (
                    <TableRow key={`${line.rowId}-${i}`}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {line.saleDate.toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell>{line.centerName}</TableCell>
                      <TableCell>{line.executiveName}</TableCell>
                      <TableCell>
                        {line.enquiryId ? (
                          <EnquiryProfileLink enquiryId={line.enquiryId}>
                            {line.patientName}
                          </EnquiryProfileLink>
                        ) : (
                          line.patientName
                        )}
                      </TableCell>
                      <TableCell>{line.invoiceNumber || '—'}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {line.serialNumber || '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {line.quantity}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(line.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}
