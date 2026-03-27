/** Single document in `invoiceSettings/{id}` — source of truth for sequential invoice numbers. */
export interface InvoiceNumberSettings {
  prefix: string;
  suffix: string;
  /** Next value to assign (1-based). Incremented atomically when a sale consumes the sequence. */
  next_number: number;
  /** Zero-pad the numeric part to this width (e.g. 4 → 0001). */
  padding: number;
}
