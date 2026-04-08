'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import type { NotificationWithId } from '@/lib/notifications/types';

function createdAtToMs(createdAt: unknown): number | null {
  if (!createdAt) return null;
  if (typeof createdAt === 'number' && Number.isFinite(createdAt)) return createdAt;
  if (typeof createdAt === 'string') {
    const t = new Date(createdAt).getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof createdAt === 'object' && createdAt !== null) {
    const anyObj = createdAt as any;
    if (typeof anyObj.toMillis === 'function') return anyObj.toMillis();
    if (typeof anyObj.seconds === 'number') return anyObj.seconds * 1000;
  }
  return null;
}

function formatRelative(ms: number | null): string {
  if (!ms) return '';
  const delta = Date.now() - ms;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function NotificationListItem(props: {
  n: NotificationWithId;
  onOpen: (n: NotificationWithId) => Promise<void> | void;
}) {
  const { n, onOpen } = props;
  const [marking, setMarking] = useState(false);

  const ms = useMemo(() => createdAtToMs(n.createdAt), [n.createdAt]);
  const when = useMemo(() => formatRelative(ms), [ms]);

  return (
    <button
      type="button"
      onClick={async () => {
        if (marking) return;
        setMarking(true);
        try {
          await onOpen(n);
        } finally {
          setMarking(false);
        }
      }}
      className={[
        'group w-full text-left',
        'rounded-xl border border-slate-200 bg-white',
        'px-4 py-3 shadow-sm',
        'transition-all duration-200',
        n.is_read ? 'opacity-75 hover:opacity-100' : 'hover:shadow-lg hover:border-slate-300',
        marking ? 'scale-[0.99] opacity-60' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
          {n.is_read ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{n.title}</div>
              {n.message ? (
                <div className="mt-0.5 max-h-10 overflow-hidden text-sm text-slate-600">{n.message}</div>
              ) : null}
            </div>
            <div className="flex flex-none items-center gap-2">
              {when ? (
                <div className="text-xs font-medium text-slate-400">{when}</div>
              ) : null}
              <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500" />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

