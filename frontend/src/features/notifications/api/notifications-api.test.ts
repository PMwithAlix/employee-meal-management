import { afterEach, describe, expect, it, vi } from 'vitest';
import { notificationApi } from './notifications-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

const item = {
  id: 'notification-1',
  type: 'PASSWORD_RESET',
  title: 'رمز عبور بازنشانی شد',
  body: 'رمز عبور شما بازنشانی شد.',
  data: null,
  readAt: null,
  createdAt: '2026-11-14T10:00:00.000Z',
};

describe('notificationApi', () => {
  it('lists validated notifications and unread count', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      items: [item],
      total: 1,
      unreadCount: 1,
      page: 1,
      pageSize: 20,
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(notificationApi.list()).resolves.toMatchObject({
      items: [item],
      total: 1,
      unreadCount: 1,
      page: 1,
      pageSize: 20,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/notifications?page=1&pageSize=20',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('requests a later notifications page with the same contract', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      items: [{ ...item, id: 'notification-21' }],
      total: 25,
      unreadCount: 25,
      page: 2,
      pageSize: 20,
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(notificationApi.list({ page: 2, pageSize: 20 })).resolves.toMatchObject({
      page: 2,
      total: 25,
      unreadCount: 25,
      items: [{ id: 'notification-21' }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/notifications?page=2&pageSize=20',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('marks one notification read through its own endpoint', async () => {
    const read = { ...item, readAt: '2026-11-14T10:05:00.000Z' };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(read), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(notificationApi.markRead(item.id)).resolves.toEqual(read);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/notifications/notification-1/read',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('marks all notifications read and validates the result', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      updatedCount: 3,
      readAt: '2026-11-14T10:05:00.000Z',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(notificationApi.markAllRead()).resolves.toMatchObject({ updatedCount: 3 });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/notifications/read-all',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });
});
