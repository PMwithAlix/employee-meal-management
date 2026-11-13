import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MealType, MenuVersionStatus, Prisma } from '@prisma/client';
import { formatDateOnly } from '../dates/jalali';

export async function requirePublishedOption(
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
  if (item.menuVersion.status !== MenuVersionStatus.PUBLISHED) {
    throw new UnprocessableEntityException(
      'امکان سفارش از نسخه پیش‌نویس منو وجود ندارد.',
    );
  }
  if (item.menuVersion.menu.publishedVersionId !== item.menuVersionId) {
    throw new UnprocessableEntityException(
      'این گزینه مربوط به نسخه منتشرشدهٔ جاری نیست.',
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
