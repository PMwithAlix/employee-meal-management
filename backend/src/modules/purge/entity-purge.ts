import { Prisma } from '@prisma/client';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';

export async function enableAdminPurge(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT set_config('khaan.purge', 'on', true)`;
}

export async function deleteGuestOrders(
  tx: Prisma.TransactionClient,
  where: Prisma.GuestOrderWhereInput,
) {
  const guests = await tx.guestOrder.findMany({
    where,
    select: { id: true },
  });
  const guestIds = guests.map((guest) => guest.id);
  if (guestIds.length === 0) return 0;
  await tx.guestOrderHistory.deleteMany({
    where: { guestOrderId: { in: guestIds } },
  });
  await tx.guestOrder.deleteMany({ where: { id: { in: guestIds } } });
  return guestIds.length;
}

export async function deleteUserOrders(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const orders = await tx.order.findMany({
    where: { userId },
    select: { id: true },
  });
  const orderIds = orders.map((order) => order.id);
  if (orderIds.length === 0) return;
  await tx.order.updateMany({
    where: { id: { in: orderIds } },
    data: { currentCycleId: null },
  });
  const cycles = await tx.orderCycle.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const cycleIds = cycles.map((cycle) => cycle.id);
  if (cycleIds.length > 0) {
    await tx.rating.deleteMany({ where: { orderCycleId: { in: cycleIds } } });
    await tx.orderGroupSnapshot.deleteMany({
      where: { orderCycleId: { in: cycleIds } },
    });
    await tx.orderStatusHistory.deleteMany({
      where: { orderCycleId: { in: cycleIds } },
    });
    await tx.orderCycle.deleteMany({ where: { id: { in: cycleIds } } });
  }
  await tx.rating.deleteMany({ where: { orderId: { in: orderIds } } });
  await tx.order.deleteMany({ where: { id: { in: orderIds } } });
}

export async function purgeUserRecord(
  tx: Prisma.TransactionClient,
  audit: AuditService,
  input: {
    actorId: string;
    userId: string;
    beforeData: unknown;
  },
) {
  const { actorId, userId } = input;
  await tx.menuVersion.updateMany({
    where: { createdBy: userId },
    data: { createdBy: actorId },
  });
  await tx.menu.updateMany({
    where: { lastAnnouncedBy: userId },
    data: { lastAnnouncedBy: actorId },
  });
  await tx.orderStatusHistory.updateMany({
    where: { actorId: userId },
    data: { actorId: actorId },
  });
  await tx.guestOrderHistory.updateMany({
    where: { actorId: userId },
    data: { actorId },
  });
  await tx.guestOrder.updateMany({
    where: { createdBy: userId },
    data: { createdBy: actorId },
  });
  await tx.systemSetting.updateMany({
    where: { updatedBy: userId },
    data: { updatedBy: actorId },
  });
  await tx.orderDeadline.updateMany({
    where: { createdBy: userId },
    data: { createdBy: actorId },
  });
  await tx.orderDeadlinePolicy.updateMany({
    where: { updatedBy: userId },
    data: { updatedBy: actorId },
  });
  await tx.mealSetting.updateMany({
    where: { updatedBy: userId },
    data: { updatedBy: actorId },
  });
  await deleteUserOrders(tx, userId);
  await tx.session.deleteMany({ where: { userId } });
  await tx.notification.deleteMany({ where: { userId } });
  await tx.groupMembership.deleteMany({ where: { userId } });
  await tx.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: userId },
        { entityType: AuditEntity.User, entityId: userId },
      ],
    },
  });
  await audit.record(
    {
      actorId,
      action: AuditAction.UserDeleted,
      entityType: AuditEntity.User,
      entityId: userId,
      beforeData: input.beforeData,
    },
    tx,
  );
  await tx.user.delete({ where: { id: userId } });
}
