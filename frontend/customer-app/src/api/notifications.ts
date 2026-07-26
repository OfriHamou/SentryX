import { customerApi } from './customerApi';

export type NotificationTargetApp = 'CUSTOMER' | 'ORGANIZATION' | 'ADMIN';
export type NotificationStatus = 'all' | 'read' | 'unread';

export interface NotificationEventInfo {
  id: string;
  eventType: string | null;
  imagePath: string | null;
  status: string;
  createdAt: string;
}

export interface NotificationAlertInfo {
  id: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  displayTitle: string;
  startedAt: string | null;
  resolvedAt: string | null;
}

export interface NotificationRobotInfo {
  id: string;
  name: string;
  location: string | null;
  status: string;
}

export interface NotificationTenantInfo {
  id: string;
  name: string;
}

export interface BellNotification {
  id: string;
  eventId: string | null;
  title: string | null;
  alertId: string | null;
  alert: NotificationAlertInfo | null;
  message: string | null;
  severity: string;
  targetApps: NotificationTargetApp[];
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  event: NotificationEventInfo | null;
  robot: NotificationRobotInfo | null;
  tenant: NotificationTenantInfo | null;
  metadata: Record<string, unknown> | null;
}

interface NotificationsResponse {
  notifications: BellNotification[];
}

interface UnreadCountResponse {
  unreadCount: number;
}

export const getNotifications = async (
  targetApp: NotificationTargetApp,
  status: NotificationStatus = 'all',
  limit = 20,
) => {
  const response = await customerApi.get<NotificationsResponse>('/notifications', {
    params: { targetApp, status, limit, offset: 0 },
  });
  return response.data.notifications ?? [];
};

export const getUnreadNotificationCount = async (targetApp: NotificationTargetApp) => {
  const response = await customerApi.get<UnreadCountResponse>('/notifications/unread-count', {
    params: { targetApp },
  });
  return response.data.unreadCount ?? 0;
};

export const markAllNotificationsRead = async (targetApp: NotificationTargetApp) => {
  const response = await customerApi.patch('/notifications/read-all', null, {
    params: { targetApp },
  });
  return response.data;
};

export const markNotificationRead = async (id: string) => {
  const response = await customerApi.patch<{ notification: BellNotification }>(`/notifications/${id}/read`);
  return response.data.notification;
};

export const markNotificationUnread = async (id: string) => {
  const response = await customerApi.patch<{ notification: BellNotification }>(`/notifications/${id}/unread`);
  return response.data.notification;
};
