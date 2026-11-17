import { MealType } from '@prisma/client';
import {
  UNASSIGNED_BUILDING_KEY,
  allowsReportMeal,
  compareFa,
  matchLiveMenuItem,
  reportBuildingKey,
  reportBuildingName,
  reportFoodTitle,
  reportMealLabel,
  type ReportMealFilter,
} from './report-common';

export type MonthlyMenuItem = {
  id: string;
  mealType: MealType;
  title: string;
};

export type MonthlyStaffOrder = {
  id: string;
  mealType: MealType;
  buildingId: string | null;
  buildingName: string | null;
  menuItemId: string | null;
  title: string;
};

export type MonthlyGuestOrder = {
  id: string;
  mealType: MealType;
  buildingId: string | null;
  buildingName: string | null;
  menuItemId: string | null;
  title: string;
  quantity: number;
};

export type MonthlyCount = {
  lunchStaff: number;
  lunchGuest: number;
  dinnerStaff: number;
  dinnerGuest: number;
};

export type MonthlyFoodRow = MonthlyCount & {
  key: string;
  menuItemId: string;
  title: string;
  lunchCount: number;
  dinnerCount: number;
  staffCount: number;
  guestCount: number;
  total: number;
};

export type MonthlyBuildingFoodRow = MonthlyFoodRow & {
  buildingId: string | null;
  buildingName: string;
};

export type MonthlyBuildingTotal = MonthlyCount & {
  buildingId: string | null;
  buildingName: string;
  lunchCount: number;
  dinnerCount: number;
  staffCount: number;
  guestCount: number;
  total: number;
};

export type MonthlyTotals = MonthlyCount & {
  lunchCount: number;
  dinnerCount: number;
  staffCount: number;
  guestCount: number;
  total: number;
};

export type MonthlyReconciliation = {
  foodsTotal: number;
  buildingsTotal: number;
  difference: number;
  matched: boolean;
};

export type MonthlyReport = {
  year: number;
  month: number;
  monthLabel: string;
  meal: ReportMealFilter;
  mealLabel: string;
  generatedAt: string;
  foods: MonthlyFoodRow[];
  foodsTotal: MonthlyTotals;
  buildingRows: MonthlyBuildingFoodRow[];
  buildingTotals: MonthlyBuildingTotal[];
  supply: MonthlyFoodRow[];
  supplyTotal: MonthlyTotals;
  reconciliation: MonthlyReconciliation;
};

type CountBucket = MonthlyCount & {
  key: string;
  menuItemId: string;
  title: string;
};

type FoodIdentity = {
  key: string;
  menuItemId: string;
  title: string;
};

function identityFor(
  menuById: Map<string, MonthlyMenuItem>,
  menuItemId: string | null,
  mealType: MealType,
): FoodIdentity | null {
  const item = matchLiveMenuItem(menuById, menuItemId, mealType);
  if (!item) return null;
  return {
    key: `id:${item.id}`,
    menuItemId: item.id,
    title: reportFoodTitle(item.title),
  };
}

function emptyCount(): MonthlyCount {
  return {
    lunchStaff: 0,
    lunchGuest: 0,
    dinnerStaff: 0,
    dinnerGuest: 0,
  };
}

function addPortion(
  count: MonthlyCount,
  meal: MealType,
  kind: 'staff' | 'guest',
  amount: number,
) {
  if (amount <= 0) return;
  if (meal === MealType.LUNCH) {
    if (kind === 'staff') count.lunchStaff += amount;
    else count.lunchGuest += amount;
    return;
  }
  if (kind === 'staff') count.dinnerStaff += amount;
  else count.dinnerGuest += amount;
}

function withDerived<T extends MonthlyCount>(
  base: T,
): T & {
  lunchCount: number;
  dinnerCount: number;
  staffCount: number;
  guestCount: number;
  total: number;
} {
  const lunchCount = base.lunchStaff + base.lunchGuest;
  const dinnerCount = base.dinnerStaff + base.dinnerGuest;
  return {
    ...base,
    lunchCount,
    dinnerCount,
    staffCount: base.lunchStaff + base.dinnerStaff,
    guestCount: base.lunchGuest + base.dinnerGuest,
    total: lunchCount + dinnerCount,
  };
}

function sumCounts(rows: MonthlyCount[]): MonthlyTotals {
  const total = emptyCount();
  for (const row of rows) {
    total.lunchStaff += row.lunchStaff;
    total.lunchGuest += row.lunchGuest;
    total.dinnerStaff += row.dinnerStaff;
    total.dinnerGuest += row.dinnerGuest;
  }
  return withDerived(total);
}

function mergeCounts(left: MonthlyCount, right: MonthlyCount): MonthlyCount {
  return {
    lunchStaff: left.lunchStaff + right.lunchStaff,
    lunchGuest: left.lunchGuest + right.lunchGuest,
    dinnerStaff: left.dinnerStaff + right.dinnerStaff,
    dinnerGuest: left.dinnerGuest + right.dinnerGuest,
  };
}

function ensureBucket(
  map: Map<string, CountBucket>,
  identity: FoodIdentity,
) {
  const current = map.get(identity.key);
  if (current) {
    current.title = identity.title;
    return current;
  }
  const created: CountBucket = {
    ...emptyCount(),
    key: identity.key,
    menuItemId: identity.menuItemId,
    title: identity.title,
  };
  map.set(identity.key, created);
  return created;
}

