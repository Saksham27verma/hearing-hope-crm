/**
 * Enquiry address: full caps for text; 6-digit Indian PIN; composed as
 * "LINE, STATE - PINCODE" for storage in `address`.
 */

/** Uppercase + single spaces; no trim — safe while typing (trim would eat the trailing space before the next word). */
export function normalizeEnquiryAddressTextInput(s: string): string {
  return String(s || '')
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/** Final normalization for storage / parsing (trim edges). */
export function normalizeEnquiryAddressText(s: string): string {
  return normalizeEnquiryAddressTextInput(s).trim();
}

export function normalizeEnquiryPincode(s: string): string {
  return String(s || '').replace(/\D/g, '').slice(0, 6);
}

export function composeEnquiryAddress(line: string, state: string, pincode: string): string {
  const L = normalizeEnquiryAddressText(line);
  const S = normalizeEnquiryAddressText(state);
  const P = normalizeEnquiryPincode(pincode);
  const tail = S && P ? `${S} - ${P}` : S || (P ? P : '');
  if (L && tail) return `${L}, ${tail}`;
  if (L) return L;
  return tail;
}

export function parseEnquiryAddressStored(full: string): {
  line: string;
  state: string;
  pincode: string;
} {
  const raw = String(full || '').trim();
  if (!raw) return { line: '', state: '', pincode: '' };

  const dashPin = raw.match(/^(.*?)[\s,]*-\s*(\d{6})\s*$/);
  if (dashPin) {
    const before = dashPin[1].trim();
    const pin = dashPin[2];
    const lastComma = before.lastIndexOf(',');
    if (lastComma >= 0) {
      return {
        line: normalizeEnquiryAddressText(before.slice(0, lastComma)),
        state: normalizeEnquiryAddressText(before.slice(lastComma + 1)),
        pincode: pin,
      };
    }
    return {
      line: normalizeEnquiryAddressText(before),
      state: '',
      pincode: pin,
    };
  }

  const tailPin = raw.match(/^(.*?)[,\s]+(\d{6})\s*$/);
  if (tailPin) {
    const before = tailPin[1].trim();
    const pin = tailPin[2];
    const lastComma = before.lastIndexOf(',');
    if (lastComma >= 0) {
      return {
        line: normalizeEnquiryAddressText(before.slice(0, lastComma)),
        state: normalizeEnquiryAddressText(before.slice(lastComma + 1)),
        pincode: pin,
      };
    }
    return {
      line: normalizeEnquiryAddressText(before),
      state: '',
      pincode: pin,
    };
  }

  return { line: normalizeEnquiryAddressText(raw), state: '', pincode: '' };
}
