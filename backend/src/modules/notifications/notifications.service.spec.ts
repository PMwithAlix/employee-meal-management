import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

const userId = '11111111-1111-1111-1111-111111111111';
const notificationId = '22222222-2222-2222-2222-222222222222';

function createService() {
  const prisma = {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  return {
    service: new NotificationsService(prisma as never),
    prisma,
  };
}

describe('NotificationsService', () => {
  it('lists only the current user notifications and returns unread count', async () => {
    const { service, prisma } = createService();
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);

    const result = await service.list(userId, { page: 1, pageSize: 20 });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId } }),
    );
    expect(prisma.notification.count).toHaveBeenNthCalledWith(1, { where: { userId } });
    expect(prisma.notification.count).toHaveBeenNthCalledWith(2, {
      where: { userId, readAt: null },
    });
    expect(result).toMatchObject({ total: 3, unreadCount: 2, page: 1, pageSize: 20 });
  });

  it('marks a notification read only within the current user scope', async () => {
    const { service, prisma } = createService();
    const item = {
      id: notificationId,
      type: 'PASSWORD_RESET',
      title: 'عنوان',
      body: 'متن',
      data: null,
      readAt: new Date(),
      createdAt: new Date(),
    };
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    prisma.notification.findFirst.mockResolvedValue(item);

    await expect(service.markRead(userId, notificationId)).resolves.toEqual(item);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: notificationId, userId, readAt: null },
        data: expect.objectContaining({ readAt: expect.any(Date) }),
      }),
    );
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: notificationId, userId },
      select: expect.any(Object),
    });
  });

  it('does not expose another user notification', async () => {
    const { service, prisma } = createService();
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(service.markRead(userId, notificationId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('marks all unread notifications for the current user only', async () => {
    const { service, prisma } = createService();
    prisma.notification.updateMany.mockResolvedValue({ count: 4 });

    const result = await service.markAllRead(userId);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, readAt: null },
        data: expect.objectContaining({ readAt: expect.any(Date) }),
      }),
    );
    expect(result.updatedCount).toBe(4);
    expect(result.readAt).toBeInstanceOf(Date);
  });
});
