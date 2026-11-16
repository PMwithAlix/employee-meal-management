import { MealType, MenuVersionStatus } from '@prisma/client';
import {
  formatDateOnly,
  formatJalali,
  jalaliFromUtcDate,
} from '../../common/calendar/jalali';
import type { ConfiguredMeal } from './menu.types';
import { groupItemsAsMeals } from './menu.validation';

export function presentOption(option: {
  id: string;
  title: string;
  displayOrder: number;
}) {
  return {
    id: option.id,
    title: option.title,
    displayOrder: option.displayOrder,
  };
}

export function presentVersion(version: {
  id: string;
  menuId: string;
  versionNumber: number;
  status: MenuVersionStatus;
  publishedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  items?: {
    id: string;
    mealDate: Date;
    mealType: MealType;
    title: string;
    displayOrder: number;
  }[];
}) {
  const meals = version.items
    ? groupItemsAsMeals(version.items).map((meal) => {
        const jalali = jalaliFromUtcDate(meal.mealDate);
        return {
          mealDate: formatDateOnly(meal.mealDate),
          jalaliDate: jalali ? formatJalali(jalali) : null,
          mealType: meal.mealType,
          options: meal.options
            .filter((option) => option.id)
            .map((option) =>
              presentOption({
                id: option.id as string,
                title: option.title,
                displayOrder: option.displayOrder,
              }),
            ),
        };
      })
    : undefined;

  return {
    id: version.id,
    menuId: version.menuId,
    versionNumber: version.versionNumber,
    status: version.status,
    publishedAt: version.publishedAt,
    createdBy: version.createdBy,
    createdAt: version.createdAt,
    meals,
  };
}

export function presentConfiguredMeals(meals: ConfiguredMeal[]) {
  return meals.map((meal) => {
    const jalali = jalaliFromUtcDate(meal.mealDate);
    const mealDate = formatDateOnly(meal.mealDate);
    return {
      mealDate,
      jalaliDate: jalali ? formatJalali(jalali) : null,
      mealType: meal.mealType,
      options: meal.options.map((option, index) => ({
        id: option.id ?? `preview:${mealDate}:${meal.mealType}:${index + 1}`,
        title: option.title,
        displayOrder: option.displayOrder,
      })),
    };
  });
}

export function presentMenu(menu: {
  id: string;
  year: number;
  month: number;
  publishedVersionId: string | null;
  lastAnnouncedAt?: Date | null;
  lastAnnouncedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  versions?: { id: string; versionNumber: number; status: MenuVersionStatus }[];
  _count?: { versions: number };
}) {
  return {
    id: menu.id,
    jalaliYear: menu.year,
    jalaliMonth: menu.month,
    publishedVersionId: menu.publishedVersionId,
    lastAnnouncedAt: menu.lastAnnouncedAt ?? null,
    lastAnnouncedBy: menu.lastAnnouncedBy ?? null,
    createdAt: menu.createdAt,
    updatedAt: menu.updatedAt,
    versionCount: menu._count?.versions ?? menu.versions?.length,
    versions: menu.versions,
  };
}
