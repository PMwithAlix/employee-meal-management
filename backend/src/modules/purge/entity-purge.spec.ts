import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { deleteGuestOrders, deleteUserOrders, purgeUserRecord } from './entity-purge';

function txStub() {
  return {
    menuVersion: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    menu: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    orderStatusHistory: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    guestOrderHistory: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    guestOrder: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    systemSetting: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    orderDeadline: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    orderDeadlinePolicy: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    mealSetting: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    order: {
      findMany: jest.fn().mockResolvedValue([{ id: 'o1' }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    orderCycle: {
      findMany: jest.fn().mockResolvedValue([{ id: 'c1' }]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    rating: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    orderGroupSnapshot: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    session: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    notification: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    groupMembership: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    user: { delete: jest.fn().mockResolvedValue({ id: 'u1' }) },
  };
}

describe('entity-purge', () => {
  it('deletes a user order graph before the order row', async () => {
    const tx = txStub();
    await deleteUserOrders(tx as never, 'u1');
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['o1'] } },
      data: { currentCycleId: null },
    });
    expect(tx.rating.deleteMany).toHaveBeenCalled();
    expect(tx.orderGroupSnapshot.deleteMany).toHaveBeenCalled();
    expect(tx.orderStatusHistory.deleteMany).toHaveBeenCalled();
    expect(tx.orderCycle.deleteMany).toHaveBeenCalled();
    expect(tx.order.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['o1'] } },
    });
  });

  it('deletes guest orders with their history', async () => {
    const tx = txStub();
    tx.guestOrder.findMany.mockResolvedValue([{ id: 'g1' }]);
    await expect(deleteGuestOrders(tx as never, { buildingId: 'b1' })).resolves.toBe(1);
    expect(tx.guestOrderHistory.deleteMany).toHaveBeenCalledWith({
      where: { guestOrderId: { in: ['g1'] } },
    });
    expect(tx.guestOrder.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['g1'] } },
    });
  });

  it('transfers shared operational ownership then deletes personal rows', async () => {
    const tx = txStub();
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    await purgeUserRecord(tx as never, audit as never, {
      actorId: 'admin',
      userId: 'u1',
      beforeData: { id: 'u1' },
    });
    expect(tx.menuVersion.updateMany).toHaveBeenCalledWith({
      where: { createdBy: 'u1' },
      data: { createdBy: 'admin' },
    });
    expect(tx.guestOrder.updateMany).toHaveBeenCalledWith({
      where: { createdBy: 'u1' },
      data: { createdBy: 'admin' },
    });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(tx.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(tx.auditLog.deleteMany).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UserDeleted,
        entityType: AuditEntity.User,
        entityId: 'u1',
        actorId: 'admin',
      }),
      tx,
    );
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });
});
