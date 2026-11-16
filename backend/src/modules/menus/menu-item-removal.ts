import { MealType, Role } from '@prisma/client';
import { JALALI_MONTHS, jalaliFromUtcDate } from '../../common/calendar/jalali';

export const MENU_ITEM_ACTIVE_ORDER_FALLBACK =
  'این غذا در سفارش فعال ثبت شده است و حذف نمی‌شود. ابتدا سفارش فعال این وعده را لغو کنید.';

const ROLE_FA: Record<Role, string> = {
  EMPLOYEE: 'کارمند',
  HR: 'منابع انسانی',
  SUPPORT: 'پشتیبان',
  MANAGEMENT: 'مدیریت',
  ADMIN: 'ادمین',
};

function mealFa(type: MealType) {
  return type === MealType.DINNER ? 'شام' : 'ناهار';
}

function dateFa(date: Date) {
  const jalali = jalaliFromUtcDate(date);
  if (!jalali) return '';
  return `${jalali.day} ${JALALI_MONTHS[jalali.month - 1]}`;
}

export function describeBlockingEmployeeOrder(input: {
  username: string;
  role?: Role | string | null;
  mealDate: Date;
  mealType: MealType;
}) {
  const roleLabel =
    input.role && input.role in ROLE_FA ? ROLE_FA[input.role as Role] : 'کاربر';
  const when = dateFa(input.mealDate);
  return `${roleLabel} «${input.username}» · ${mealFa(input.mealType)}${when ? ` ${when}` : ''}`;
}

export function describeBlockingGuestOrder(input: {
  buildingName?: string | null;
  mealDate: Date;
  mealType: MealType;
}) {
  const where = input.buildingName?.trim()
    ? `ساختمان ${input.buildingName.trim()}`
    : 'مهمان';
  const when = dateFa(input.mealDate);
  return `سفارش مهمان ${where} · ${mealFa(input.mealType)}${when ? ` ${when}` : ''}`;
}

export function menuItemRemovalBlocked(samples: string[]) {
  const unique = [...new Set(samples.filter(Boolean))].slice(0, 3);
  const head = unique.length
    ? `این غذا هنوز سفارش فعال دارد و حذف نمی‌شود. نمونه: ${unique.join('؛ ')}.`
    : MENU_ITEM_ACTIVE_ORDER_FALLBACK;
  const tail =
    ' از تب «سفارش کارکنان» همان سفارش را لغو کنید. سفارش نقش‌هایی مثل منابع انسانی هم آنجا دیده می‌شود، نه فقط کارمند.';
  return {
    message: unique.length ? `${head}${tail}` : MENU_ITEM_ACTIVE_ORDER_FALLBACK,
    errors: unique,
  };
}
