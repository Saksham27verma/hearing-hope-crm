import { getDefaultOptionsForField } from '@/lib/field-options/registry';
import { adminDb } from '@/server/firebaseAdmin';

export type FieldOptionResolved = {
  optionValue: string;
  optionLabel: string;
  sortOrder: number;
};

function sortBySortOrder(rows: FieldOptionResolved[]): FieldOptionResolved[] {
  return [...rows].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.optionLabel.localeCompare(b.optionLabel)
  );
}

/**
 * Same resolution as client `getFieldOptions` (fieldOptionsService): Firestore `field_options`
 * for module+field, else registry defaults.
 */
export async function getEnquiryFieldOptionsAdmin(fieldKey: string): Promise<FieldOptionResolved[]> {
  const db = adminDb();
  const snap = await db
    .collection('field_options')
    .where('moduleKey', '==', 'enquiries')
    .where('fieldKey', '==', fieldKey)
    .get();

  if (snap.empty) {
    return getDefaultOptionsForField('enquiries', fieldKey).map((d, i) => ({
      optionValue: d.optionValue,
      optionLabel: d.optionLabel,
      sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : (i + 1) * 10,
    }));
  }

  const rows: FieldOptionResolved[] = snap.docs
    .map((d) => {
      const x = d.data() as {
        optionValue?: string;
        optionLabel?: string;
        sortOrder?: number;
        isActive?: boolean;
      };
      if (x.isActive === false) return null;
      return {
        optionValue: String(x.optionValue ?? ''),
        optionLabel: String(x.optionLabel ?? x.optionValue ?? ''),
        sortOrder: typeof x.sortOrder === 'number' ? x.sortOrder : 0,
      };
    })
    .filter((r): r is FieldOptionResolved => r !== null && !!r.optionValue);

  return sortBySortOrder(rows);
}
