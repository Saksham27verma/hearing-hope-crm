/** Firestore: whatsapp_inbound_messages/{waMessageId} */
export type WhatsAppInboundMessageDoc = {
  waMessageId: string;
  customerName: string;
  customerPhone: string;
  messageBody: string;
  createdAt: unknown;
};

export type WhatsAppInboundMessageWithId = WhatsAppInboundMessageDoc & { id: string };

export const WHATSAPP_INBOUND_MESSAGES_COLLECTION = 'whatsapp_inbound_messages';