function toFoodRow(bucket: CountBucket): MonthlyFoodRow {
  const { key, menuItemId, title, ...counts } = bucket;
  return {
    key,
    menuItemId,
    title,
    ...withDerived(counts),
  };
}

function compareFoodRows(left: MonthlyFoodRow, right: MonthlyFoodRow) {
  const byTitle = compareFa(left.title, right.title);
  if (byTitle !== 0) return byTitle;
  return (left.menuItemId ?? '').localeCompare(right.menuItemId ?? '');
}

export function buildMonthlyReport(input: {
  year: number;
  month: number;
  monthLabel: string;
  generatedAt: string;
  meal?: ReportMealFilter;
  menuItems: MonthlyMenuItem[];
  staffOrders: MonthlyStaffOrder[];
  guestOrders: MonthlyGuestOrder[];
}): MonthlyReport {
  const meal = input.meal ?? 'ALL';
  const menuById = new Map(
    input.menuItems
      .filter((item) => allowsReportMeal(meal, item.mealType))
      .map((item) => [item.id, item]),
  );

  const foods = new Map<string, CountBucket>();
  const unmatched = emptyCount();
  const buildings = new Map<
    string,
    {
      buildingId: string | null;
      buildingName: string;
      foods: Map<string, CountBucket>;
      unmatched: MonthlyCount;
    }
  >();

  function ensureBuilding(buildingId: string | null, name: string | null) {
    const key = reportBuildingKey(buildingId);
    const current = buildings.get(key);
    if (current) {
      if (
        !current.buildingName ||
        current.buildingName === 'ساختمان بدون نام'
      ) {
        current.buildingName = reportBuildingName(buildingId, name);
      }
      return current;
    }
    const created = {
      buildingId: key === UNASSIGNED_BUILDING_KEY ? null : buildingId,
      buildingName: reportBuildingName(buildingId, name),
      foods: new Map<string, CountBucket>(),
      unmatched: emptyCount(),
    };
    buildings.set(key, created);
    return created;
  }

  function record(
    buildingId: string | null,
    buildingName: string | null,
    menuItemId: string | null,
    mealType: MealType,
    kind: 'staff' | 'guest',
    amount: number,
  ) {
    if (!allowsReportMeal(meal, mealType)) return;
    if (amount <= 0) return;
    const identity = identityFor(menuById, menuItemId, mealType);
    const building = ensureBuilding(buildingId, buildingName);
    if (!identity) {
      addPortion(unmatched, mealType, kind, amount);
      addPortion(building.unmatched, mealType, kind, amount);
      return;
    }
    addPortion(ensureBucket(foods, identity), mealType, kind, amount);
    addPortion(ensureBucket(building.foods, identity), mealType, kind, amount);
  }

  const seenStaff = new Set<string>();
  for (const order of input.staffOrders) {
    if (seenStaff.has(order.id)) continue;
    seenStaff.add(order.id);
    record(
      order.buildingId,
      order.buildingName,
      order.menuItemId,
      order.mealType,
      'staff',
      1,
    );
  }

  const seenGuests = new Set<string>();
  for (const order of input.guestOrders) {
    if (seenGuests.has(order.id)) continue;
    seenGuests.add(order.id);
    const quantity = Number.isInteger(order.quantity) ? order.quantity : 0;
    record(
      order.buildingId,
      order.buildingName,
      order.menuItemId,
      order.mealType,
      'guest',
      quantity,
    );
  }

  const foodRows = [...foods.values()]
    .map((bucket) => toFoodRow(bucket))
    .filter((row) => row.total > 0)
    .sort(compareFoodRows);

  const listedBuildings = [...buildings.values()].sort((left, right) => {
    if (left.buildingId === null) return 1;
    if (right.buildingId === null) return -1;
    return compareFa(left.buildingName, right.buildingName);
  });

  const buildingRows: MonthlyBuildingFoodRow[] = [];
  const buildingTotals: MonthlyBuildingTotal[] = [];
  for (const building of listedBuildings) {
    const rows = [...building.foods.values()]
      .map((bucket) => ({
        buildingId: building.buildingId,
        buildingName: building.buildingName,
        ...toFoodRow(bucket),
      }))
      .filter((row) => row.total > 0)
      .sort(compareFoodRows);
    const buildingTotal = withDerived(mergeCounts(sumCounts(rows), building.unmatched));
    if (rows.length === 0 && buildingTotal.total === 0) continue;
    buildingRows.push(...rows);
    buildingTotals.push({
      buildingId: building.buildingId,
      buildingName: building.buildingName,
      ...buildingTotal,
    });
  }

  const foodsTotal = withDerived(mergeCounts(sumCounts(foodRows), unmatched));
  const buildingsAggregate = sumCounts(buildingTotals);
  const supply = foodRows;
  const supplyTotal = foodsTotal;
  const difference = foodsTotal.total - buildingsAggregate.total;

  return {
    year: input.year,
    month: input.month,
    monthLabel: input.monthLabel,
    meal,
    mealLabel: reportMealLabel(meal),
    generatedAt: input.generatedAt,
    foods: foodRows,
    foodsTotal,
    buildingRows,
    buildingTotals,
    supply,
    supplyTotal,
    reconciliation: {
      foodsTotal: foodsTotal.total,
      buildingsTotal: buildingsAggregate.total,
      difference,
      matched: difference === 0,
    },
  };
}
