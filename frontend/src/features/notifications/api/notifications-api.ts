import { authRequest } from '../../auth/api/auth-api';
import { AuthRequestError } from '../../auth/lib/auth-errors';

const session = { treatUnauthorizedAsSessionEnd: true as const };

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  readAt: string | null;
  createdAt: string;
}

function incomplete() {
  return new AuthRequestError('http', 'ساختار پاسخ اعلان‌های سامانه معتبر نیست.');
}

function parseNotification(value: unknown): NotificationItem {
  const record = asRecord(value);
  if (
    !record ||
    typeof record.id !== 'string' ||
    typeof record.type !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.body !== 'string' ||
    typeof record.createdAt !== 'string' ||
    (record.readAt !== null && typeof record.readAt !== 'string')
  ) {
    throw incomplete();
  }
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    body: record.body,
    data: record.data ?? null,
    readAt: typeof record.readAt === 'string' ? record.readAt : null,
    createdAt: record.createdAt,
  };
}

export const notificationApi = {
  list(query: { page?: number; pageSize?: number } = {}, signal?: AbortSignal) {
    const params = new URLSearchParams();
    params.set('page', String(query.page ?? 1));
    params.set('pageSize', String(query.pageSize ?? 20));
    return authRequest<unknown>(`/notifications?${params.toString()}`, {
      ...session,
      signal,
    }).then((body) => {
      const record = asRecord(body);
      if (
        !record ||
        !Array.isArray(record.items) ||
        typeof record.total !== 'number' ||
        typeof record.unreadCount !== 'number' ||
        typeof record.page !== 'number' ||
        typeof record.pageSize !== 'number'
      ) {
        throw incomplete();
      }
      return {
        items: record.items.map(parseNotification),
        total: record.total,
        unreadCount: record.unreadCount,
        page: record.page,
        pageSize: record.pageSize,
      };
    });
  },

  markRead(id: string) {
    return authRequest<unknown>(`/notifications/${encodeURIComponent(id)}/read`, {
      ...session,
      method: 'POST',
    }).then(parseNotification);
  },

  markAllRead() {
    return authRequest<unknown>('/notifications/read-all', {
      ...session,
      method: 'POST',
    }).then((body) => {
      const record = asRecord(body);
      if (
        !record ||
        typeof record.updatedCount !== 'number' ||
        typeof record.readAt !== 'string'
      ) {
        throw incomplete();
      }
      return { updatedCount: record.updatedCount, readAt: record.readAt };
    });
  },
};
