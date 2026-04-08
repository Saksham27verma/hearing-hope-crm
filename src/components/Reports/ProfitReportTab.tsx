'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControl,
  Grid as MuiGrid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Download as DownloadIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { deriveEnquirySalesFromDocs } from '@/lib/sales-invoicing/enquiryDerivation';
import { buildUnifiedInvoiceRows } from '@/lib/sales-invoicing/mergeUnifiedRows';
import {
  type Center,
  type NormalizedSale,
  buildCenterResolveContext,
  getProductLinesForUnifiedRow,
  mapUnifiedRowsToRecords,
} from '@/lib/sales-invoicing/salesReportNormalize';
import type { SaleRecord } from '@/lib/sales-invoicing/types';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

const Grid = ({ children, ...props }: any) => <MuiGrid {...props}>{children}</MuiGrid>;

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

/** Line series: margin % of serial-level selling (parallel to Sales Report discount % line). */
const MARGIN_PCT_COLOR = '#1565c0';

type ProfitChartRow = {
  filterKey: string;
  label: string;
  labelFull: string;
  profit: number;
  marginPct?: number;
  selling: number;
  dealerCost: number;
  resolvedSerials: number;
  unresolvedSerials: number;
};

function ProfitCompetitiveChart({
  rows,
  gradientId,
  title,
  subtitle,
  accent = 'center',
  selectedFilterKey,
  onBarClick,
}: {
  rows: ProfitChartRow[];
  gradientId: string;
  title: string;
  subtitle: string;
  accent?: 'center' | 'executive' | 'source';
  selectedFilterKey?: string;
  onBarClick?: (filterKey: string) => void;
}) {
  if (!rows.length) return null;
  const tilt = rows.length > 5;
  const showValueLabels = rows.length <= 12;
  const innerMinWidth = Math.min(1280, Math.max(520, rows.length * 88));
  const gradTop =
    accent === 'executive' ? '#004d40' : accent === 'source' ? '#4e342e' : '#0d47a1';
  const gradBot =
    accent === 'executive' ? '#26a69a' : accent === 'source' ? '#a1887f' : '#42a5f5';
  const cursorFill =
    accent === 'executive'
      ? 'rgba(0, 105, 92, 0.07)'
      : accent === 'source'
        ? 'rgba(78, 52, 46, 0.08)'
        : 'rgba(25, 118, 210, 0.06)';

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        p: 0,
        mb: 2,
        overflow: 'hidden',
        borderRadius: 2,
        borderColor: 'divider',
        background: (t) =>
          t.palette.mode === 'dark'
            ? accent === 'executive'
              ? 'linear-gradient(165deg, rgba(26,58,56,0.95) 0%, rgba(14,22,24,0.98) 100%)'
              : accent === 'source'
                ? 'linear-gradient(165deg, rgba(48,38,36,0.96) 0%, rgba(18,22,24,0.98) 100%)'
                : 'linear-gradient(165deg, rgba(30,40,55,0.92) 0%, rgba(18,22,28,0.98) 100%)'
            : accent === 'executive'
              ? 'linear-gradient(165deg, #f0fdfa 0%, #ffffff 50%, #e8f5f4 100%)'
              : accent === 'source'
                ? 'linear-gradient(165deg, #fbe9e7 0%, #ffffff 50%, #efebe9 100%)'
                : 'linear-gradient(165deg, #f8fafc 0%, #ffffff 55%, #f1f5f9 100%)',
      }}
    >
      <Box sx={{ px: 2.5, pt: 2, pb: 0.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.2 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {subtitle}
        </Typography>
        {onBarClick ? (
          <Typography variant="caption" color="primary" sx={{ mt: 0.75, display: 'block' }}>
            Click a bar to filter the table below; click again to clear.
          </Typography>
        ) : null}
      </Box>
      <Box
        sx={{
          width: '100%',
          overflowX: 'auto',
          minWidth: 0,
          height: 420,
          px: 1,
          pb: 1,
        }}
      >
        <Box
          sx={{
            width: '100%',
            minWidth: innerMinWidth,
            height: '100%',
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={rows}
              margin={{
                top: showValueLabels ? 36 : 12,
                right: 20,
                left: 4,
                bottom: 4,
              }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={gradTop} stopOpacity={1} />
                  <stop offset="100%" stopColor={gradBot} stopOpacity={0.92} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="4 6"
                vertical={false}
                stroke="rgba(148,163,184,0.45)"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(148,163,184,0.6)' }}
                interval={0}
                angle={tilt ? -32 : 0}
                textAnchor={tilt ? 'end' : 'middle'}
                height={tilt ? 68 : 36}
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                tickFormatter={formatAxisInr}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 'auto']}
                tickFormatter={(v) => `${Math.round(v)}%`}
                tick={{ fontSize: 11, fill: MARGIN_PCT_COLOR, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <RechartsTooltip
                cursor={{ fill: cursorFill }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as ProfitChartRow;
                  const name = row?.labelFull ?? row?.label ?? String(label ?? '');
                  const pct = row?.marginPct;
                  return (
                    <Box
                      sx={{
                        bgcolor: 'background.paper',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1.5,
                        px: 1.75,
                        py: 1.25,
                        boxShadow: 4,
                        minWidth: 200,
                      }}
                    >
                      <Typography variant="caption" display="block" fontWeight={700} sx={{ mb: 0.75 }}>
                        {name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
                        Resolved serials: {row?.resolvedSerials ?? '—'} · Unresolved: {row?.unresolvedSerials ?? '—'}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Serial selling: {formatCurrency(row?.selling ?? 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Dealer cost: {formatCurrency(row?.dealerCost ?? 0)}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5 }}>
                        Profit: {formatCurrency(row?.profit ?? 0)}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 0.75,
                          fontWeight: 700,
                          color: MARGIN_PCT_COLOR,
                          letterSpacing: 0.02,
                        }}
                      >
                        Margin vs selling:{' '}
                        {pct != null && Number.isFinite(pct) ? `${pct.toFixed(1)}%` : '—'}
                      </Typography>
                    </Box>
                  );
                }}
              />
              <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
              <Bar
                yAxisId="left"
                dataKey="profit"
                name="Profit (serial-level)"
                radius={[6, 6, 0, 0]}
                maxBarSize={56}
                cursor={onBarClick ? 'pointer' : 'default'}
                onClick={
                  onBarClick
                    ? (data: unknown) => {
                        const d = data as { payload?: ProfitChartRow };
                        const row = d?.payload;
                        const key = row?.filterKey;
                        if (key != null && String(key).length) onBarClick(String(key));
                      }
                    : undefined
                }
              >
                {showValueLabels ? (
                  <LabelList
                    dataKey="profit"
                    position="top"
                    offset={8}
                    formatter={(v: number | string) => formatAxisInr(Number(v))}
                    style={{ fill: '#1e293b', fontSize: 11, fontWeight: 600 }}
                  />
                ) : null}
                {rows.map((entry, index) => {
                  const selected =
                    selectedFilterKey != null &&
                    selectedFilterKey !== 'all' &&
                    entry.filterKey === selectedFilterKey;
                  const solid =
                    accent === 'executive'
                      ? selected
                        ? '#00695c'
                        : `url(#${gradientId})`
                      : accent === 'source'
                        ? selected
                          ? '#5d4037'
                          : `url(#${gradientId})`
                        : selected
                          ? '#0d47a1'
                          : `url(#${gradientId})`;
                  return (
                    <Cell
                      key={`bar-${entry.filterKey}-${index}`}
                      fill={solid}
                      fillOpacity={selected ? 1 : onBarClick ? 0.92 : 1}
                      stroke={
                        selected
                          ? accent === 'executive'
                            ? '#004d40'
                            : accent === 'source'
                              ? '#3e2723'
                              : '#01579b'
                          : 'none'
                      }
                      strokeWidth={selected ? 2 : 0}
                    />
                  );
                })}
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="marginPct"
                name="Margin % of selling"
                stroke={MARGIN_PCT_COLOR}
                strokeWidth={2.5}
                dot={{ r: 4, fill: MARGIN_PCT_COLOR, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6 }}
                connectNulls
                style={{ pointerEvents: 'none' }}
              >
                {showValueLabels ? (
                  <LabelList
                    dataKey="marginPct"
                    position="top"
                    offset={10}
                    formatter={(v: number | string) =>
                      v != null && v !== '' && Number.isFinite(Number(v)) ? `${Number(v).toFixed(1)}%` : ''
                    }
                    style={{ fill: MARGIN_PCT_COLOR, fontSize: 11, fontWeight: 700 }}
                  />
                ) : null}
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    </Paper>
  );
}

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

const escapeCsv = (value: unknown) => {
  const s = String(value ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const downloadCsv = (fileName: string, headers: string[], rows: Array<Array<string | number>>) => {
  const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

function tsToDate(t: Timestamp | string | null | undefined): Date {
  if (!t) return new Date();
  if (typeof t === 'string') {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
  return (t as Timestamp).toDate ? (t as Timestamp).toDate() : new Date();
}

function inRange(d: Date, from?: Date | null, to?: Date | null) {
  const t = d.getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

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

function getMonthWeekIndex(d: Date): number {
  return Math.floor((d.getDate() - 1) / 7);
}

function getMonthWeekMeta(d: Date): {
  sortKey: string;
  monthTitle: string;
  dayRangeLabel: string;
  weekIndex: number;
} {
  const y = d.getFullYear();
  const m = d.getMonth();
  const weekIndex = getMonthWeekIndex(d);
  const lastDay = new Date(y, m + 1, 0).getDate();
  const startDay = weekIndex * 7 + 1;
  const endDay = Math.min((weekIndex + 1) * 7, lastDay);
  const monthTitle = new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const dayRangeLabel = `${startDay}–${endDay}`;
  const sortKey = `${y}-${String(m + 1).padStart(2, '0')}-${weekIndex}`;
  return { sortKey, monthTitle, dayRangeLabel, weekIndex };
}

function normalizeSerialNumber(serialNumber: string): string {
  return String(serialNumber || '').trim().toLowerCase().replace(/\s+/g, '');
}

function splitSerialCandidates(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => normalizeSerialNumber(String(v || ''))).filter(Boolean);
  }
  const text = String(raw || '').trim();
  if (!text) return [];
  return text
    .split(/[,\n;|]+/g)
    .map((v) => normalizeSerialNumber(v))
    .filter(Boolean);
}

function serialCandidatesFromProduct(prod: Record<string, unknown>): string[] {
  const direct = [
    prod.serialNumber,
    prod.trialSerialNumber,
    prod.serialNo,
    prod.serial_no,
    prod.deviceSerial,
    prod.hearingAidSerial,
  ];
  const all: string[] = [];
  if (Array.isArray(prod.serialNumbers) && prod.serialNumbers.length > 0) {
    all.push(...splitSerialCandidates(prod.serialNumbers));
  }
  direct.forEach((v) => all.push(...splitSerialCandidates(v)));
  return Array.from(new Set(all.filter(Boolean)));
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Same id fields as sale lines / inventory — inbound may use any of these. */
function uniqueProductIdsFromLine(p: Record<string, unknown>): string[] {
  return Array.from(
    new Set(
      [p.productId, p.id, p.hearingAidProductId]
        .map((x) => String(x ?? '').trim())
        .filter(Boolean),
    ),
  );
}

function dedupeCostEntries(entries: CostLine[]): CostLine[] {
  const seen = new Set<string>();
  const out: CostLine[] = [];
  for (const e of entries) {
    const k = `${e.source}:${e.sourceDocId}:${e.productId}:${e.serial}:${e.dealerPrice}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

/**
 * Same serial often exists on both material inward and the purchase created from it.
 * Inventory skips the duplicate; profit must pick one (purchase wins, else latest).
 */
function pickPreferredCostLine(entries: CostLine[]): CostLine | undefined {
  const unique = dedupeCostEntries(entries);
  if (unique.length === 0) return undefined;
  if (unique.length === 1) return unique[0];
  const purchases = unique.filter((e) => e.source === 'purchase');
  if (purchases.length > 0) {
    return [...purchases].sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime())[0];
  }
  return [...unique].sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime())[0];
}

function collapseCostLineMap(map: Map<string, CostLine[]>): Map<string, CostLine> {
  const out = new Map<string, CostLine>();
  map.forEach((arr, key) => {
    const picked = pickPreferredCostLine(arr);
    if (picked) out.set(key, picked);
  });
  return out;
}

/** Split line pre-tax selling across units (serial count vs quantity) — avoids double-counting multi-serial lines. */
function unitsForLineSplit(product: Record<string, unknown>, serials: string[]): number {
  const q = Math.round(num(product.quantity)) || 0;
  const n = serials.length;
  return Math.max(n, q >= 1 ? q : 0, 1);
}

function perUnitPreTaxSelling(product: Record<string, unknown>, serials: string[]): number {
  const lineTotal = num(product.sellingPrice ?? product.finalAmount ?? product.amount ?? 0);
  return lineTotal / unitsForLineSplit(product, serials);
}

/**
 * In purchase/material docs, `dealerPrice` is stored per purchase unit.
 * For pair products, one purchase unit covers two serials, so split total line cost across serials too.
 */
function perSerialDealerCost(product: Record<string, unknown>, serials: string[]): number {
  const dealerPerPurchaseUnit = num(product.dealerPrice ?? product.finalPrice ?? product.purchasePrice);
  const quantity = Math.round(num(product.quantity)) || 1;
  const lineTotal = dealerPerPurchaseUnit * Math.max(quantity, 1);
  return lineTotal / unitsForLineSplit(product, serials);
}

type CostSource = 'materialInward' | 'purchase';

const HEAR_DOT_COM_COST_RATE = 0.21;

function isHearDotComReference(referenceKey: string, referenceLabel: string): boolean {
  const normalize = (value: string) =>
    String(value || '')
      .toLowerCase()
      .replace(/^ref:/, '')
      .replace(/[^a-z0-9]+/g, '');
  const key = normalize(referenceKey);
  const label = normalize(referenceLabel);
  return key === 'hearcom' || label === 'hearcom';
}

type CostLine = {
  source: CostSource;
  sourceDocId: string;
  sourceNumber: string;
  productId: string;
  serial: string;
  dealerPrice: number;
  entryDate: Date;
};

type ProfitLine = {
  /** Same as Sales Report / `mapUnifiedRowsToRecords` row id (e.g. sale-xxx, enq-xxx). */
  unifiedRowId: string;
  rowId: string;
  saleDate: Date;
  patientName: string;
  invoiceNumber: string | null;
  centerKey: string;
  centerName: string;
  executiveName: string;
  referenceKey: string;
  referenceLabel: string;
  productId: string;
  productName: string;
  serialNumber: string;
  sellingPrice: number;
  resolved: boolean;
  dealerPrice: number;
  profit: number;
  unresolvedReason: string | null;
  matchSource: CostSource | null;
  matchSourceDocId: string | null;
  matchSourceNumber: string | null;
};

type WeekBucket = {
  sortKey: string;
  monthTitle: string;
  dayRangeLabel: string;
  weekIndex: number;
  resolvedCount: number;
  unresolvedCount: number;
  sellingTotal: number;
  dealerCostTotal: number;
  profitTotal: number;
};

function aggregateByDimension<T extends string>(
  rows: ProfitLine[],
  keyGetter: (row: ProfitLine) => T,
  labelGetter: (row: ProfitLine) => string,
) {
  const map = new Map<
    T,
    {
      key: T;
      label: string;
      resolvedCount: number;
      unresolvedCount: number;
      sellingTotal: number;
      dealerCostTotal: number;
      profitTotal: number;
    }
  >();
  rows.forEach((line) => {
    const key = keyGetter(line);
    const prev = map.get(key) || {
      key,
      label: labelGetter(line),
      resolvedCount: 0,
      unresolvedCount: 0,
      sellingTotal: 0,
      dealerCostTotal: 0,
      profitTotal: 0,
    };
    /** Selling = all serial-level pre-tax amounts (resolved + unresolved); profit/cost only when resolved. */
    prev.sellingTotal += line.sellingPrice;
    if (line.resolved) {
      prev.resolvedCount += 1;
      prev.dealerCostTotal += line.dealerPrice;
      prev.profitTotal += line.profit;
    } else {
      prev.unresolvedCount += 1;
    }
    map.set(key, prev);
  });
  return Array.from(map.values()).sort((a, b) => b.profitTotal - a.profitTotal);
}

export default function ProfitReportTab() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => getLocalMonthDateStrings().fromStr);
  const [dateTo, setDateTo] = useState(() => getLocalMonthDateStrings().toStr);
  const [centerFilter, setCenterFilter] = useState<string>('all');
  const [execFilter, setExecFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [weekCenterIds, setWeekCenterIds] = useState<string[]>([]);
  const [weekReferenceKeys, setWeekReferenceKeys] = useState<string[]>([]);
  const [weekEmployeeNames, setWeekEmployeeNames] = useState<string[]>([]);
  const [lines, setLines] = useState<ProfitLine[]>([]);
  /** Same normalized sale rows as Sales Report (invoiced + uninvoiced enquiry). */
  const [saleRows, setSaleRows] = useState<NormalizedSale[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  /** Bumps on unmount / new fetch so overlapping reads (Strict Mode, tab switch) never update state. */
  const fetchGenerationRef = useRef(0);

  const dateFromObj = useMemo(() => (dateFrom ? new Date(`${dateFrom}T00:00:00`) : null), [dateFrom]);
  const dateToObj = useMemo(() => (dateTo ? new Date(`${dateTo}T23:59:59.999`) : null), [dateTo]);

  const fetchData = useCallback(async () => {
    const gen = ++fetchGenerationRef.current;
    setLoading(true);

    /** Same Firestore client as Sales Report — identical `sales` / `enquiries` / `centers` reads. */
    const firestore = db;

    if (!firestore) {
      console.warn('ProfitReportTab: Firestore is not initialized.');
      if (gen === fetchGenerationRef.current) {
        setSaleRows([]);
        setLines([]);
        setLoading(false);
      }
      return;
    }

    try {
      // Run collection reads one-by-one to reduce concurrent load (Strict Mode / tab switches).
      const centersSnap = await getDocs(collection(firestore, 'centers'));
      if (gen !== fetchGenerationRef.current) return;

      const salesSnap = await getDocs(collection(firestore, 'sales'));
      if (gen !== fetchGenerationRef.current) return;

      const enquiriesSnap = await getDocs(collection(firestore, 'enquiries'));
      if (gen !== fetchGenerationRef.current) return;

      const materialInSnap = await getDocs(collection(firestore, 'materialInward'));
      if (gen !== fetchGenerationRef.current) return;

      const purchasesSnap = await getDocs(collection(firestore, 'purchases'));
      if (gen !== fetchGenerationRef.current) return;

      const centersList: Center[] = centersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Center[];
      setCenters(centersList);
      const resolveCtx = buildCenterResolveContext(centersList);

      const enquiryDocs = enquiriesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const enquiryById = new Map<string, any>(enquiryDocs.map((e) => [e.id, e]));
      const saleRecords: SaleRecord[] = salesSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as object),
      })) as SaleRecord[];
      const derived = deriveEnquirySalesFromDocs(enquiryDocs, 'enquiry');
      const unified = buildUnifiedInvoiceRows(saleRecords, derived);

      const byProductSerial = new Map<string, CostLine[]>();
      const bySerialOnly = new Map<string, CostLine[]>();

      const registerInboundLine = (entry: CostLine, p: Record<string, unknown>, serial: string) => {
        const add = (m: Map<string, CostLine[]>, key: string) => {
          const prev = m.get(key) || [];
          prev.push(entry);
          m.set(key, prev);
        };
        for (const pid of uniqueProductIdsFromLine(p)) {
          add(byProductSerial, `${pid}|${serial}`);
        }
        add(bySerialOnly, serial);
      };

      materialInSnap.docs.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        const products = Array.isArray(data.products) ? data.products : [];
        const sourceNumber = String(data.challanNumber || '');
        const entryDate = tsToDate((data.receivedDate as Timestamp) || (data.createdAt as Timestamp) || null);
        products.forEach((raw) => {
          const p = raw as Record<string, unknown>;
          const serials = serialCandidatesFromProduct(p);
          const dealer = perSerialDealerCost(p, serials);
          const primaryPid = String(p.productId || p.id || p.hearingAidProductId || '').trim();
          if (!serials.length) return;
          serials.forEach((serial) => {
            const entry: CostLine = {
              source: 'materialInward',
              sourceDocId: docSnap.id,
              sourceNumber,
              productId: primaryPid,
              serial,
              dealerPrice: dealer,
              entryDate,
            };
            registerInboundLine(entry, p, serial);
          });
        });
      });

      purchasesSnap.docs.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        const products = Array.isArray(data.products) ? data.products : [];
        const sourceNumber = String(data.invoiceNo || '');
        const entryDate = tsToDate((data.purchaseDate as Timestamp) || (data.createdAt as Timestamp) || null);
        products.forEach((raw) => {
          const p = raw as Record<string, unknown>;
          const serials = serialCandidatesFromProduct(p);
          const dealer = perSerialDealerCost(p, serials);
          const primaryPid = String(p.productId || p.id || p.hearingAidProductId || '').trim();
          if (!serials.length) return;
          serials.forEach((serial) => {
            const entry: CostLine = {
              source: 'purchase',
              sourceDocId: docSnap.id,
              sourceNumber,
              productId: primaryPid,
              serial,
              dealerPrice: dealer,
              entryDate,
            };
            registerInboundLine(entry, p, serial);
          });
        });
      });

      const costByProductSerial = collapseCostLineMap(byProductSerial);
      const costBySerialOnly = collapseCostLineMap(bySerialOnly);

      const normalizedRecords = mapUnifiedRowsToRecords(unified, resolveCtx, enquiryById);
      if (gen !== fetchGenerationRef.current) return;
      const unifiedByRowId = new Map(unified.map((r) => [r.rowId, r]));

      const out: ProfitLine[] = [];
      for (const rec of normalizedRecords) {
        const row = unifiedByRowId.get(rec.rowId);
        if (!row) continue;
        const products = getProductLinesForUnifiedRow(row);
        products.forEach((product, pIndex) => {
          const serials = serialCandidatesFromProduct(product);
          if (!serials.length) return;
          const productIdsToTry = uniqueProductIdsFromLine(product as Record<string, unknown>);
          const productId = productIdsToTry[0] || '';
          const productName = String(product.name || product.model || '—');
          const perSerialSelling = perUnitPreTaxSelling(product, serials);
          serials.forEach((serial, sIndex) => {
            let resolvedEntry: CostLine | null = null;
            let unresolvedReason: string | null = null;

            const base = {
              unifiedRowId: rec.rowId,
              rowId: `${rec.rowId}-${pIndex}-${sIndex}-${serial}`,
              saleDate: rec.date,
              patientName: rec.patientName,
              invoiceNumber: rec.invoiceNumber,
              centerKey: rec.centerKey,
              centerName: rec.centerName,
              executiveName: rec.executiveName,
              referenceKey: rec.referenceKey,
              referenceLabel: rec.referenceLabel,
              productId,
              productName,
              serialNumber: serial,
              sellingPrice: perSerialSelling,
            };

            if (isHearDotComReference(rec.referenceKey, rec.referenceLabel)) {
              /** HEAR.COM rows use a fixed profit share: profit = 21% of selling, cost = remaining 79%. */
              const hearComProfit = perSerialSelling * HEAR_DOT_COM_COST_RATE;
              const hearComCost = perSerialSelling - hearComProfit;
              out.push({
                ...base,
                resolved: true,
                dealerPrice: hearComCost,
                profit: hearComProfit,
                unresolvedReason: null,
                matchSource: null,
                matchSourceDocId: null,
                matchSourceNumber: 'HEAR.COM 21% profit rule',
              });
              return;
            }

            for (const pid of productIdsToTry) {
              const hit = costByProductSerial.get(`${pid}|${serial}`);
              if (hit) {
                resolvedEntry = hit;
                break;
              }
            }
            if (!resolvedEntry) {
              const bySerial = costBySerialOnly.get(serial);
              if (bySerial) resolvedEntry = bySerial;
            }
            if (!resolvedEntry) {
              unresolvedReason = 'No inbound dealer price found for serial.';
            }

            if (resolvedEntry) {
              out.push({
                ...base,
                resolved: true,
                dealerPrice: resolvedEntry.dealerPrice,
                profit: perSerialSelling - resolvedEntry.dealerPrice,
                unresolvedReason: null,
                matchSource: resolvedEntry.source,
                matchSourceDocId: resolvedEntry.sourceDocId,
                matchSourceNumber: resolvedEntry.sourceNumber,
              });
            } else {
              out.push({
                ...base,
                resolved: false,
                dealerPrice: 0,
                profit: 0,
                unresolvedReason,
                matchSource: null,
                matchSourceDocId: null,
                matchSourceNumber: null,
              });
            }
          });
        });
      }

      if (gen !== fetchGenerationRef.current) return;
      setSaleRows(normalizedRecords);
      setLines(out.sort((a, b) => b.saleDate.getTime() - a.saleDate.getTime()));
    } catch (error) {
      if (gen !== fetchGenerationRef.current) return;
      console.error('Failed to fetch profit report:', error);
      setSaleRows([]);
      setLines([]);
    } finally {
      if (gen === fetchGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => {
      fetchGenerationRef.current += 1;
    };
  }, [fetchData]);

  const filteredLines = useMemo(() => {
    return lines.filter((line) => {
      if (!inRange(line.saleDate, dateFromObj, dateToObj)) return false;
      if (centerFilter !== 'all' && line.centerKey !== centerFilter) return false;
      if (execFilter !== 'all' && line.executiveName !== execFilter) return false;
      if (sourceFilter !== 'all' && line.referenceKey !== sourceFilter) return false;
      return true;
    });
  }, [lines, dateFromObj, dateToObj, centerFilter, execFilter, sourceFilter]);

  const weekViewLines = useMemo(() => {
    return lines.filter((line) => {
      if (!inRange(line.saleDate, dateFromObj, dateToObj)) return false;
      if (weekCenterIds.length > 0 && !weekCenterIds.includes(line.centerKey)) return false;
      if (weekReferenceKeys.length > 0 && !weekReferenceKeys.includes(line.referenceKey)) return false;
      if (weekEmployeeNames.length > 0 && !weekEmployeeNames.includes(line.executiveName)) return false;
      return true;
    });
  }, [lines, dateFromObj, dateToObj, weekCenterIds, weekReferenceKeys, weekEmployeeNames]);

  const centerOptions = useMemo(() => {
    const map = new Map<string, string>();
    centers.forEach((c) => map.set(c.id, String(c.name || c.id)));
    saleRows.forEach((s) => {
      if (!map.has(s.centerKey)) map.set(s.centerKey, s.centerName);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [centers, saleRows]);

  const execOptions = useMemo(() => {
    return Array.from(new Set(saleRows.map((s) => s.executiveName).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [saleRows]);

  const sourceOptions = useMemo(() => {
    const map = new Map<string, string>();
    saleRows.forEach((s) => {
      if (!map.has(s.referenceKey)) map.set(s.referenceKey, s.referenceLabel);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [saleRows]);

  /** Same sale rows as Sales Report for the selected filters (before serial-level profit). */
  const filteredSales = useMemo(() => {
    return saleRows.filter((s) => {
      if (!inRange(s.date, dateFromObj, dateToObj)) return false;
      if (centerFilter !== 'all' && s.centerKey !== centerFilter) return false;
      if (execFilter !== 'all' && s.executiveName !== execFilter) return false;
      if (sourceFilter !== 'all' && s.referenceKey !== sourceFilter) return false;
      return true;
    });
  }, [saleRows, dateFromObj, dateToObj, centerFilter, execFilter, sourceFilter]);

  const profitRollupByUnifiedRow = useMemo(() => {
    const m = new Map<
      string,
      {
        profit: number;
        selling: number;
        dealerCost: number;
        resolvedSerials: number;
        unresolvedSerials: number;
      }
    >();
    filteredLines.forEach((l) => {
      const prev = m.get(l.unifiedRowId) || {
        profit: 0,
        selling: 0,
        dealerCost: 0,
        resolvedSerials: 0,
        unresolvedSerials: 0,
      };
      prev.selling += l.sellingPrice;
      if (l.resolved) {
        prev.profit += l.profit;
        prev.dealerCost += l.dealerPrice;
        prev.resolvedSerials += 1;
      } else {
        prev.unresolvedSerials += 1;
      }
      m.set(l.unifiedRowId, prev);
    });
    return m;
  }, [filteredLines]);

  /** Same sale count and invoice totals as Sales Report for the current filters (sanity check). */
  const salesReportParity = useMemo(() => {
    const count = filteredSales.length;
    const subtotalSum = filteredSales.reduce((sum, s) => sum + s.subtotal, 0);
    const gstSum = filteredSales.reduce((sum, s) => sum + s.gstAmount, 0);
    const grandSum = filteredSales.reduce((sum, s) => sum + s.total, 0);
    return { count, subtotalSum, gstSum, grandSum };
  }, [filteredSales]);

  const sortedFilteredSales = useMemo(
    () => [...filteredSales].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [filteredSales],
  );

  const totals = useMemo(() => {
    const resolved = filteredLines.filter((l) => l.resolved);
    const unresolvedCount = filteredLines.length - resolved.length;
    const sellingTotal = filteredLines.reduce((sum, l) => sum + l.sellingPrice, 0);
    const dealerCostTotal = resolved.reduce((sum, l) => sum + l.dealerPrice, 0);
    const profitTotal = resolved.reduce((sum, l) => sum + l.profit, 0);
    const avgProfitPerSerial = resolved.length > 0 ? profitTotal / resolved.length : null;
    return {
      resolvedCount: resolved.length,
      unresolvedCount,
      sellingTotal,
      dealerCostTotal,
      profitTotal,
      avgProfitPerSerial,
    };
  }, [filteredLines]);

  const centerWise = useMemo(
    () => aggregateByDimension(filteredLines, (line) => line.centerKey, (line) => line.centerName),
    [filteredLines],
  );
  const execWise = useMemo(
    () => aggregateByDimension(filteredLines, (line) => line.executiveName, (line) => line.executiveName),
    [filteredLines],
  );
  const sourceWise = useMemo(
    () => aggregateByDimension(filteredLines, (line) => line.referenceKey, (line) => line.referenceLabel),
    [filteredLines],
  );

  const centerWiseChartRows = useMemo((): ProfitChartRow[] => {
    return centerWise.map((r) => {
      const marginPct =
        r.sellingTotal > 0 ? (100 * r.profitTotal) / r.sellingTotal : undefined;
      return {
        filterKey: r.key,
        label: r.label.length > 22 ? `${r.label.slice(0, 20)}…` : r.label,
        labelFull: r.label,
        profit: r.profitTotal,
        marginPct,
        selling: r.sellingTotal,
        dealerCost: r.dealerCostTotal,
        resolvedSerials: r.resolvedCount,
        unresolvedSerials: r.unresolvedCount,
      };
    });
  }, [centerWise]);

  const execWiseChartRows = useMemo((): ProfitChartRow[] => {
    return execWise.map((r) => {
      const marginPct =
        r.sellingTotal > 0 ? (100 * r.profitTotal) / r.sellingTotal : undefined;
      const name = r.label;
      return {
        filterKey: r.key,
        label: name.length > 22 ? `${name.slice(0, 20)}…` : name,
        labelFull: name,
        profit: r.profitTotal,
        marginPct,
        selling: r.sellingTotal,
        dealerCost: r.dealerCostTotal,
        resolvedSerials: r.resolvedCount,
        unresolvedSerials: r.unresolvedCount,
      };
    });
  }, [execWise]);

  const sourceWiseChartRows = useMemo((): ProfitChartRow[] => {
    return sourceWise.map((r) => {
      const marginPct =
        r.sellingTotal > 0 ? (100 * r.profitTotal) / r.sellingTotal : undefined;
      return {
        filterKey: r.key,
        label: r.label.length > 22 ? `${r.label.slice(0, 20)}…` : r.label,
        labelFull: r.label,
        profit: r.profitTotal,
        marginPct,
        selling: r.sellingTotal,
        dealerCost: r.dealerCostTotal,
        resolvedSerials: r.resolvedCount,
        unresolvedSerials: r.unresolvedCount,
      };
    });
  }, [sourceWise]);

  const handleProfitCenterChartBarClick = useCallback((filterKey: string) => {
    setCenterFilter((prev) => (prev === filterKey ? 'all' : filterKey));
    setExecFilter('all');
    setSourceFilter('all');
  }, []);

  const handleProfitExecChartBarClick = useCallback((filterKey: string) => {
    setExecFilter((prev) => (prev === filterKey ? 'all' : filterKey));
    setCenterFilter('all');
    setSourceFilter('all');
  }, []);

  const handleProfitSourceChartBarClick = useCallback((filterKey: string) => {
    setSourceFilter((prev) => (prev === filterKey ? 'all' : filterKey));
  }, []);

  const weekWiseRows = useMemo((): WeekBucket[] => {
    const map = new Map<string, WeekBucket>();
    weekViewLines.forEach((line) => {
      const meta = getMonthWeekMeta(line.saleDate);
      const prev = map.get(meta.sortKey) || {
        sortKey: meta.sortKey,
        monthTitle: meta.monthTitle,
        dayRangeLabel: meta.dayRangeLabel,
        weekIndex: meta.weekIndex,
        resolvedCount: 0,
        unresolvedCount: 0,
        sellingTotal: 0,
        dealerCostTotal: 0,
        profitTotal: 0,
      };
      prev.sellingTotal += line.sellingPrice;
      if (line.resolved) {
        prev.resolvedCount += 1;
        prev.dealerCostTotal += line.dealerPrice;
        prev.profitTotal += line.profit;
      } else {
        prev.unresolvedCount += 1;
      }
      map.set(meta.sortKey, prev);
    });
    return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [weekViewLines]);

  const weekTotals = useMemo(() => {
    const resolvedCount = weekWiseRows.reduce((sum, row) => sum + row.resolvedCount, 0);
    const unresolvedCount = weekWiseRows.reduce((sum, row) => sum + row.unresolvedCount, 0);
    const sellingTotal = weekWiseRows.reduce((sum, row) => sum + row.sellingTotal, 0);
    const dealerCostTotal = weekWiseRows.reduce((sum, row) => sum + row.dealerCostTotal, 0);
    const profitTotal = weekWiseRows.reduce((sum, row) => sum + row.profitTotal, 0);
    const avgProfitPerSerial = resolvedCount > 0 ? profitTotal / resolvedCount : null;
    return { resolvedCount, unresolvedCount, sellingTotal, dealerCostTotal, profitTotal, avgProfitPerSerial };
  }, [weekWiseRows]);

  const weekProfitChartData = useMemo(() => {
    return weekWiseRows.map((r) => {
      const monthWord = r.monthTitle.split(' ')[0] || r.monthTitle;
      const marginPct =
        r.sellingTotal > 0 ? (100 * r.profitTotal) / r.sellingTotal : null;
      return {
        sortKey: r.sortKey,
        chartLabel: `${monthWord} · ${r.dayRangeLabel}`,
        profit: r.profitTotal,
        selling: r.sellingTotal,
        marginPct,
        resolvedCount: r.resolvedCount,
      };
    });
  }, [weekWiseRows]);

  const showWeekProfitBarLabels = weekProfitChartData.length > 0 && weekProfitChartData.length <= 14;

  const exportAggCsv = (
    fileName: string,
    dimensionName: string,
    rows: Array<{
      label: string;
      resolvedCount: number;
      unresolvedCount: number;
      sellingTotal: number;
      dealerCostTotal: number;
      profitTotal: number;
    }>,
  ) => {
    const headers = [
      dimensionName,
      'Resolved serial count',
      'Unresolved serial count',
      'Selling value (INR)',
      'Dealer cost (INR)',
      'Profit (INR)',
      'Avg. profit per resolved serial (INR)',
    ];
    const body = rows.map((r) => [
      r.label,
      r.resolvedCount,
      r.unresolvedCount,
      r.sellingTotal.toFixed(2),
      r.dealerCostTotal.toFixed(2),
      r.profitTotal.toFixed(2),
      r.resolvedCount > 0 ? (r.profitTotal / r.resolvedCount).toFixed(2) : '',
    ]);
    downloadCsv(fileName, headers, body);
  };

  const exportCenterWise = () =>
    exportAggCsv(
      `profit-center-wise-${dateFrom}-to-${dateTo}.csv`,
      'Center',
      centerWise.map((r) => ({ ...r, label: r.label })),
    );

  const exportExecWise = () =>
    exportAggCsv(
      `profit-executive-wise-${dateFrom}-to-${dateTo}.csv`,
      'Executive',
      execWise.map((r) => ({ ...r, label: r.label })),
    );

  const exportSourceWise = () =>
    exportAggCsv(
      `profit-source-wise-${dateFrom}-to-${dateTo}.csv`,
      'Reference / source',
      sourceWise.map((r) => ({ ...r, label: r.label })),
    );

  const exportWeekWise = () => {
    const headers = [
      'Month',
      'Day range',
      'Resolved serial count',
      'Unresolved serial count',
      'Selling value (INR)',
      'Dealer cost (INR)',
      'Profit (INR)',
      'Avg. profit per resolved serial (INR)',
    ];
    const rows = weekWiseRows.map((r) => [
      r.monthTitle,
      r.dayRangeLabel,
      r.resolvedCount,
      r.unresolvedCount,
      r.sellingTotal.toFixed(2),
      r.dealerCostTotal.toFixed(2),
      r.profitTotal.toFixed(2),
      r.resolvedCount > 0 ? (r.profitTotal / r.resolvedCount).toFixed(2) : '',
    ]);
    downloadCsv(`profit-week-wise-${dateFrom}-to-${dateTo}.csv`, headers, rows);
  };

  const exportPerSale = () => {
    const headers = [
      'Unified row id',
      'Sale date',
      'Kind',
      'Invoice',
      'Patient',
      'Center',
      'Executive',
      'Reference / source',
      'Invoice subtotal (INR)',
      'GST (INR)',
      'Grand total (INR)',
      'Serial-tracked selling (INR)',
      'Resolved profit (INR)',
      'Resolved dealer cost (INR)',
      'Resolved serials',
      'Unresolved serials',
    ];
    const rows = sortedFilteredSales.map((s) => {
      const roll = profitRollupByUnifiedRow.get(s.rowId);
      return [
        s.rowId,
        formatDate(s.date),
        s.recordKind === 'invoiced' ? 'Invoiced' : 'Uninvoiced',
        s.invoiceNumber || '',
        s.patientName,
        s.centerName,
        s.executiveName,
        s.referenceLabel,
        s.subtotal.toFixed(2),
        s.gstAmount.toFixed(2),
        s.total.toFixed(2),
        roll ? roll.selling.toFixed(2) : '',
        roll ? roll.profit.toFixed(2) : '',
        roll ? roll.dealerCost.toFixed(2) : '',
        roll?.resolvedSerials ?? '',
        roll?.unresolvedSerials ?? '',
      ];
    });
    downloadCsv(`profit-per-sale-${dateFrom}-to-${dateTo}.csv`, headers, rows);
  };

  const exportDetailed = () => {
    const headers = [
      'Unified row id',
      'Sale date',
      'Center',
      'Executive',
      'Reference / source',
      'Patient',
      'Invoice',
      'Product',
      'Product ID',
      'Serial',
      'Selling price (INR)',
      'Resolution status',
      'Dealer price (INR)',
      'Profit (INR)',
      'Match source',
      'Match reference no.',
      'Match source doc id',
      'Unresolved reason',
    ];
    const rows = filteredLines.map((l) => [
      l.unifiedRowId,
      formatDate(l.saleDate),
      l.centerName,
      l.executiveName,
      l.referenceLabel,
      l.patientName,
      l.invoiceNumber || '',
      l.productName,
      l.productId,
      l.serialNumber,
      l.sellingPrice.toFixed(2),
      l.resolved ? 'resolved' : 'unresolved',
      l.resolved ? l.dealerPrice.toFixed(2) : '',
      l.resolved ? l.profit.toFixed(2) : '',
      l.matchSource || '',
      l.matchSourceNumber || '',
      l.matchSourceDocId || '',
      l.unresolvedReason || '',
    ]);
    downloadCsv(`profit-detailed-${dateFrom}-to-${dateTo}.csv`, headers, rows);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="380px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              type="date"
              size="small"
              label="From"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              type="date"
              size="small"
              label="To"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Center</InputLabel>
              <Select label="Center" value={centerFilter} onChange={(e) => setCenterFilter(e.target.value)}>
                <MenuItem value="all">All centers</MenuItem>
                {centerOptions.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Executive</InputLabel>
              <Select label="Executive" value={execFilter} onChange={(e) => setExecFilter(e.target.value)}>
                <MenuItem value="all">All executives</MenuItem>
                {execOptions.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Source</InputLabel>
              <Select label="Source" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                <MenuItem value="all">All sources</MenuItem>
                {sourceOptions.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button variant="outlined" onClick={fetchData} startIcon={<RefreshIcon />} fullWidth>
                Refresh
              </Button>
              <Button variant="outlined" onClick={exportPerSale} startIcon={<DownloadIcon />} fullWidth>
                Per-sale CSV
              </Button>
              <Button variant="outlined" onClick={exportDetailed} startIcon={<DownloadIcon />} fullWidth>
                Serial lines CSV
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
          Sales list matches Sales Report: same merged invoices + enquiry visits, same date/center/executive/source
          filters. Invoice totals below are the row totals from that list; serial columns are pre-tax amounts split
          per serial for margin matching.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="caption" color="text.secondary">
              Sales (rows)
            </Typography>
            <Typography variant="h6">{salesReportParity.count}</Typography>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="caption" color="text.secondary">
              Invoice grand total
            </Typography>
            <Typography variant="h6">{formatCurrency(salesReportParity.grandSum)}</Typography>
          </Grid>
          <Grid item xs={6} sm={4} md={2.4}>
            <Typography variant="caption" color="text.secondary">
              Resolved serials
            </Typography>
            <Typography variant="h6">{totals.resolvedCount}</Typography>
          </Grid>
          <Grid item xs={6} sm={4} md={2.4}>
            <Typography variant="caption" color="text.secondary">
              Unresolved serials
            </Typography>
            <Typography variant="h6" color={totals.unresolvedCount > 0 ? 'warning.main' : 'text.primary'}>
              {totals.unresolvedCount}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={4} md={2.4}>
            <Typography variant="caption" color="text.secondary">
              Serial selling (all)
            </Typography>
            <Typography variant="h6">{formatCurrency(totals.sellingTotal)}</Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Pre-tax / serial; includes unresolved
            </Typography>
          </Grid>
          <Grid item xs={6} sm={4} md={2.4}>
            <Typography variant="caption" color="text.secondary">
              Dealer cost
            </Typography>
            <Typography variant="h6">{formatCurrency(totals.dealerCostTotal)}</Typography>
          </Grid>
          <Grid item xs={6} sm={4} md={2.4}>
            <Typography variant="caption" color="text.secondary">
              Profit
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {formatCurrency(totals.profitTotal)}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Avg/serial:{' '}
              {totals.avgProfitPerSerial != null ? formatCurrency(totals.avgProfitPerSerial) : '—'}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} variant="outlined" sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="Per sale" />
          <Tab label="Center-wise Profit" />
          <Tab label="Executive-wise Profit" />
          <Tab label="Source-wise Profit" />
          <Tab label="Week-wise Profit" />
          <Tab label="Unresolved Serials" />
        </Tabs>
      </Paper>

      {tab === 0 && (
        <Box sx={{ mb: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1} flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="h6">Profit per sale</Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Same sale rows as Sales Report (merged invoices + enquiry visits). Invoice amounts are document totals;
                serial columns are pre-tax per serial for dealer matching.
              </Typography>
            </Box>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportPerSale}>
              Export CSV
            </Button>
          </Box>
          <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ maxHeight: 560 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Kind</TableCell>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Patient</TableCell>
                  <TableCell>Center</TableCell>
                  <TableCell>Executive</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell align="right">Subtotal</TableCell>
                  <TableCell align="right">GST</TableCell>
                  <TableCell align="right">Grand</TableCell>
                  <TableCell align="right">Serial selling</TableCell>
                  <TableCell align="right">Profit</TableCell>
                  <TableCell align="right">Dealer cost</TableCell>
                  <TableCell align="right">Res.</TableCell>
                  <TableCell align="right">Unres.</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>Row id</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedFilteredSales.length ? (
                  sortedFilteredSales.map((s) => {
                    const roll = profitRollupByUnifiedRow.get(s.rowId);
                    return (
                      <TableRow key={s.rowId} hover>
                        <TableCell>{formatDate(s.date)}</TableCell>
                        <TableCell>{s.recordKind === 'invoiced' ? 'Invoiced' : 'Uninvoiced'}</TableCell>
                        <TableCell>{s.invoiceNumber || '—'}</TableCell>
                        <TableCell>{s.patientName}</TableCell>
                        <TableCell>{s.centerName}</TableCell>
                        <TableCell>{s.executiveName}</TableCell>
                        <TableCell>{s.referenceLabel}</TableCell>
                        <TableCell align="right">{formatCurrency(s.subtotal)}</TableCell>
                        <TableCell align="right">{formatCurrency(s.gstAmount)}</TableCell>
                        <TableCell align="right">{formatCurrency(s.total)}</TableCell>
                        <TableCell align="right">{roll ? formatCurrency(roll.selling) : '—'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: roll ? 700 : 400 }}>
                          {roll ? formatCurrency(roll.profit) : '—'}
                        </TableCell>
                        <TableCell align="right">{roll ? formatCurrency(roll.dealerCost) : '—'}</TableCell>
                        <TableCell align="right">{roll?.resolvedSerials ?? '—'}</TableCell>
                        <TableCell align="right">{roll?.unresolvedSerials ?? '—'}</TableCell>
                        <TableCell
                          sx={{
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            fontSize: '0.7rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {s.rowId}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={16} align="center" sx={{ py: 3 }}>
                      No sales in this range for the selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {tab === 1 && (
        <Box sx={{ mb: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6">Center-wise profit</Typography>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCenterWise}>
              Export CSV
            </Button>
          </Box>
          {centerWiseChartRows.length > 0 && (
            <ProfitCompetitiveChart
              rows={centerWiseChartRows}
              gradientId="profitCenterBar"
              title="By center"
              subtitle="Bars: total profit (serial-level). Line: margin % of serial selling — hover for selling, dealer cost, and counts."
              accent="center"
              selectedFilterKey={centerFilter}
              onBarClick={handleProfitCenterChartBarClick}
            />
          )}
          <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Center</TableCell>
                  <TableCell align="right">Resolved</TableCell>
                  <TableCell align="right">Unresolved</TableCell>
                  <TableCell align="right">Selling</TableCell>
                  <TableCell align="right">Dealer cost</TableCell>
                  <TableCell align="right">Profit</TableCell>
                  <TableCell align="right">Avg. profit/serial</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {centerWise.length ? (
                  centerWise.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell>{r.label}</TableCell>
                      <TableCell align="right">{r.resolvedCount}</TableCell>
                      <TableCell align="right">{r.unresolvedCount}</TableCell>
                      <TableCell align="right">{formatCurrency(r.sellingTotal)}</TableCell>
                      <TableCell align="right">{formatCurrency(r.dealerCostTotal)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(r.profitTotal)}
                      </TableCell>
                      <TableCell align="right">
                        {r.resolvedCount > 0 ? formatCurrency(r.profitTotal / r.resolvedCount) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                      No serial-level records for the selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {tab === 2 && (
        <Box sx={{ mb: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6">Executive-wise profit</Typography>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportExecWise}>
              Export CSV
            </Button>
          </Box>
          {execWiseChartRows.length > 0 && (
            <ProfitCompetitiveChart
              rows={execWiseChartRows}
              gradientId="profitExecBar"
              title="By salesperson"
              subtitle="Compare profit volume vs margin %. Same filters as the table above."
              accent="executive"
              selectedFilterKey={execFilter}
              onBarClick={handleProfitExecChartBarClick}
            />
          )}
          <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Executive</TableCell>
                  <TableCell align="right">Resolved</TableCell>
                  <TableCell align="right">Unresolved</TableCell>
                  <TableCell align="right">Selling</TableCell>
                  <TableCell align="right">Dealer cost</TableCell>
                  <TableCell align="right">Profit</TableCell>
                  <TableCell align="right">Avg. profit/serial</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {execWise.length ? (
                  execWise.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell>{r.label}</TableCell>
                      <TableCell align="right">{r.resolvedCount}</TableCell>
                      <TableCell align="right">{r.unresolvedCount}</TableCell>
                      <TableCell align="right">{formatCurrency(r.sellingTotal)}</TableCell>
                      <TableCell align="right">{formatCurrency(r.dealerCostTotal)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(r.profitTotal)}
                      </TableCell>
                      <TableCell align="right">
                        {r.resolvedCount > 0 ? formatCurrency(r.profitTotal / r.resolvedCount) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                      No serial-level records for the selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {tab === 3 && (
        <Box sx={{ mb: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6">Source-wise profit</Typography>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportSourceWise}>
              Export CSV
            </Button>
          </Box>
          {sourceWiseChartRows.length > 0 && (
            <ProfitCompetitiveChart
              rows={sourceWiseChartRows}
              gradientId="profitSourceBar"
              title="By reference / source"
              subtitle="Profit and margin by enquiry reference (or invoice source). Filter via top bar or click a bar."
              accent="source"
              selectedFilterKey={sourceFilter}
              onBarClick={handleProfitSourceChartBarClick}
            />
          )}
          <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Reference / source</TableCell>
                  <TableCell align="right">Resolved</TableCell>
                  <TableCell align="right">Unresolved</TableCell>
                  <TableCell align="right">Selling</TableCell>
                  <TableCell align="right">Dealer cost</TableCell>
                  <TableCell align="right">Profit</TableCell>
                  <TableCell align="right">Avg. profit/serial</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sourceWise.length ? (
                  sourceWise.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell>{r.label}</TableCell>
                      <TableCell align="right">{r.resolvedCount}</TableCell>
                      <TableCell align="right">{r.unresolvedCount}</TableCell>
                      <TableCell align="right">{formatCurrency(r.sellingTotal)}</TableCell>
                      <TableCell align="right">{formatCurrency(r.dealerCostTotal)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(r.profitTotal)}
                      </TableCell>
                      <TableCell align="right">
                        {r.resolvedCount > 0 ? formatCurrency(r.profitTotal / r.resolvedCount) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                      No serial-level records for the selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {tab === 4 && (
        <Box sx={{ mb: 3 }}>
          <Box
            display="flex"
            flexWrap="wrap"
            alignItems="flex-start"
            justifyContent="space-between"
            gap={1.5}
            mb={1.5}
          >
            <Box sx={{ minWidth: 220 }}>
              <Typography variant="h6">Week-wise profit (within each month)</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                From/To range + optional multi-select filters. Unresolved serials are counted separately.
              </Typography>
            </Box>
            <Button variant="outlined" size="small" onClick={exportWeekWise} startIcon={<DownloadIcon />}>
              Export week-wise CSV
            </Button>
          </Box>

          <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} md={4}>
                <Autocomplete
                  multiple
                  options={centerOptions}
                  getOptionLabel={(o) => o.name}
                  value={centerOptions.filter((c) => weekCenterIds.includes(c.id))}
                  onChange={(_, v) => setWeekCenterIds(v.map((x) => x.id))}
                  renderInput={(params) => (
                    <TextField {...params} label="Centers" size="small" placeholder="All centers" />
                  )}
                  disableCloseOnSelect
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  multiple
                  options={sourceOptions}
                  getOptionLabel={(o) => o.name}
                  value={sourceOptions.filter((o) => weekReferenceKeys.includes(o.id))}
                  onChange={(_, v) => setWeekReferenceKeys(v.map((x) => x.id))}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Reference / source"
                      size="small"
                      placeholder="All references"
                    />
                  )}
                  disableCloseOnSelect
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  multiple
                  options={execOptions}
                  value={weekEmployeeNames}
                  onChange={(_, v) => setWeekEmployeeNames(v)}
                  renderInput={(params) => (
                    <TextField {...params} label="Salespeople" size="small" placeholder="All salespeople" />
                  )}
                  disableCloseOnSelect
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => {
                    setWeekCenterIds([]);
                    setWeekReferenceKeys([]);
                    setWeekEmployeeNames([]);
                  }}
                >
                  Clear week-wise filters
                </Button>
              </Grid>
            </Grid>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="caption" color="text.secondary">
                  Resolved
                </Typography>
                <Typography variant="h6">{weekTotals.resolvedCount}</Typography>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="caption" color="text.secondary">
                  Unresolved
                </Typography>
                <Typography variant="h6" color={weekTotals.unresolvedCount > 0 ? 'warning.main' : 'text.primary'}>
                  {weekTotals.unresolvedCount}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="caption" color="text.secondary">
                  Selling
                </Typography>
                <Typography variant="h6">{formatCurrency(weekTotals.sellingTotal)}</Typography>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="caption" color="text.secondary">
                  Dealer cost
                </Typography>
                <Typography variant="h6">{formatCurrency(weekTotals.dealerCostTotal)}</Typography>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="caption" color="text.secondary">
                  Profit
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {formatCurrency(weekTotals.profitTotal)}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="caption" color="text.secondary">
                  Avg/serial
                </Typography>
                <Typography variant="h6">
                  {weekTotals.avgProfitPerSerial != null
                    ? formatCurrency(weekTotals.avgProfitPerSerial)
                    : '—'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {weekProfitChartData.length > 0 ? (
            <Box sx={{ width: '100%', height: 400, overflowX: 'auto', mb: 2 }}>
              <Box sx={{ minWidth: Math.max(520, weekProfitChartData.length * 80), height: 380 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={weekProfitChartData}
                    margin={{
                      top: showWeekProfitBarLabels ? 40 : 8,
                      right: 12,
                      left: 4,
                      bottom: 56,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="rgba(148,163,184,0.45)" />
                    <XAxis
                      dataKey="chartLabel"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      interval={0}
                      angle={weekProfitChartData.length > 5 ? -32 : 0}
                      textAnchor={weekProfitChartData.length > 5 ? 'end' : 'middle'}
                      height={weekProfitChartData.length > 5 ? 72 : 36}
                    />
                    <YAxis tickFormatter={formatAxisInr} tick={{ fontSize: 11, fill: '#64748b' }} width={58} />
                    <RechartsTooltip
                      cursor={{ fill: 'rgba(21, 101, 192, 0.07)' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0]?.payload as {
                          chartLabel?: string;
                          profit?: number;
                          selling?: number;
                          marginPct?: number | null;
                          resolvedCount?: number;
                        };
                        const pct = row?.marginPct;
                        return (
                          <Box
                            sx={{
                              bgcolor: 'background.paper',
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1.5,
                              px: 1.5,
                              py: 1,
                              boxShadow: 3,
                            }}
                          >
                            <Typography variant="caption" fontWeight={700} display="block">
                              {String(label ?? row?.chartLabel ?? '')}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Profit: {formatCurrency(Number(row?.profit) || 0)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Selling: {formatCurrency(Number(row?.selling) || 0)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Resolved serials: {row?.resolvedCount ?? '—'}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: MARGIN_PCT_COLOR, mt: 0.5 }}>
                              Margin vs selling:{' '}
                              {pct != null && Number.isFinite(pct) ? `${pct.toFixed(1)}%` : '—'}
                            </Typography>
                          </Box>
                        );
                      }}
                    />
                    <Bar dataKey="profit" fill="#1565c0" name="profit" radius={[5, 5, 0, 0]} maxBarSize={56}>
                      {showWeekProfitBarLabels ? (
                        <LabelList
                          dataKey="profit"
                          content={(props: any) => {
                            const { x, y, width, value, index } = props;
                            if (x == null || y == null || width == null || value == null) return null;
                            const row = weekProfitChartData[index];
                            const pct = row?.marginPct;
                            const cx = x + width / 2;
                            const amt = formatAxisInr(Number(value));
                            return (
                              <g>
                                {pct != null && Number.isFinite(pct) ? (
                                  <text
                                    x={cx}
                                    y={y - 22}
                                    textAnchor="middle"
                                    fill={MARGIN_PCT_COLOR}
                                    fontSize={10}
                                    fontWeight={700}
                                  >
                                    {pct.toFixed(1)}%
                                  </text>
                                ) : null}
                                <text
                                  x={cx}
                                  y={y - 8}
                                  textAnchor="middle"
                                  fill="#1e293b"
                                  fontSize={11}
                                  fontWeight={600}
                                >
                                  {amt}
                                </text>
                              </g>
                            );
                          }}
                        />
                      ) : null}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No profit data in this date range for the selected week-wise filters.
            </Typography>
          )}

          <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell>Week band</TableCell>
                  <TableCell align="right">Resolved</TableCell>
                  <TableCell align="right">Unresolved</TableCell>
                  <TableCell align="right">Selling</TableCell>
                  <TableCell align="right">Dealer cost</TableCell>
                  <TableCell align="right">Profit</TableCell>
                  <TableCell align="right">Avg. profit/serial</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {weekWiseRows.length ? (
                  weekWiseRows.map((r) => (
                    <TableRow key={r.sortKey}>
                      <TableCell>{r.monthTitle}</TableCell>
                      <TableCell>{r.dayRangeLabel}</TableCell>
                      <TableCell align="right">{r.resolvedCount}</TableCell>
                      <TableCell align="right">{r.unresolvedCount}</TableCell>
                      <TableCell align="right">{formatCurrency(r.sellingTotal)}</TableCell>
                      <TableCell align="right">{formatCurrency(r.dealerCostTotal)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(r.profitTotal)}
                      </TableCell>
                      <TableCell align="right">
                        {r.resolvedCount > 0 ? formatCurrency(r.profitTotal / r.resolvedCount) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                      No records in this date range for the selected week-wise filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {tab === 5 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Unresolved serials (excluded from profit totals)
          </Typography>
          <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Sale date</TableCell>
                  <TableCell>Center</TableCell>
                  <TableCell>Executive</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Patient</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Serial</TableCell>
                  <TableCell align="right">Selling</TableCell>
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLines.filter((l) => !l.resolved).length ? (
                  filteredLines
                    .filter((l) => !l.resolved)
                    .map((l) => (
                      <TableRow key={l.rowId}>
                        <TableCell>{formatDate(l.saleDate)}</TableCell>
                        <TableCell>{l.centerName}</TableCell>
                        <TableCell>{l.executiveName}</TableCell>
                        <TableCell>{l.referenceLabel}</TableCell>
                        <TableCell>{l.patientName}</TableCell>
                        <TableCell>{l.productName}</TableCell>
                        <TableCell>{l.serialNumber}</TableCell>
                        <TableCell align="right">{formatCurrency(l.sellingPrice)}</TableCell>
                        <TableCell>{l.unresolvedReason || '—'}</TableCell>
                      </TableRow>
                    ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                      No unresolved serials for selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}