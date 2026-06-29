export type NotificationType =
  | 'due_calls'
  | 'new_sale'
  | 'whatsapp_invoice_request'
  | 'whatsapp_inbound'
  | 'sale_milestone'
  | 'system';

export type NotificationEntity =
  | { kind: 'enquiry'; id: string }
  | { kind: 'sale'; id: string }
  | { kind: 'whatsapp_invoice_request'; id: string }
  | { kind: 'whatsapp_inbound'; id: string }
  | { kind: 'legacy_sale'; id: string }
  | { kind: 'system'; id?: string };

/**
 * Firestore notification document shape.
 * Uses `is_read` to match the requested DB field name.
 */
export type NotificationDoc = {
  userId: string;
  centerId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  href: string | null;
  entity?: NotificationEntity;
  is_read: boolean;
  createdAt: unknown;
  readAt?: unknown | null;
  dedupeKey?: string | null;
};

export type NotificationWithId = NotificationDoc & { id: string };

