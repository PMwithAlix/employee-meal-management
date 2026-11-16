import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MealType, Prisma } from '@prisma/client';
import { formatDateOnly } from '../../../common/calendar/jalali';

export async function requireCurrentMenuOption(
  tx: Prisma.TransactionClient,
  menuItemId: string,
  mealDate: Date,
  mealType: MealType,
) {
  const item = await tx.menuItem.findUnique({
    where: { id: menuItemId },
    include: {
      menuVersion: { include: { menu: true } },
    },
  });
  if (!item) {
    throw new NotFoundException('گزینه منو پیدا نشد.');
  }
  const live = await tx.menuVersion.findFirst({
    where: { menuId: item.menuVersion.menuId },
    orderBy: { versionNumber: 'desc' },
    select: { id: true },
  });
  if (!live || live.id !== item.menuVersionId) {
    throw new UnprocessableEntityException(
      'این گزینه مربوط به منوی جاری این ماه نیست.',
    );
  }
  if (
    formatDateOnly(item.mealDate) !== formatDateOnly(mealDate) ||
    item.mealType !== mealType
  ) {
    throw new UnprocessableEntityException(
      'گزینه انتخاب‌شده با تاریخ یا نوع وعده هم‌خوان نیست.',
    );
  }
  return item;
}
