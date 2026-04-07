/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

/**
 * Sales report — same merge rules as Sales & Invoicing:
 * - Saved rows from `sales` (invoiced)
 * - Enquiry visit sale rows from `deriveEnquirySalesFromDocs` when not covered by a non-void invoice
 * Voided invoices are excluded from totals. No double-counting.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
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
import EnquiryProfileLink from '@/components/common/EnquiryProfileLink';
import { deriveEnquirySalesFromDocs } from '@/lib/sales-invoicing/enquiryDerivation';
import { buildUnifiedInvoiceRows } from '@/lib/sales-invoicing/mergeUnifiedRows';
import type { SaleRecord, UnifiedInvoiceRow } from '@/lib/sales-invoicing/types';
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

/** MRP discount line + table emphasis — high contrast on light/dark tooltips. */
const DISC_PCT_COLOR = '#b71c1c';

const discPctTableCellSx = {
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums' as const,
  color: DISC_PCT_COLOR,
};

type CompetitiveChartRow = {
  /** Value passed to parent to set `centerFilter` or `execFilter` (must match record keys). */
  filterKey: string;
  label: string;
  labelFull: string;
  selling: number;
  avgDiscountPct?: number;
  total: number;
  count: number;
};

function SalesCompetitiveChart({
  rows,
  gradientId,
  title,
  subtitle,
  accent = 'center',
  selectedFilterKey,
  onBarClick,
}: {
  rows: CompetitiveChartRow[];
  gradientId: string;
  title: string;
  subtitle: string;
  accent?: 'center' | 'executive' | 'source';
  /** Highlights the active bar when this matches `filterKey`. */
  selectedFilterKey?: string;
  /** Called with `filterKey`; parent toggles filter vs `all`. */
  onBarClick?: (filterKey: string) => void;
}) {
  if (!rows.length) return null;
  const tilt = rows.length > 5;
  /** Avoid overlapping text when many categories. */
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
                tick={{ fontSize: 11, fill: DISC_PCT_COLOR, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <RechartsTooltip
                cursor={{ fill: cursorFill }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as CompetitiveChartRow;
                  const name = row?.labelFull ?? row?.label ?? String(label ?? '');
                  const pct = row?.avgDiscountPct;
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
                        Records: {row?.count ?? '—'}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Taxable (selling): {formatCurrency(row?.selling ?? 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Grand total: {formatCurrency(row?.total ?? 0)}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 0.75,
                          fontWeight: 700,
                          color: DISC_PCT_COLOR,
                          letterSpacing: 0.02,
                        }}
                      >
                        Avg. discount vs MRP:{' '}
                        {pct != null && Number.isFinite(pct) ? `${pct.toFixed(1)}%` : '—'}
                      </Typography>
                    </Box>
                  );
                }}
              />
              <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
              <Bar
                yAxisId="left"
                dataKey="selling"
                name="Taxable (selling)"
                radius={[6, 6, 0, 0]}
                maxBarSize={56}
                cursor={onBarClick ? 'pointer' : 'default'}
                onClick={
                  onBarClick
                    ? (data: unknown) => {
                        const d = data as { payload?: CompetitiveChartRow };
                        const row = d?.payload;
                        const key = row?.filterKey;
                        if (key != null && String(key).length) onBarClick(String(key));
                      }
                    : undefined
                }
              >
                {showValueLabels ? (
                  <LabelList
                    dataKey="selling"
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
                dataKey="avgDiscountPct"
                name="Avg. discount % vs MRP"
                stroke={DISC_PCT_COLOR}
                strokeWidth={2.5}
                dot={{ r: 4, fill: DISC_PCT_COLOR, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6 }}
                style={{ pointerEvents: 'none' }}
              >
                {showValueLabels ? (
                  <LabelList
                    dataKey="avgDiscountPct"
                    position="top"
                    offset={10}
                    formatter={(v: number | string) =>
                      v != null && v !== '' && Number.isFinite(Number(v)) ? `${Number(v).toFixed(1)}%` : ''
                    }
                    style={{ fill: DISC_PCT_COLOR, fontSize: 11, fontWeight: 700 }}
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

const escapeCsv = (value: any) => {
  const s = (value ?? '').toString();
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const downloadCsv = (fileName: string, headers: string[], rows: any[][]) => {
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

/** Local calendar month (avoids UTC shift from toISOString). */
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

type NormalizedSale = {
  rowId: string;
  recordKind: 'invoiced' | 'uninvoiced';
  invoiceNumber: string | null;
  date: Date;
  patientName: string;
  enquiryId?: string;
  centerId: string;
  centerName: string;
  centerKey: string;
  executiveName: string;
  subtotal: number;
  gstAmount: number;
  total: number;
  /** Σ MRP on lines where MRP &gt; 0 (catalog / visit HA lines). */
  discountMrpBasis: number;
  /** Σ max(0, MRP − pre-tax selling) on those lines (matches invoice line discount). */
  discountOffMrp: number;
  /** Stable bucket for enquiry reference / doctor / direct (see `resolveReferenceSource`). */
  referenceKey: string;
  /** Display label for reference source. */
  referenceLabel: string;
};

type Center = { id: string; name?: string; isHeadOffice?: boolean };

const LEGACY_INVENTORY_BRANCHES = new Set([
  'main branch',
  'north branch',
  'south branch',
  'east branch',
  'west branch',
]);

function baseCenterMatchKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+(center|branch)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type CenterResolveContext = {
  idToName: Map<string, string>;
  nameLowerToId: Map<string, string>;
  baseKeyToId: Map<string, string>;
  headOfficeId: string | null;
};

function buildCenterResolveContext(centers: Center[]): CenterResolveContext {
  const idToName = new Map<string, string>();
  const nameLowerToId = new Map<string, string>();
  const baseKeyToId = new Map<string, string>();

  centers.forEach((c) => {
    const n = (c.name || '').toString().trim();
    const label = n || c.id;
    idToName.set(c.id, label);
    const low = n.toLowerCase();
    if (low) nameLowerToId.set(low, c.id);
    const bk = baseCenterMatchKey(n);
    if (bk && !baseKeyToId.has(bk)) baseKeyToId.set(bk, c.id);
  });

  const headOfficeId = centers.find((c) => !!c.isHeadOffice)?.id ?? null;
  return { idToName, nameLowerToId, baseKeyToId, headOfficeId };
}

function resolveCenter(
  rawCenterId: string | undefined,
  branchOrName: string,
  ctx: CenterResolveContext,
): { centerKey: string; centerId: string; centerName: string } {
  const id = (rawCenterId || '').toString().trim();
  if (id && ctx.idToName.has(id)) {
    const label = ctx.idToName.get(id)!;
    return { centerKey: id, centerId: id, centerName: label };
  }

  const branch = (branchOrName || '').toString().trim();
  const lower = branch.toLowerCase();

  if (LEGACY_INVENTORY_BRANCHES.has(lower) && ctx.headOfficeId && ctx.idToName.has(ctx.headOfficeId)) {
    const hid = ctx.headOfficeId;
    const label = ctx.idToName.get(hid)!;
    return { centerKey: hid, centerId: hid, centerName: label };
  }

  if (lower && ctx.nameLowerToId.has(lower)) {
    const cid = ctx.nameLowerToId.get(lower)!;
    const label = ctx.idToName.get(cid)!;
    return { centerKey: cid, centerId: cid, centerName: label };
  }

  const bk = baseCenterMatchKey(branch);
  if (bk && ctx.baseKeyToId.has(bk)) {
    const cid = ctx.baseKeyToId.get(bk)!;
    const label = ctx.idToName.get(cid)!;
    return { centerKey: cid, centerId: cid, centerName: label };
  }

  if (!branch) {
    return { centerKey: '__unassigned__', centerId: '', centerName: '—' };
  }
  const slug = lower.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unknown';
  return {
    centerKey: `__orphan__:${slug}`,
    centerId: '',
    centerName: branch,
  };
}

function tsToDate(t: Timestamp | undefined): Date {
  if (!t) return new Date();
  return t.toDate ? t.toDate() : new Date();
}

function saleGrandTotalRecord(s: SaleRecord): number {
  const g = s.grandTotal;
  if (typeof g === 'number' && !Number.isNaN(g) && g > 0) return g;
  return (s.totalAmount || 0) + (s.gstAmount || 0);
}

/** Same visit index as `deriveEnquirySalesFromDocs` (primary `visits`, else `visitSchedules`). */
function resolveVisitAtIndex(e: any, index: number): any {
  if (!e || typeof index !== 'number' || index < 0) return {};
  const visits: any[] = Array.isArray(e.visits) ? e.visits : [];
  const v = visits[index];
  if (v && typeof v === 'object') return v;
  const sched: any[] = Array.isArray(e.visitSchedules) ? e.visitSchedules : [];
  const s = sched[index];
  return s && typeof s === 'object' ? s : {};
}

function getWhoSoldFromVisit(visit: any): string {
  if (!visit || typeof visit !== 'object') return '';
  const nested = String(visit.hearingAidDetails?.whoSold || '').trim();
  const flat = String(visit.hearingAidBrand || '').trim();
  return nested || flat || '';
}

/**
 * Weighted discount vs list (MRP): sum(discount rupee) / sum(MRP) on product lines with MRP &gt; 0.
 * Uses stored `discount` when present; else MRP − selling (pre-GST).
 */
function aggregateDiscountFromProductLines(products: unknown[] | undefined): {
  mrpSum: number;
  discountSum: number;
} {
  let mrpSum = 0;
  let discountSum = 0;
  if (!Array.isArray(products)) return { mrpSum, discountSum };
  for (const raw of products) {
    const p = raw as Record<string, unknown>;
    const mrp = Number(p.mrp) || 0;
    if (mrp <= 0) continue;
    const selling = Number(p.sellingPrice ?? p.finalAmount ?? 0) || 0;
    const explicit = Number(p.discount);
    let off = 0;
    if (Number.isFinite(explicit) && explicit >= 0) {
      off = Math.min(explicit, mrp);
    } else {
      const dp = Number(p.discountPercent);
      if (Number.isFinite(dp) && dp >= 0 && dp <= 100) {
        off = Math.min(mrp, (mrp * dp) / 100);
      } else {
        off = Math.max(0, mrp - selling);
      }
    }
    mrpSum += mrp;
    discountSum += off;
  }
  return { mrpSum, discountSum };
}

/** Humanize stored reference option values (e.g. `google_ads` → title case words). */
function humanizeReferenceLabel(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '—';
  return s
    .replace(/_/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Attribution for reports: primary enquiry reference (first selected), else referring doctor on invoice,
 * else direct/manual when no enquiry.
 */
function resolveReferenceSource(
  enquiry: any,
  sale: SaleRecord | null,
): { key: string; label: string } {
  const refs = Array.isArray(enquiry?.reference)
    ? enquiry.reference
    : enquiry?.reference != null && String(enquiry.reference).trim() !== ''
      ? [enquiry.reference]
      : [];
  const refStrs = refs.map((x: unknown) => String(x).trim()).filter(Boolean);
  if (refStrs.length > 0) {
    const primary = refStrs[0];
    const key = `ref:${primary.toLowerCase()}`;
    return { key, label: humanizeReferenceLabel(primary) };
  }
  const doc = sale && String(sale.referenceDoctor?.name || '').trim();
  if (doc) {
    const key = `doc:${doc.toLowerCase()}`;
    return { key, label: `Doctor: ${doc}` };
  }
  if (sale && !sale.enquiryId) {
    return { key: 'direct', label: 'Direct / manual' };
  }
  if (sale?.source === 'manual') {
    return { key: 'direct', label: 'Direct / manual' };
  }
  return { key: '__unspecified__', label: 'Unspecified' };
}

function getSalespersonNameFromSaleDoc(s: SaleRecord): string {
  const sp = (s as any).salesperson;
  if (typeof sp === 'string' && sp.trim()) return sp.trim();
  if (sp && typeof sp === 'object' && typeof sp.name === 'string' && sp.name.trim()) return sp.name.trim();
  const sn = (s as any).salespersonName;
  if (typeof sn === 'string' && sn.trim()) return sn.trim();
  const staffName = (s as any).staffName;
  if (typeof staffName === 'string' && staffName.trim()) return staffName.trim();
  return '';
}

function mapUnifiedRowsToRecords(
  unified: UnifiedInvoiceRow[],
  resolveCtx: CenterResolveContext,
  enquiryById: Map<string, any>,
): NormalizedSale[] {
  const out: NormalizedSale[] = [];

  for (const r of unified) {
    if (r.kind === 'saved' && r.savedSale) {
      if (r.isCancelled) continue;
      const s = r.savedSale;
      const date = tsToDate(s.saleDate);
      const branch = (s.branch || '').toString();
      const rc = resolveCenter((s.centerId || '').toString().trim() || undefined, branch, resolveCtx);
      let exec = getSalespersonNameFromSaleDoc(s);
      const eid = s.enquiryId != null ? String(s.enquiryId) : '';
      const vIdx = s.enquiryVisitIndex;
      if (eid && typeof vIdx === 'number') {
        const enq = enquiryById.get(eid);
        const fromVisit = getWhoSoldFromVisit(resolveVisitAtIndex(enq, vIdx));
        if (fromVisit) exec = fromVisit;
      }
      if (!exec) exec = '—';
      const discAgg = aggregateDiscountFromProductLines(s.products as unknown[]);
      const enq = eid ? enquiryById.get(eid) : undefined;
      const refSrc = resolveReferenceSource(enq, s);
      out.push({
        rowId: r.rowId,
        recordKind: 'invoiced',
        invoiceNumber: s.invoiceNumber || null,
        date,
        patientName: (s.patientName || '—').toString(),
        enquiryId: s.enquiryId ? String(s.enquiryId) : undefined,
        centerId: rc.centerId,
        centerName: rc.centerName,
        centerKey: rc.centerKey,
        executiveName: String(exec),
        subtotal: Number(s.totalAmount || 0),
        gstAmount: Number(s.gstAmount || 0),
        total: saleGrandTotalRecord(s),
        discountMrpBasis: discAgg.mrpSum,
        discountOffMrp: discAgg.discountSum,
        referenceKey: refSrc.key,
        referenceLabel: refSrc.label,
      });
      continue;
    }

    if (r.kind === 'enquiry_pending' && r.derivedEnquiry) {
      const d = r.derivedEnquiry;
      const e = d.enquiryId ? enquiryById.get(d.enquiryId) : undefined;
      const visit = e ? resolveVisitAtIndex(e, d.visitIndex) : {};
      const date = tsToDate(d.visitDate);
      const rawCenter = (e?.center || '').toString().trim();
      const rc = resolveCenter(rawCenter || undefined, '', resolveCtx);
      const exec =
        String(d.whoSoldName || '').trim() ||
        getWhoSoldFromVisit(visit) ||
        String(e?.assignedTo || '').trim() ||
        '—';
      const gst = Number(d.gstAmount || 0);
      const total =
        typeof d.grandTotal === 'number' && d.grandTotal > 0
          ? Number(d.grandTotal)
          : Number(d.totalAmount || 0);
      const subtotal = Math.max(0, total - gst);
      const discAgg = aggregateDiscountFromProductLines(d.products as unknown[]);
      const refSrc = resolveReferenceSource(e, null);

      out.push({
        rowId: r.rowId,
        recordKind: 'uninvoiced',
        invoiceNumber: null,
        date,
        patientName: (d.patientName || '—').toString(),
        enquiryId: d.enquiryId ? String(d.enquiryId) : undefined,
        centerId: rc.centerId,
        centerName: rc.centerName,
        centerKey: rc.centerKey,
        executiveName: String(exec),
        subtotal,
        gstAmount: gst,
        total,
        discountMrpBasis: discAgg.mrpSum,
        discountOffMrp: discAgg.discountSum,
        referenceKey: refSrc.key,
        referenceLabel: refSrc.label,
      });
    }
  }

  return out.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function inRange(d: Date, from?: Date | null, to?: Date | null) {
  const t = d.getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

/** 0-based index: days 1–7 → 0, 8–14 → 1, … within the calendar month (local). */
function getMonthWeekIndex(d: Date): number {
  return Math.floor((d.getDate() - 1) / 7);
}

/**
 * Buckets each sale into a fixed “week of month” band (7-day chunks) for analysis.
 * Week 1 = days 1–7, week 2 = 8–14, … last band may be shorter (e.g. 29–31).
 */
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

type WeekBucketRow = {
  sortKey: string;
  monthTitle: string;
  dayRangeLabel: string;
  weekIndex: number;
  count: number;
  subtotal: number;
  gstAmount: number;
  total: number;
  discountMrpBasis: number;
  discountOffMrp: number;
};

export default function SalesReportsTab() {
  const [tab, setTab] = useState(0);

  const [dateFrom, setDateFrom] = useState(() => getLocalMonthDateStrings().fromStr);
  const [dateTo, setDateTo] = useState(() => getLocalMonthDateStrings().toStr);
  const [centerFilter, setCenterFilter] = useState<string>('all');
  const [execFilter, setExecFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  /** Week-wise tab only: empty arrays = all centers / references / salespeople. */
  const [weekCenterIds, setWeekCenterIds] = useState<string[]>([]);
  const [weekReferenceKeys, setWeekReferenceKeys] = useState<string[]>([]);
  const [weekEmployeeNames, setWeekEmployeeNames] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [records, setRecords] = useState<NormalizedSale[]>([]);

  const dateFromObj = useMemo(() => (dateFrom ? new Date(`${dateFrom}T00:00:00`) : null), [dateFrom]);
  const dateToObj = useMemo(() => (dateTo ? new Date(`${dateTo}T23:59:59.999`) : null), [dateTo]);

  const centerNameById = useMemo(() => {
    const m = new Map<string, string>();
    centers.forEach((c) => m.set(c.id, (c.name || c.id).toString()));
    return m;
  }, [centers]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [centersSnap, salesSnap, enquiriesSnap] = await Promise.all([
        getDocs(collection(db, 'centers')),
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'enquiries')),
      ]);

      const centersList: Center[] = centersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
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
      const mapped = mapUnifiedRowsToRecords(unified, resolveCtx, enquiryById);
      setRecords(mapped);
    } catch (err) {
      console.error('Failed to fetch sales reports:', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRecords = useMemo(() => {
    return records.filter((s) => {
      if (!inRange(s.date, dateFromObj, dateToObj)) return false;
      if (centerFilter !== 'all' && s.centerKey !== centerFilter) return false;
      if (execFilter !== 'all' && s.executiveName !== execFilter) return false;
      if (sourceFilter !== 'all' && s.referenceKey !== sourceFilter) return false;
      return true;
    });
  }, [records, dateFromObj, dateToObj, centerFilter, execFilter, sourceFilter]);

  const centerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    centers.forEach((c) => seen.set(c.id, centerNameById.get(c.id) || c.id));
    records.forEach((s) => {
      if (!seen.has(s.centerKey)) seen.set(s.centerKey, s.centerName);
    });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [centers, centerNameById, records]);

  /** Display name for the selected center (Source-wise tab + chart subtitle). */
  const sourceTabCenterLabel = useMemo(() => {
    if (centerFilter === 'all') return null;
    const o = centerOptions.find((c) => c.id === centerFilter);
    return o?.name ?? centerFilter;
  }, [centerFilter, centerOptions]);

  const sourceWiseChartSubtitle = useMemo(() => {
    const base =
      'Enquiry reference (primary), else doctor on invoice, else direct. Same taxable vs discount line as other tabs.';
    if (centerFilter === 'all') {
      return `${base} Use Center on this tab (or above) to limit the breakdown by location.`;
    }
    return `${base} Scoped to center: ${sourceTabCenterLabel ?? centerFilter}.`;
  }, [centerFilter, sourceTabCenterLabel]);

  const execOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach((s) => set.add((s.executiveName || '—').toString()));
    return Array.from(set)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [records]);

  const sourceOptions = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((s) => {
      const k = s.referenceKey;
      if (!map.has(k)) map.set(k, s.referenceLabel);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [records]);

  /** Date range from the top + multi-selects (independent of the single-select filters on other tabs). */
  const weekViewRecords = useMemo(() => {
    return records.filter((s) => {
      if (!inRange(s.date, dateFromObj, dateToObj)) return false;
      if (weekCenterIds.length > 0 && !weekCenterIds.includes(s.centerKey)) return false;
      if (weekReferenceKeys.length > 0 && !weekReferenceKeys.includes(s.referenceKey)) return false;
      if (weekEmployeeNames.length > 0 && !weekEmployeeNames.includes(s.executiveName)) return false;
      return true;
    });
  }, [records, dateFromObj, dateToObj, weekCenterIds, weekReferenceKeys, weekEmployeeNames]);

  const weekWiseRows = useMemo((): WeekBucketRow[] => {
    const map = new Map<string, WeekBucketRow>();
    for (const s of weekViewRecords) {
      const meta = getMonthWeekMeta(s.date);
      const key = meta.sortKey;
      const prev = map.get(key);
      if (prev) {
        map.set(key, {
          ...prev,
          count: prev.count + 1,
          subtotal: prev.subtotal + (s.subtotal || 0),
          gstAmount: prev.gstAmount + (s.gstAmount || 0),
          total: prev.total + (s.total || 0),
          discountMrpBasis: prev.discountMrpBasis + (s.discountMrpBasis || 0),
          discountOffMrp: prev.discountOffMrp + (s.discountOffMrp || 0),
        });
      } else {
        map.set(key, {
          sortKey: key,
          monthTitle: meta.monthTitle,
          dayRangeLabel: meta.dayRangeLabel,
          weekIndex: meta.weekIndex,
          count: 1,
          subtotal: s.subtotal || 0,
          gstAmount: s.gstAmount || 0,
          total: s.total || 0,
          discountMrpBasis: s.discountMrpBasis || 0,
          discountOffMrp: s.discountOffMrp || 0,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [weekViewRecords]);

  const weekTotals = useMemo(() => {
    const subtotal = weekWiseRows.reduce((a, r) => a + r.subtotal, 0);
    const gst = weekWiseRows.reduce((a, r) => a + r.gstAmount, 0);
    const total = weekWiseRows.reduce((a, r) => a + r.total, 0);
    const count = weekWiseRows.reduce((a, r) => a + r.count, 0);
    const discountMrpBasis = weekWiseRows.reduce((a, r) => a + r.discountMrpBasis, 0);
    const discountOffMrp = weekWiseRows.reduce((a, r) => a + r.discountOffMrp, 0);
    const avgDiscountPct =
      discountMrpBasis > 0 ? (100 * discountOffMrp) / discountMrpBasis : null;
    return { subtotal, gst, total, count, discountMrpBasis, discountOffMrp, avgDiscountPct };
  }, [weekWiseRows]);

  const weekChartData = useMemo(() => {
    return weekWiseRows.map((r) => {
      const monthWord = r.monthTitle.split(' ')[0] || r.monthTitle;
      const avgDiscountPct =
        r.discountMrpBasis > 0 ? (100 * r.discountOffMrp) / r.discountMrpBasis : null;
      return {
        sortKey: r.sortKey,
        chartLabel: `${monthWord} · ${r.dayRangeLabel}`,
        subtotal: r.subtotal,
        total: r.total,
        count: r.count,
        avgDiscountPct,
      };
    });
  }, [weekWiseRows]);

  const showWeekBarLabels = weekChartData.length > 0 && weekChartData.length <= 14;

  const centerWise = useMemo(() => {
    const map = new Map<
      string,
      {
        centerKey: string;
        center: string;
        count: number;
        total: number;
        /** Sum of taxable / pre-GST selling (same as invoice subtotal). */
        subtotal: number;
        discountMrpBasis: number;
        discountOffMrp: number;
      }
    >();
    filteredRecords.forEach((s) => {
      const key = s.centerKey;
      const name = s.centerName;
      const prev = map.get(key) || {
        centerKey: key,
        center: name,
        count: 0,
        total: 0,
        subtotal: 0,
        discountMrpBasis: 0,
        discountOffMrp: 0,
      };
      map.set(key, {
        centerKey: key,
        center: name,
        count: prev.count + 1,
        total: prev.total + (s.total || 0),
        subtotal: prev.subtotal + (s.subtotal || 0),
        discountMrpBasis: prev.discountMrpBasis + (s.discountMrpBasis || 0),
        discountOffMrp: prev.discountOffMrp + (s.discountOffMrp || 0),
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredRecords]);

  const centerWiseChartRows = useMemo(() => {
    return centerWise.map((r) => {
      const avgDiscountPct: number | undefined =
        r.discountMrpBasis > 0 ? (100 * r.discountOffMrp) / r.discountMrpBasis : undefined;
      return {
        filterKey: r.centerKey,
        label: r.center.length > 22 ? `${r.center.slice(0, 20)}…` : r.center,
        labelFull: r.center,
        selling: r.subtotal,
        avgDiscountPct,
        total: r.total,
        count: r.count,
      };
    });
  }, [centerWise]);

  const execWise = useMemo(() => {
    const map = new Map<
      string,
      {
        executive: string;
        count: number;
        total: number;
        subtotal: number;
        discountMrpBasis: number;
        discountOffMrp: number;
      }
    >();
    filteredRecords.forEach((s) => {
      const key = s.executiveName || '—';
      const prev = map.get(key) || {
        executive: key,
        count: 0,
        total: 0,
        subtotal: 0,
        discountMrpBasis: 0,
        discountOffMrp: 0,
      };
      map.set(key, {
        executive: key,
        count: prev.count + 1,
        total: prev.total + (s.total || 0),
        subtotal: prev.subtotal + (s.subtotal || 0),
        discountMrpBasis: prev.discountMrpBasis + (s.discountMrpBasis || 0),
        discountOffMrp: prev.discountOffMrp + (s.discountOffMrp || 0),
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredRecords]);

  const execWiseChartRows = useMemo(() => {
    return execWise.map((r) => {
      const avgDiscountPct: number | undefined =
        r.discountMrpBasis > 0 ? (100 * r.discountOffMrp) / r.discountMrpBasis : undefined;
      const name = r.executive;
      return {
        filterKey: r.executive,
        label: name.length > 22 ? `${name.slice(0, 20)}…` : name,
        labelFull: name,
        selling: r.subtotal,
        avgDiscountPct,
        total: r.total,
        count: r.count,
      };
    });
  }, [execWise]);

  const handleCenterChartBarClick = useCallback((filterKey: string) => {
    setCenterFilter((prev) => (prev === filterKey ? 'all' : filterKey));
    setExecFilter('all');
    setSourceFilter('all');
  }, []);

  const handleExecChartBarClick = useCallback((filterKey: string) => {
    setExecFilter((prev) => (prev === filterKey ? 'all' : filterKey));
    setCenterFilter('all');
    setSourceFilter('all');
  }, []);

  const handleSourceChartBarClick = useCallback((filterKey: string) => {
    setSourceFilter((prev) => (prev === filterKey ? 'all' : filterKey));
  }, []);

  const totals = useMemo(() => {
    const subtotal = filteredRecords.reduce((sum, s) => sum + (s.subtotal || 0), 0);
    const gst = filteredRecords.reduce((sum, s) => sum + (s.gstAmount || 0), 0);
    const total = filteredRecords.reduce((sum, s) => sum + (s.total || 0), 0);
    const discountMrpBasis = filteredRecords.reduce((sum, s) => sum + (s.discountMrpBasis || 0), 0);
    const discountOffMrp = filteredRecords.reduce((sum, s) => sum + (s.discountOffMrp || 0), 0);
    const avgDiscountPct =
      discountMrpBasis > 0 ? (100 * discountOffMrp) / discountMrpBasis : null;
    return { subtotal, gst, total, discountMrpBasis, discountOffMrp, avgDiscountPct };
  }, [filteredRecords]);

  const exportCenterWise = () => {
    const headers = [
      'Center',
      'Record count',
      'Taxable / selling (INR)',
      'Avg. discount % vs MRP',
      'Grand total (INR)',
    ];
    const rows = centerWise.map((r) => {
      const pct =
        r.discountMrpBasis > 0 ? ((100 * r.discountOffMrp) / r.discountMrpBasis).toFixed(1) : '';
      return [r.center, r.count, r.subtotal, pct ? `${pct}%` : '', r.total];
    });
    downloadCsv(`center-wise-sales-${dateFrom || 'all'}-to-${dateTo || 'all'}.csv`, headers, rows);
  };

  const exportExecWise = () => {
    const headers = [
      'Salesperson',
      'Record count',
      'Taxable / selling (INR)',
      'Avg. discount % vs MRP',
      'Grand total (INR)',
    ];
    const rows = execWise.map((r) => {
      const pct =
        r.discountMrpBasis > 0 ? ((100 * r.discountOffMrp) / r.discountMrpBasis).toFixed(1) : '';
      return [r.executive, r.count, r.subtotal, pct ? `${pct}%` : '', r.total];
    });
    downloadCsv(`executive-wise-sales-${dateFrom || 'all'}-to-${dateTo || 'all'}.csv`, headers, rows);
  };

  const sourceWise = useMemo(() => {
    const map = new Map<
      string,
      {
        referenceKey: string;
        referenceLabel: string;
        count: number;
        total: number;
        subtotal: number;
        discountMrpBasis: number;
        discountOffMrp: number;
      }
    >();
    filteredRecords.forEach((s) => {
      const key = s.referenceKey;
      const label = s.referenceLabel;
      const prev = map.get(key) || {
        referenceKey: key,
        referenceLabel: label,
        count: 0,
        total: 0,
        subtotal: 0,
        discountMrpBasis: 0,
        discountOffMrp: 0,
      };
      map.set(key, {
        referenceKey: key,
        referenceLabel: label,
        count: prev.count + 1,
        total: prev.total + (s.total || 0),
        subtotal: prev.subtotal + (s.subtotal || 0),
        discountMrpBasis: prev.discountMrpBasis + (s.discountMrpBasis || 0),
        discountOffMrp: prev.discountOffMrp + (s.discountOffMrp || 0),
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredRecords]);

  const sourceWiseChartRows = useMemo(() => {
    return sourceWise.map((r) => {
      const avgDiscountPct: number | undefined =
        r.discountMrpBasis > 0 ? (100 * r.discountOffMrp) / r.discountMrpBasis : undefined;
      const name = r.referenceLabel;
      return {
        filterKey: r.referenceKey,
        label: name.length > 22 ? `${name.slice(0, 20)}…` : name,
        labelFull: name,
        selling: r.subtotal,
        avgDiscountPct,
        total: r.total,
        count: r.count,
      };
    });
  }, [sourceWise]);

  const exportSourceWise = () => {
    const headers = [
      'Reference / source',
      'Record count',
      'Taxable / selling (INR)',
      'Avg. discount % vs MRP',
      'Grand total (INR)',
    ];
    const rows = sourceWise.map((r) => {
      const pct =
        r.discountMrpBasis > 0 ? ((100 * r.discountOffMrp) / r.discountMrpBasis).toFixed(1) : '';
      return [r.referenceLabel, r.count, r.subtotal, pct ? `${pct}%` : '', r.total];
    });
    downloadCsv(`source-wise-sales-${dateFrom || 'all'}-to-${dateTo || 'all'}.csv`, headers, rows);
  };

  const formatPct = (n: number | null) =>
    n == null || !Number.isFinite(n) ? '' : `${n.toFixed(1)}%`;

  const exportAllRecords = () => {
    const headers = [
      'Date',
      'Type',
      'Invoice #',
      'Patient',
      'Center',
      'Salesperson',
      'Taxable',
      'GST',
      'Grand total',
      'Discount % vs MRP (line-weighted)',
      'Reference / source',
      'Enquiry ID',
    ];
    const rows = filteredRecords.map((r) => {
      const basis = r.discountMrpBasis || 0;
      const rowPct = basis > 0 ? (100 * (r.discountOffMrp || 0)) / basis : null;
      return [
        r.date.toLocaleDateString(),
        r.recordKind === 'invoiced' ? 'Invoiced' : 'Uninvoiced (enquiry)',
        r.invoiceNumber || '',
        r.patientName,
        r.centerName,
        r.executiveName,
        r.subtotal,
        r.gstAmount,
        r.total,
        formatPct(rowPct),
        r.referenceLabel,
        r.enquiryId || '',
      ];
    });
    downloadCsv(`sales-records-${dateFrom || 'all'}-to-${dateTo || 'all'}.csv`, headers, rows);
  };

  const exportWeekWise = () => {
    const headers = [
      'Month',
      'Day range (local)',
      'Week band (1–5)',
      'Records',
      'Taxable (INR)',
      'GST (INR)',
      'Grand total (INR)',
      'Avg. discount % vs MRP',
    ];
    const rows = weekWiseRows.map((r) => {
      const pct =
        r.discountMrpBasis > 0 ? ((100 * r.discountOffMrp) / r.discountMrpBasis).toFixed(1) : '';
      return [
        r.monthTitle,
        r.dayRangeLabel,
        String(r.weekIndex + 1),
        r.count,
        r.subtotal,
        r.gstAmount,
        r.total,
        pct ? `${pct}%` : '',
      ];
    });
    downloadCsv(`week-wise-sales-${dateFrom || 'all'}-to-${dateTo || 'all'}.csv`, headers, rows);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Combines <strong>saved invoices</strong> (<code>sales</code>) with <strong>uninvoiced sale visits</strong>{' '}
          on enquiries — same merge as <strong>Sales &amp; Invoicing</strong>. Voided invoices are excluded; visits
          already covered by an invoice are not duplicated.
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={2.5}>
            <TextField
              label="From"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2.5}>
            <TextField
              label="To"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="center-filter-label">Center</InputLabel>
              <Select
                labelId="center-filter-label"
                label="Center"
                value={centerFilter}
                onChange={(e) => setCenterFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {centerOptions.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="exec-filter-label">Salesperson</InputLabel>
              <Select
                labelId="exec-filter-label"
                label="Salesperson"
                value={execFilter}
                onChange={(e) => setExecFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {execOptions.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={1}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchData}
              sx={{ height: 40 }}
            >
              Refresh
            </Button>
          </Grid>
        </Grid>
        <Grid container spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="source-filter-label">Reference / source</InputLabel>
              <Select
                labelId="source-filter-label"
                label="Reference / source"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {sourceOptions.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={8}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pt: 0.5 }}>
              From enquiry <strong>Reference</strong> (first selected), else invoice <strong>Doctor referral</strong>, else
              direct/manual.
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="caption" color="text.secondary">
              Records (filtered)
            </Typography>
            <Typography variant="h6">{filteredRecords.length}</Typography>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="caption" color="text.secondary">
              Taxable (subtotal)
            </Typography>
            <Typography variant="h6">{formatCurrency(totals.subtotal)}</Typography>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="caption" color="text.secondary">
              GST
            </Typography>
            <Typography variant="h6">{formatCurrency(totals.gst)}</Typography>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="caption" color="text.secondary">
              Grand total
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {formatCurrency(totals.total)}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <Typography variant="caption" color="text.secondary">
              Avg. discount vs MRP
            </Typography>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                color: DISC_PCT_COLOR,
                fontVariantNumeric: 'tabular-nums',
              }}
              title="Σ(line discount) ÷ Σ(MRP) on product lines with MRP"
            >
              {totals.avgDiscountPct != null ? `${totals.avgDiscountPct.toFixed(1)}%` : '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Weighted by list (MRP); HA lines only
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} variant="outlined" sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="sales reports tabs"
        >
          <Tab label="Center-wise Sales" />
          <Tab label="Executive-wise Sales" />
          <Tab label="Source-wise Sales" />
          <Tab label="Week-wise (month)" />
        </Tabs>
      </Paper>

      {tab === 0 && (
        <Box sx={{ mb: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6">Center-wise</Typography>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCenterWise}>
              Export CSV
            </Button>
          </Box>
          {centerWiseChartRows.length > 0 && (
            <SalesCompetitiveChart
              rows={centerWiseChartRows}
              gradientId="centerBarSelling"
              title="By center"
              subtitle="Bars: sum of taxable (pre-GST selling). Line: MRP-weighted avg. discount % — hover for details."
              accent="center"
              selectedFilterKey={centerFilter}
              onBarClick={handleCenterChartBarClick}
            />
          )}
          <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Center</TableCell>
                  <TableCell align="right">Records</TableCell>
                  <TableCell align="right">Taxable (selling)</TableCell>
                  <TableCell align="right">Avg. disc. %</TableCell>
                  <TableCell align="right">Grand total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {centerWise.length ? (
                  <>
                    {centerWise.map((r) => {
                      const pct =
                        r.discountMrpBasis > 0
                          ? (100 * r.discountOffMrp) / r.discountMrpBasis
                          : null;
                      return (
                        <TableRow key={r.centerKey} hover>
                          <TableCell>{r.center}</TableCell>
                          <TableCell align="right">{r.count}</TableCell>
                          <TableCell align="right">{formatCurrency(r.subtotal)}</TableCell>
                          <TableCell align="right" sx={discPctTableCellSx}>
                            {pct != null ? `${pct.toFixed(1)}%` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatCurrency(r.total)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {filteredRecords.length}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(totals.subtotal)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, ...discPctTableCellSx }}>
                        {totals.avgDiscountPct != null ? `${totals.avgDiscountPct.toFixed(1)}%` : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(totals.total)}
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      No records in this date range for the selected filters.
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
            <Typography variant="h6">Executive-wise</Typography>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportExecWise}>
              Export CSV
            </Button>
          </Box>
          {execWiseChartRows.length > 0 && (
            <SalesCompetitiveChart
              rows={execWiseChartRows}
              gradientId="execBarSelling"
              title="By salesperson"
              subtitle="Compare volume (taxable) vs discount depth. Same MRP-weighted discount % as center-wise."
              accent="executive"
              selectedFilterKey={execFilter}
              onBarClick={handleExecChartBarClick}
            />
          )}
          <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Salesperson</TableCell>
                  <TableCell align="right">Records</TableCell>
                  <TableCell align="right">Taxable (selling)</TableCell>
                  <TableCell align="right">Avg. disc. %</TableCell>
                  <TableCell align="right">Grand total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {execWise.length ? (
                  <>
                    {execWise.map((r) => {
                      const pct =
                        r.discountMrpBasis > 0
                          ? (100 * r.discountOffMrp) / r.discountMrpBasis
                          : null;
                      return (
                        <TableRow key={r.executive} hover>
                          <TableCell>{r.executive}</TableCell>
                          <TableCell align="right">{r.count}</TableCell>
                          <TableCell align="right">{formatCurrency(r.subtotal)}</TableCell>
                          <TableCell align="right" sx={discPctTableCellSx}>
                            {pct != null ? `${pct.toFixed(1)}%` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatCurrency(r.total)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {filteredRecords.length}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(totals.subtotal)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, ...discPctTableCellSx }}>
                        {totals.avgDiscountPct != null ? `${totals.avgDiscountPct.toFixed(1)}%` : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(totals.total)}
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      No records in this date range for the selected filters.
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
          <Box
            display="flex"
            flexWrap="wrap"
            alignItems="flex-start"
            justifyContent="space-between"
            gap={1.5}
            mb={1}
          >
            <Box sx={{ minWidth: 200 }}>
              <Typography variant="h6">Source-wise</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                Filter by center here or in the filters above — chart and table follow the same scope.
              </Typography>
            </Box>
            <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="source-tab-center-filter-label">Center</InputLabel>
                <Select
                  labelId="source-tab-center-filter-label"
                  label="Center"
                  value={centerFilter}
                  onChange={(e) => setCenterFilter(e.target.value)}
                >
                  <MenuItem value="all">All centers</MenuItem>
                  {centerOptions.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportSourceWise}>
                Export CSV
              </Button>
            </Box>
          </Box>
          {sourceWiseChartRows.length > 0 && (
            <SalesCompetitiveChart
              rows={sourceWiseChartRows}
              gradientId="sourceBarSelling"
              title="By reference / source"
              subtitle={sourceWiseChartSubtitle}
              accent="source"
              selectedFilterKey={sourceFilter}
              onBarClick={handleSourceChartBarClick}
            />
          )}
          <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Reference / source</TableCell>
                  <TableCell align="right">Records</TableCell>
                  <TableCell align="right">Taxable (selling)</TableCell>
                  <TableCell align="right">Avg. disc. %</TableCell>
                  <TableCell align="right">Grand total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sourceWise.length ? (
                  <>
                    {sourceWise.map((r) => {
                      const pct =
                        r.discountMrpBasis > 0
                          ? (100 * r.discountOffMrp) / r.discountMrpBasis
                          : null;
                      return (
                        <TableRow key={r.referenceKey} hover>
                          <TableCell>{r.referenceLabel}</TableCell>
                          <TableCell align="right">{r.count}</TableCell>
                          <TableCell align="right">{formatCurrency(r.subtotal)}</TableCell>
                          <TableCell align="right" sx={discPctTableCellSx}>
                            {pct != null ? `${pct.toFixed(1)}%` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatCurrency(r.total)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {filteredRecords.length}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(totals.subtotal)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, ...discPctTableCellSx }}>
                        {totals.avgDiscountPct != null ? `${totals.avgDiscountPct.toFixed(1)}%` : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(totals.total)}
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      No records in this date range for the selected filters.
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
          <Box
            display="flex"
            flexWrap="wrap"
            alignItems="flex-start"
            justifyContent="space-between"
            gap={1.5}
            mb={1.5}
          >
            <Box sx={{ minWidth: 220 }}>
              <Typography variant="h6">Week-wise (within each month)</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                Uses the <strong>From / To</strong> range above. Each month is split into five 7-day bands (days
                1–7, 8–14, …; last band may be shorter). Filters below are multi-select; leave empty for all.
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
                  freeSolo={false}
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
            <Grid container spacing={2} sx={{ mb: weekChartData.length ? 2 : 0 }}>
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="caption" color="text.secondary">
                  Records (week view)
                </Typography>
                <Typography variant="h6">{weekViewRecords.length}</Typography>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="caption" color="text.secondary">
                  Taxable
                </Typography>
                <Typography variant="h6">{formatCurrency(weekTotals.subtotal)}</Typography>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="caption" color="text.secondary">
                  Grand total
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {formatCurrency(weekTotals.total)}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="caption" color="text.secondary">
                  Avg. discount vs MRP
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    color: DISC_PCT_COLOR,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {weekTotals.avgDiscountPct != null ? `${weekTotals.avgDiscountPct.toFixed(1)}%` : '—'}
                </Typography>
              </Grid>
            </Grid>

            {weekChartData.length > 0 ? (
              <Box sx={{ width: '100%', height: 400, overflowX: 'auto' }}>
                <Box sx={{ minWidth: Math.max(520, weekChartData.length * 80), height: 380 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={weekChartData}
                      margin={{
                        top: showWeekBarLabels ? 40 : 8,
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
                        angle={weekChartData.length > 5 ? -32 : 0}
                        textAnchor={weekChartData.length > 5 ? 'end' : 'middle'}
                        height={weekChartData.length > 5 ? 72 : 36}
                      />
                      <YAxis
                        tickFormatter={formatAxisInr}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        width={58}
                      />
                      <RechartsTooltip
                        cursor={{ fill: 'rgba(25, 118, 210, 0.07)' }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const row = payload[0]?.payload as {
                            chartLabel?: string;
                            subtotal?: number;
                            avgDiscountPct?: number | null;
                          };
                          const pct = row?.avgDiscountPct;
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
                                Taxable: {formatCurrency(Number(row?.subtotal) || 0)}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: DISC_PCT_COLOR, mt: 0.5 }}>
                                Avg. discount vs MRP:{' '}
                                {pct != null && Number.isFinite(pct) ? `${pct.toFixed(1)}%` : '—'}
                              </Typography>
                            </Box>
                          );
                        }}
                      />
                      <Bar dataKey="subtotal" fill="#1565c0" name="subtotal" radius={[5, 5, 0, 0]} maxBarSize={56}>
                        {showWeekBarLabels ? (
                          <LabelList
                            dataKey="subtotal"
                            content={(props: any) => {
                              const { x, y, width, value, index } = props;
                              if (x == null || y == null || width == null || value == null) return null;
                              const row = weekChartData[index];
                              const pct = row?.avgDiscountPct;
                              const cx = x + width / 2;
                              const amt = formatAxisInr(Number(value));
                              return (
                                <g>
                                  {pct != null && Number.isFinite(pct) ? (
                                    <text
                                      x={cx}
                                      y={y - 22}
                                      textAnchor="middle"
                                      fill={DISC_PCT_COLOR}
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
              <Typography variant="body2" color="text.secondary">
                No sales in this date range for the selected week-wise filters.
              </Typography>
            )}
          </Paper>

          <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell>Day range</TableCell>
                  <TableCell>Band</TableCell>
                  <TableCell align="right">Records</TableCell>
                  <TableCell align="right">Taxable (selling)</TableCell>
                  <TableCell align="right">Avg. disc. %</TableCell>
                  <TableCell align="right">Grand total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {weekWiseRows.length ? (
                  <>
                    {weekWiseRows.map((r) => {
                      const pct =
                        r.discountMrpBasis > 0
                          ? (100 * r.discountOffMrp) / r.discountMrpBasis
                          : null;
                      return (
                        <TableRow key={r.sortKey} hover>
                          <TableCell>{r.monthTitle}</TableCell>
                          <TableCell>{r.dayRangeLabel}</TableCell>
                          <TableCell>Week {r.weekIndex + 1} of month</TableCell>
                          <TableCell align="right">{r.count}</TableCell>
                          <TableCell align="right">{formatCurrency(r.subtotal)}</TableCell>
                          <TableCell align="right" sx={discPctTableCellSx}>
                            {pct != null ? `${pct.toFixed(1)}%` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatCurrency(r.total)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell colSpan={3} sx={{ fontWeight: 700 }}>
                        Total
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {weekTotals.count}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(weekTotals.subtotal)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, ...discPctTableCellSx }}>
                        {weekTotals.avgDiscountPct != null ? `${weekTotals.avgDiscountPct.toFixed(1)}%` : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(weekTotals.total)}
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                      No rows for this range / filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      <Paper elevation={0} variant="outlined" sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="h6">All records</Typography>
            <Typography variant="body2" color="text.secondary">
              Every invoiced and uninvoiced sale row in the selected range (same filters as above).
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={exportAllRecords}>
            Export all records CSV
          </Button>
        </Box>
        <TableContainer sx={{ maxHeight: 480, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Invoice #</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Center</TableCell>
                <TableCell>Salesperson</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell align="right">Disc. % vs MRP</TableCell>
                <TableCell align="right">Taxable</TableCell>
                <TableCell align="right">GST</TableCell>
                <TableCell align="right">Grand total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRecords.length ? (
                filteredRecords.map((r) => (
                  <TableRow key={r.rowId} hover>
                    <TableCell>{r.date.toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={r.recordKind === 'invoiced' ? 'Invoiced' : 'Uninvoiced'}
                        color={r.recordKind === 'invoiced' ? 'primary' : 'warning'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {r.invoiceNumber || '—'}
                    </TableCell>
                    <TableCell sx={{ wordBreak: 'break-word' }}>
                      {r.enquiryId ? (
                        <EnquiryProfileLink enquiryId={r.enquiryId}>{r.patientName}</EnquiryProfileLink>
                      ) : (
                        r.patientName
                      )}
                    </TableCell>
                    <TableCell>{r.centerName}</TableCell>
                    <TableCell>{r.executiveName}</TableCell>
                    <TableCell sx={{ wordBreak: 'break-word', maxWidth: 160 }}>
                      {r.referenceLabel}
                    </TableCell>
                    <TableCell align="right">
                      {r.discountMrpBasis > 0
                        ? `${((100 * r.discountOffMrp) / r.discountMrpBasis).toFixed(1)}%`
                        : '—'}
                    </TableCell>
                    <TableCell align="right">{formatCurrency(r.subtotal)}</TableCell>
                    <TableCell align="right">{formatCurrency(r.gstAmount)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatCurrency(r.total)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 3 }}>
                    No records in this date range for the selected filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
