import { MealType } from '@prisma/client';
import {
  formatDateOnly,
  gregorianFromUtcDate,
  gregorianToJalali,
} from '../dates/jalali';
import type { ConfiguredMeal, MenuValidationIssue } from './menu.types';

export function normalizeOptionTitle(title: string) {
  return title.replace(/\s+/g, ' ').trim();
}

export function optionTitleIssue(title: string) {
  const normalized = normalizeOptionTitle(title);
  if (!normalized) {
    return 'عنوان گزینه نمی‌تواند خالی باشد.';
  }
  if (normalized.length > 200) {
    return 'عنوان گزینه بیش از حد طولانی است.';
  }
  return '';
}

export function validateConfiguredMeals(
  meals: ConfiguredMeal[],
  jalaliYear: number,
  jalaliMonth: number,
): MenuValidationIssue[] {
  const issues: MenuValidationIssue[] = [];
  const seen = new Set<string>();

  for (const meal of meals) {
    const g = gregorianFromUtcDate(meal.mealDate);
    const jalali = gregorianToJalali(g.year, g.month, g.day);
    if (!jalali) {
      issues.push({
        field: 'mealDate',
        message: `تاریخ ${formatDateOnly(meal.mealDate)} نامعتبر است.`,
      });
      continue;
    }
    if (jalali.year !== jalaliYear || jalali.month !== jalaliMonth) {
      issues.push({
        field: 'mealDate',
        message: `تاریخ ${formatDateOnly(meal.mealDate)} داخل ماه انتخاب‌شده نیست.`,
      });
    }

    const key = `${formatDateOnly(meal.mealDate)}:${meal.mealType}`;
    if (seen.has(key)) {
      issues.push({
        field: 'mealType',
        message: `وعده تکراری برای ${key} ثبت شده است.`,
      });
    }
    seen.add(key);

    if (meal.mealType !== MealType.LUNCH && meal.mealType !== MealType.DINNER) {
      issues.push({ field: 'mealType', message: 'نوع وعده نامعتبر است.' });
    }

    if (meal.options.length < 1 || meal.options.length > 3) {
      issues.push({
        field: 'options',
        message: `وعده ${key} باید بین ۱ تا ۳ گزینه داشته باشد.`,
      });
      continue;
    }

    const orders = meal.options
      .map((option) => option.displayOrder)
      .sort((a, b) => a - b);
    const unique = new Set(orders);
    if (unique.size !== orders.length) {
      issues.push({
        field: 'displayOrder',
        message: `ترتیب نمایش تکراری در وعده ${key} وجود دارد.`,
      });
    }
    for (let index = 0; index < orders.length; index += 1) {
      if (orders[index] !== index + 1) {
        issues.push({
          field: 'displayOrder',
          message: `ترتیب گزینه‌های وعده ${key} باید از ۱ و پشت‌سرهم باشد.`,
        });
        break;
      }
    }

    for (const option of meal.options) {
      const titleError = optionTitleIssue(option.title);
      if (titleError) {
        issues.push({ field: 'title', message: `${titleError} (${key})` });
      }
    }
  }

  return issues;
}

export function groupItemsAsMeals(
  items: {
    id: string;
    mealDate: Date;
    mealType: MealType;
    title: string;
    displayOrder: number;
  }[],
): ConfiguredMeal[] {
  const grouped = new Map<string, ConfiguredMeal>();
  for (const item of items) {
    const key = `${formatDateOnly(item.mealDate)}:${item.mealType}`;
    const current = grouped.get(key);
    const option = {
      id: item.id,
      title: item.title,
      displayOrder: item.displayOrder,
    };
    if (current) {
      current.options.push(option);
    } else {
      grouped.set(key, {
        mealDate: item.mealDate,
        mealType: item.mealType,
        options: [option],
      });
    }
  }
  for (const meal of grouped.values()) {
    meal.options.sort((a, b) => a.displayOrder - b.displayOrder);
  }
  return [...grouped.values()];
}
