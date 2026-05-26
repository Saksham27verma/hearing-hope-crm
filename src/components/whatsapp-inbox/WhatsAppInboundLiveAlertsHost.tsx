'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useWhatsAppInboundLiveAlerts } from '@/hooks/useWhatsAppInboundLiveAlerts';
import type { WhatsAppInboundAlertItem } from '@/hooks/useWhatsAppInboundLiveAlerts';
import WhatsAppInboundLiveAlerts from './WhatsAppInboundLiveAlerts';

export default function WhatsAppInboundLiveAlertsHost() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const { visible, exitingIds, dismiss } = useWhatsAppInboundLiveAlerts(isAdmin);

  if (!isAdmin) return null;

  return (
    <WhatsAppInboundLiveAlerts
      visible={visible}
      exitingIds={exitingIds}
      onDismiss={dismiss}
      onOpenInbox={(item: WhatsAppInboundAlertItem) => {
        dismiss(item.toastId);
        router.push('/whatsapp-inbox');
      }}
    />
  );
}
