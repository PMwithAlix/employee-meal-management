import { MealType } from '@prisma/client';
import { JALALI_MONTHS } from '../../common/calendar/jalali';

export type MenuOptionInput = {
  id?: string;
  title: string;
  displayOrder?: number;
};

export type ConfiguredMeal = {
  mealDate: Date;
  mealType: MealType;
  options: { id?: string; title: string; displayOrder: number }[];
};

export type MenuValidationIssue = {
  sheet?: string;
  row?: number;
  field?: string;
  message: string;
};

export const ImportPolicy = {
  KeepExistingOrders: 'KEEP_EXISTING_ORDERS',
  ExactMatchOnly: 'EXACT_MATCH_ONLY',
  Reset: 'RESET',
} as const;

export type ImportPolicy = (typeof ImportPolicy)[keyof typeof ImportPolicy];

export const MENU_PUBLISHED_NOTIFICATION = 'MENU_PUBLISHED' as const;

export function defaultMenuAnnouncementCopy(jalaliMonth: number) {
  const monthName = JALALI_MONTHS[jalaliMonth - 1];
  return {
    title: `منوی ${monthName} منتشر شد 🍽️`,
    body: 'برای مشاهده منو و ثبت وعده‌های غذایی، وارد سامانه شوید.',
  };
}
