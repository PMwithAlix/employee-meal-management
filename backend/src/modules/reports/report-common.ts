import { MealType } from '@prisma/client';

export const UNASSIGNED_BUILDING_KEY = '__unassigned__';

export const REPORT_MEALS = ['ALL', 'LUNCH', 'DINNER'] as const;
export type ReportMealFilter = (typeof REPORT_MEALS)[number];

export function allowsReportMeal(
  filter: ReportMealFilter,
  meal: MealType,
) {
  if (filter === 'ALL') return true;
  return filter === meal;
}

export function reportBuildingKey(buildingId: string | null) {
  return buildingId && buildingId.trim() ? buildingId : UNASSIGNED_BUILDING_KEY;
}

export function reportBuildingName(
  buildingId: string | null,
  name: string | null,
) {
  if (reportBuildingKey(buildingId) === UNASSIGNED_BUILDING_KEY) {
    return 'بدون ساختمان مشخص';
  }
  return name?.trim() || 'ساختمان بدون نام';
}

export function compareFa(left: string, right: string) {
  return left.localeCompare(right, 'fa');
}

export function reportFoodTitle(title: string | null | undefined) {
  const value = title?.trim() ?? '';
  return value || 'بدون عنوان';
}

export function matchLiveMenuItem<T extends { id: string; mealType: MealType }>(
  menuById: Map<string, T>,
  menuItemId: string | null | undefined,
  mealType: MealType,
): T | null {
  if (!menuItemId) return null;
  const item = menuById.get(menuItemId);
  if (!item || item.mealType !== mealType) return null;
  return item;
}

export function reportMealLabel(filter: ReportMealFilter) {
  if (filter === 'LUNCH') return 'فقط ناهار';
  if (filter === 'DINNER') return 'فقط شام';
  return 'هر دو وعده';
}
