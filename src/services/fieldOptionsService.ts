import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { DEFAULT_FIRESTORE_POLL_MS } from '@/lib/firestore/pollingSubscribe';
import type { FieldOptionDoc, FieldOptionResolved } from '@/lib/field-options/types';
import { getDefaultOptionsForField } from '@/lib/field-options/registry';
import { ENQUIRY_FIELD_KEYS } from '@/lib/field-options/enquiriesCatalog';

export const FIELD_OPTIONS_COLLECTION = 'field_options';

function defaultsToResolved(moduleKey: string, fieldKey: string): FieldOptionResolved[] {
  return getDefaultOptionsForField(moduleKey, fieldKey).map((d) => ({
    optionValue: d.optionValue,
    optionLabel: d.optionLabel,
    sortOrder: d.sortOrder,
    isActive: true,
  }));
}

function docToResolved(id: string, data: FieldOptionDoc): FieldOptionResolved {
  return {
    id,
    optionValue: data.optionValue,
    optionLabel: data.optionLabel,
    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
    isActive: data.isActive !== false,
  };
}

/** Sort in memory — avoids Firestore composite indexes that include `sortOrder`. */
function sortBySortOrder(rows: FieldOptionResolved[]): FieldOptionResolved[] {
  return [...rows].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.optionLabel.localeCompare(b.optionLabel)
  );
}

/** Only equality filters — needs composite index (moduleKey, fieldKey) only. */
function fieldOptionsQuery(db: Firestore, moduleKey: string, fieldKey: string) {
  return query(
    collection(db, FIELD_OPTIONS_COLLECTION),
    where('moduleKey', '==', moduleKey),
    where('fieldKey', '==', fieldKey)
  );
}

/**
 * Active options for forms: Firestore rows for this module+field (active only, sorted).
 * If there are no documents yet for this field, returns built-in defaults from the registry.
 * If documents exist but none are active, returns an empty list.
 */
export async function getFieldOptions(
  db: Firestore,
  moduleKey: string,
  fieldKey: string
): Promise<FieldOptionResolved[]> {
  const snap = await getDocs(fieldOptionsQuery(db, moduleKey, fieldKey));
  if (snap.empty) {
    return defaultsToResolved(moduleKey, fieldKey);
  }
  const rows = snap.docs.map((d) => docToResolved(d.id, d.data() as FieldOptionDoc));
  return sortBySortOrder(rows.filter((r) => r.isActive));
}

/** Pooled polling — avoids Firestore 11.x onSnapshot WatchChangeAggregator crashes under load. */
type FieldOptionsSinglePoolEntry = {
  refCount: number;
  timer: ReturnType<typeof setInterval> | null;
  callbacks: Set<(options: FieldOptionResolved[]) => void>;
  errorCallbacks: Set<(e: Error) => void>;
  latest: FieldOptionResolved[] | null;
};

const fieldOptionsSinglePool = new Map<string, FieldOptionsSinglePoolEntry>();

function fieldOptionsSinglePoolKey(moduleKey: string, fieldKey: string) {
  return `${moduleKey}\u0000${fieldKey}`;
}

async function runFieldOptionsSingleFetch(
  db: Firestore,
  moduleKey: string,
  fieldKey: string,
  entry: FieldOptionsSinglePoolEntry,
) {
  try {
    const opts = await getFieldOptions(db, moduleKey, fieldKey);
    entry.latest = opts;
    entry.callbacks.forEach((cb) => cb(opts));
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    entry.errorCallbacks.forEach((cb) => cb(e));
  }
}

