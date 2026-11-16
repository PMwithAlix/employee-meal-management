import { MealType, Prisma } from '@prisma/client';
import { jalaliFromUtcDate } from '../../../common/calendar/jalali';

/** int4 class key for Khaan deadline month locks ('KHND'). */
export const DEADLINE_MONTH_LOCK_CLASS = 0x4b484e44;

export function deadlineMonthLockKey(year: number, month: number) {
  return year * 100 + month;
}

export async function lockDeadlineMonth(
  tx: Prisma.TransactionClient,
  year: number,
  month: number,
) {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(${DEADLINE_MONTH_LOCK_CLASS}::integer, ${deadlineMonthLockKey(year, month)}::integer)`,
  );
}

export async function lockDeadlineMonthForMealDate(
  tx: Prisma.TransactionClient,
  mealDate: Date,
) {
  const jalali = jalaliFromUtcDate(mealDate);
  if (!jalali) {
    return;
  }
  await lockDeadlineMonth(tx, jalali.year, jalali.month);
}

export async function lockDeadlinePolicy(
  tx: Prisma.TransactionClient,
  mealType: MealType,
) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "order_deadline_policies" WHERE "mealType" = CAST(${mealType} AS "MealType") FOR UPDATE`,
  );
}

export async function lockOrderRow(
  tx: Prisma.TransactionClient,
  input: {
    orderId?: string;
    userId: string;
    mealDate: Date;
    mealType: MealType;
  },
) {
  if (input.orderId) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "orders" WHERE "id" = ${input.orderId}::uuid FOR UPDATE`,
    );
    return;
  }
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "orders" WHERE "userId" = ${input.userId}::uuid AND "mealDate" = ${input.mealDate} AND "mealType" = CAST(${input.mealType} AS "MealType") FOR UPDATE`,
  );
}

export const deadlineTxOptions = {
  maxWait: 10_000,
  timeout: 15_000,
} as const;
