import { GuestOrderStatus, MealType, OrderCycleStatus } from '@prisma/client';
import {
  formatDateOnly,
  formatJalali,
  jalaliFromUtcDate,
} from '../dates/jalali';

export function presentOrder(order: {
  id: string;
  userId: string;
  mealDate: Date;
  mealType: MealType;
  createdAt: Date;
  updatedAt: Date;
  currentCycle: {
    id: string;
    cycleNumber: number;
    menuItemId: string;
    usernameSnapshot: string;
    buildingIdSnapshot: string | null;
    buildingNameSnapshot: string | null;
    mealTitleSnapshot: string;
    mealDateSnapshot: Date;
    mealTypeSnapshot: MealType;
    status: OrderCycleStatus;
    createdAt: Date;
    menuItem: { menuVersionId: string; title: string };
    groupSnapshots: { groupId: string; groupNameSnapshot: string }[];
    statusHistory?: {
      id: string;
      oldStatus: OrderCycleStatus | null;
      newStatus: OrderCycleStatus;
      actorId: string | null;
      reason: string | null;
      createdAt: Date;
    }[];
  } | null;
  cycles?: {
    id: string;
    cycleNumber: number;
    menuItemId: string;
    status: OrderCycleStatus;
    mealTitleSnapshot: string;
    createdAt: Date;
  }[];
}) {
  const jalali = jalaliFromUtcDate(order.mealDate);
  const cycle = order.currentCycle;
  return {
    id: order.id,
    userId: order.userId,
    mealDate: formatDateOnly(order.mealDate),
    jalaliDate: jalali ? formatJalali(jalali) : null,
    mealType: order.mealType,
    quantity: 1,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    status: cycle?.status ?? null,
    currentCycle: cycle
      ? {
          id: cycle.id,
          cycleNumber: cycle.cycleNumber,
          menuItemId: cycle.menuItemId,
          menuVersionId: cycle.menuItem.menuVersionId,
          optionTitle: cycle.mealTitleSnapshot,
          usernameSnapshot: cycle.usernameSnapshot,
          buildingIdSnapshot: cycle.buildingIdSnapshot,
          buildingNameSnapshot: cycle.buildingNameSnapshot,
          mealDateSnapshot: formatDateOnly(cycle.mealDateSnapshot),
          mealTypeSnapshot: cycle.mealTypeSnapshot,
          status: cycle.status,
          createdAt: cycle.createdAt,
          groups: cycle.groupSnapshots.map((group) => ({
            groupId: group.groupId,
            groupNameSnapshot: group.groupNameSnapshot,
          })),
          statusHistory: cycle.statusHistory,
        }
      : null,
    cycles: order.cycles,
  };
}

export function presentGuestOrder(order: {
  id: string;
  buildingId: string;
  menuItemId: string;
  mealDate: Date;
  mealType: MealType;
  quantity: number;
  note: string | null;
  status: GuestOrderStatus;
  buildingNameSnapshot: string;
  mealTitleSnapshot: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  menuItem?: { menuVersionId: string };
  history?: {
    id: string;
    actorId: string;
    action: string;
    createdAt: Date;
  }[];
}) {
  const jalali = jalaliFromUtcDate(order.mealDate);
  return {
    id: order.id,
    buildingId: order.buildingId,
    menuItemId: order.menuItemId,
    menuVersionId: order.menuItem?.menuVersionId ?? null,
    mealDate: formatDateOnly(order.mealDate),
    jalaliDate: jalali ? formatJalali(jalali) : null,
    mealType: order.mealType,
    quantity: order.quantity,
    note: order.note,
    status: order.status,
    buildingNameSnapshot: order.buildingNameSnapshot,
    mealTitleSnapshot: order.mealTitleSnapshot,
    createdBy: order.createdBy,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    history: order.history,
  };
}

export function presentDeadline(row: {
  id: string;
  mealDate: Date;
  mealType: MealType;
  deadlineAt: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const jalali = jalaliFromUtcDate(row.mealDate);
  return {
    id: row.id,
    mealDate: formatDateOnly(row.mealDate),
    jalaliDate: jalali ? formatJalali(jalali) : null,
    mealType: row.mealType,
    deadlineAt: row.deadlineAt.toISOString(),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const orderCycleInclude = {
  menuItem: { select: { menuVersionId: true, title: true } },
  groupSnapshots: true,
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
};