export function subscribeFieldOptions(
  db: Firestore,
  moduleKey: string,
  fieldKey: string,
  onData: (options: FieldOptionResolved[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const key = fieldOptionsSinglePoolKey(moduleKey, fieldKey);
  let entry = fieldOptionsSinglePool.get(key);
  if (!entry) {
    entry = {
      refCount: 0,
      timer: null,
      callbacks: new Set(),
      errorCallbacks: new Set(),
      latest: null,
    };
    fieldOptionsSinglePool.set(key, entry);
  }
  entry.refCount += 1;
  entry.callbacks.add(onData);
  if (onError) entry.errorCallbacks.add(onError);

  if (entry.refCount === 1) {
    void runFieldOptionsSingleFetch(db, moduleKey, fieldKey, entry);
    entry.timer = setInterval(
      () => void runFieldOptionsSingleFetch(db, moduleKey, fieldKey, entry!),
      DEFAULT_FIRESTORE_POLL_MS,
    );
  } else if (entry.latest) {
    queueMicrotask(() => onData(entry!.latest!));
  }

  return () => {
    const e = fieldOptionsSinglePool.get(key);
    if (!e) return;
    e.refCount -= 1;
    e.callbacks.delete(onData);
    if (onError) e.errorCallbacks.delete(onError);
    if (e.refCount <= 0) {
      if (e.timer) clearInterval(e.timer);
      fieldOptionsSinglePool.delete(key);
    }
  };
}

/** One listener for all enquiry dropdowns — grouped by `fieldKey`. */
export function subscribeEnquiryFieldOptionsMap(
  db: Firestore,
  onData: (byField: Record<string, FieldOptionResolved[]>) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return subscribeModuleFieldOptionsByKeys(db, 'enquiries', ENQUIRY_FIELD_KEYS, onData, onError);
}

/** All built-in enquiry options (no Firestore) — used if the snapshot listener fails. */
export function buildEnquiryFieldDefaultsMap(): Record<string, FieldOptionResolved[]> {
  const out: Record<string, FieldOptionResolved[]> = {};
  for (const fk of ENQUIRY_FIELD_KEYS) {
    out[fk] = defaultsToResolved('enquiries', fk);
  }
  return out;
}

function buildModuleFieldOptionsFromSnap(
  snap: QuerySnapshot,
  moduleKey: string,
  fieldKeys: string[],
): Record<string, FieldOptionResolved[]> {
  const grouped = new Map<string, FieldOptionResolved[]>();
  snap.docs.forEach((d) => {
    const data = d.data() as FieldOptionDoc;
    const fk = data.fieldKey;
    if (!fieldKeys.includes(fk)) return;
    if (!grouped.has(fk)) grouped.set(fk, []);
    grouped.get(fk)!.push(docToResolved(d.id, data));
  });
  const out: Record<string, FieldOptionResolved[]> = {};
  for (const fk of fieldKeys) {
    const raw = grouped.get(fk) || [];
    if (raw.length === 0) {
      out[fk] = defaultsToResolved(moduleKey, fk);
    } else {
      out[fk] = raw
        .filter((r) => r.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.optionLabel.localeCompare(b.optionLabel));
    }
  }
  return out;
}

type ModuleFieldOptionsPoolEntry = {
  refCount: number;
  timer: ReturnType<typeof setInterval> | null;
  callbacks: Set<(byField: Record<string, FieldOptionResolved[]>) => void>;
  errorCallbacks: Set<(e: Error) => void>;
  latest: Record<string, FieldOptionResolved[]> | null;
  moduleKey: string;
  fieldKeys: string[];
};

const moduleFieldOptionsPool = new Map<string, ModuleFieldOptionsPoolEntry>();

function moduleFieldOptionsPoolKey(moduleKey: string, fieldKeys: string[]) {
  return `${moduleKey}::${[...fieldKeys].sort().join('|')}`;
}

async function runModuleFieldOptionsFetch(
  db: Firestore,
  entry: ModuleFieldOptionsPoolEntry,
  onEnquiryErrorDefaults: boolean,
) {
  try {
    const q = query(collection(db, FIELD_OPTIONS_COLLECTION), where('moduleKey', '==', entry.moduleKey));
    const snap = await getDocs(q);
    const out = buildModuleFieldOptionsFromSnap(snap, entry.moduleKey, entry.fieldKeys);
    entry.latest = out;
    entry.callbacks.forEach((cb) => cb(out));
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    if (onEnquiryErrorDefaults && entry.moduleKey === 'enquiries') {
      const fallback = buildEnquiryFieldDefaultsMap();
      entry.latest = fallback;
      entry.callbacks.forEach((cb) => cb(fallback));
    }
    entry.errorCallbacks.forEach((cb) => cb(e));
  }
}

export function subscribeModuleFieldOptionsByKeys(
  db: Firestore,
  moduleKey: string,
  fieldKeys: string[],
  onData: (byField: Record<string, FieldOptionResolved[]>) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const key = moduleFieldOptionsPoolKey(moduleKey, fieldKeys);
  let entry = moduleFieldOptionsPool.get(key);
  if (!entry) {
    entry = {
      refCount: 0,
      timer: null,
      callbacks: new Set(),
      errorCallbacks: new Set(),
      latest: null,
      moduleKey,
      fieldKeys: [...fieldKeys],
    };
    moduleFieldOptionsPool.set(key, entry);
  }
  entry.refCount += 1;
  entry.callbacks.add(onData);
  if (onError) entry.errorCallbacks.add(onError);

  if (entry.refCount === 1) {
    void runModuleFieldOptionsFetch(db, entry, true);
    entry.timer = setInterval(
      () => void runModuleFieldOptionsFetch(db, entry!, true),
      DEFAULT_FIRESTORE_POLL_MS,
    );
  } else if (entry.latest) {
    queueMicrotask(() => onData(entry!.latest!));
  }

  return () => {
    const e = moduleFieldOptionsPool.get(key);
    if (!e) return;
    e.refCount -= 1;
    e.callbacks.delete(onData);
    if (onError) e.errorCallbacks.delete(onError);
    if (e.refCount <= 0) {
      if (e.timer) clearInterval(e.timer);
      moduleFieldOptionsPool.delete(key);
    }
  };
}

/** All rows for settings (active + inactive), sorted. Empty until you seed or add options. */
export async function listFieldOptionsAll(
  db: Firestore,
  moduleKey: string,
  fieldKey: string
): Promise<FieldOptionResolved[]> {
  const snap = await getDocs(fieldOptionsQuery(db, moduleKey, fieldKey));
  if (snap.empty) return [];
  return sortBySortOrder(snap.docs.map((d) => docToResolved(d.id, d.data() as FieldOptionDoc)));
}

export async function addFieldOption(
  db: Firestore,
  moduleKey: string,
  fieldKey: string,
  input: { optionValue: string; optionLabel: string; sortOrder: number; isActive?: boolean }
) {
  const payload: Omit<FieldOptionDoc, 'createdAt' | 'updatedAt'> = {
    moduleKey,
    fieldKey,
    optionValue: input.optionValue.trim(),
    optionLabel: input.optionLabel.trim(),
    sortOrder: input.sortOrder,
    isActive: input.isActive !== false,
  };
  await addDoc(collection(db, FIELD_OPTIONS_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateFieldOption(
  db: Firestore,
  docId: string,
  patch: Partial<Pick<FieldOptionDoc, 'optionLabel' | 'sortOrder' | 'isActive' | 'optionValue'>>
) {
  if (docId.startsWith('__default_')) {
    throw new Error('Save defaults to Firestore before editing placeholder rows.');
  }
  await updateDoc(doc(db, FIELD_OPTIONS_COLLECTION, docId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFieldOption(db: Firestore, docId: string) {
  if (docId.startsWith('__default_')) return;
  await deleteDoc(doc(db, FIELD_OPTIONS_COLLECTION, docId));
}

export async function seedDefaultsToFirestore(db: Firestore, moduleKey: string, fieldKey: string) {
  const existing = await getDocs(
    query(
      collection(db, FIELD_OPTIONS_COLLECTION),
      where('moduleKey', '==', moduleKey),
      where('fieldKey', '==', fieldKey)
    )
  );
  if (!existing.empty) return { created: 0, skipped: existing.size };
  const defaults = getDefaultOptionsForField(moduleKey, fieldKey);
  let created = 0;
  const batch = writeBatch(db);
  for (const d of defaults) {
    const ref = doc(collection(db, FIELD_OPTIONS_COLLECTION));
    batch.set(ref, {
      moduleKey,
      fieldKey,
      optionValue: d.optionValue,
      optionLabel: d.optionLabel,
      sortOrder: d.sortOrder,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    created++;
  }
  await batch.commit();
  return { created, skipped: 0 };
}
