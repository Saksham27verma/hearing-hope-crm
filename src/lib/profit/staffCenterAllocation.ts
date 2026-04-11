import type { RawDoc } from './computeGrossProfit';

/**
 * Maps each staff id to the center(s) they are assigned on `centers[].staffIds`.
 * If a staff appears on multiple centers, salary is split equally across those centers.
 */
export function buildStaffSalaryShareByCenter(
  centerDocs: RawDoc[],
): Map<string, { centerIds: string[]; shares: number[] }> {
  const staffToCenters = new Map<string, string[]>();
  for (const c of centerDocs) {
    const cid = String(c.id || '').trim();
    if (!cid) continue;
    const staffIds = Array.isArray(c.staffIds) ? (c.staffIds as unknown[]) : [];
    for (const raw of staffIds) {
      const sid = String(raw ?? '').trim();
      if (!sid) continue;
      if (!staffToCenters.has(sid)) staffToCenters.set(sid, []);
      staffToCenters.get(sid)!.push(cid);
    }
  }

  const out = new Map<string, { centerIds: string[]; shares: number[] }>();
  for (const [staffId, centerIds] of staffToCenters) {
    const unique = [...new Set(centerIds)].filter(Boolean);
    const n = unique.length;
    out.set(staffId, {
      centerIds: unique,
      shares: n > 0 ? unique.map(() => 1 / n) : [],
    });
  }
  return out;
}
