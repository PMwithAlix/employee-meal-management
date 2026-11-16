import { GuestOrderStatus, MealType, OrderCycleStatus } from '@prisma/client';
import {
  formatDateOnly,
  formatJalali,
  jalaliFromUtcDate,
} from '../../../common/calendar/jalali';

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
    menuItemId: string | null;
    usernameSnapshot: string;
    buildingIdSnapshot: string | null;
    buildingNameSnapshot: string | null;
    mealTitleSnapshot: string;
    mealDateSnapshot: Date;
    mealTypeSnapshot: MealType;
    status: OrderCycleStatus;
    createdAt: Date;
    menuItem: { menuVersionId: string; title: string } | null;
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
    menuItemId: string | null;
    status: OrderCycleStatus;
    mealTitleSnapshot: string;
    createdAt: Date;
  }[];
  rating?: {
    id: string;
    score: number;
    comment: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
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
          menuVersionId: cycle.menuItem?.menuVersionId ?? null,
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
    rating: order.rating ? presentRatingSummary(order.rating) : null,
    cycles: order.cycles,
  };
}

export function presentRatingSummary(rating: {
  id: string;
  score: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: rating.id,
    score: rating.score,
    comment: rating.comment,
    createdAt: rating.createdAt,
    updatedAt: rating.updatedAt,
  };
}

export function presentRating(rating: {
  id: string;
  orderId: string;
  orderCycleId: string;
  score: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  order?: {
    id: string;
    userId: string;
    mealDate: Date;
    mealType: MealType;
  };
  orderCycle?: {
    id: string;
    usernameSnapshot: string;
    mealTitleSnapshot: string;
    buildingNameSnapshot: string | null;
    mealTypeSnapshot: MealType;
    status: string;
  };
}) {
  const jalali = rating.order ? jalaliFromUtcDate(rating.order.mealDate) : null;
  return {
    id: rating.id,
    orderId: rating.orderId,
    orderCycleId: rating.orderCycleId,
    score: rating.score,
    comment: rating.comment,
    createdAt: rating.createdAt,
    updatedAt: rating.updatedAt,
    userId: rating.order?.userId ?? null,
    mealDate: rating.order ? formatDateOnly(rating.order.mealDate) : null,
    jalaliDate: jalali ? formatJalali(jalali) : null,
    mealType:
      rating.order?.mealType ?? rating.orderCycle?.mealTypeSnapshot ?? null,
    usernameSnapshot: rating.orderCycle?.usernameSnapshot ?? null,
    mealTitleSnapshot: rating.orderCycle?.mealTitleSnapshot ?? null,
    buildingNameSnapshot: rating.orderCycle?.buildingNameSnapshot ?? null,
    cycleStatus: rating.orderCycle?.status ?? null,
  };
}

export function presentGuestOrder(order: {
  id: string;
  buildingId: string;
  menuItemId: string | null;
  mealDate: Date;
  mealType: MealType;
  quantity: number;
  note: string | null;
  status: GuestOrderStatus;
  buildingNameSnapshot: string | null;
  mealTitleSnapshot: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  menuItem?: { menuVersionId: string } | null;
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
