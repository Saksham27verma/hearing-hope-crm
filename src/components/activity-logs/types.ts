import type { Timestamp } from 'firebase/firestore';
import type { ActivityAction, ActivityModule, ActivityChanges } from '@/lib/activityLogger';

export interface ActivityLogDoc {
  id: string;
  timestamp: Timestamp;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  centerId?: string | null;
  action: ActivityAction;
  module: ActivityModule;
  entityId: string;
  entityName: string;
  description: string;
  changes?: ActivityChanges;
  metadata?: Record<string, unknown>;
}
