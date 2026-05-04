/**
 * Firestore rejects values where an array's elements are themselves arrays
 * ("Nested arrays are not supported").
 *
 * Product lines use `serialPairs` as `[string, string][]`, which encodes as a nested array.
 * Pairing for hearing aids is preserved by ordered entries in `serialNumbers`; the app already
 * falls back to consecutive pairing when `serialPairs` is absent (see SimplifiedEnquiryForm, inventory).
 */
export function stripSerialPairsFromProductLines<T extends object>(
  products: T[] | undefined | null,
): Array<Omit<T, 'serialPairs'>> {
  if (!Array.isArray(products)) return [];
  return products.map((p) => {
    if (!p || typeof p !== 'object') return p as Omit<T, 'serialPairs'>;
    const { serialPairs: _omit, ...rest } = p as T & { serialPairs?: unknown };
    return rest as Omit<T, 'serialPairs'>;
  });
}
