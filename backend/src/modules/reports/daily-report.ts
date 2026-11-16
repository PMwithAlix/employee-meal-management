import { MealType } from '@prisma/client';

export const UNASSIGNED_BUILDING_KEY = '__unassigned__';

export type DailyReportMenuItem = {
  id: string;
  mealType: MealType;
  title: string;
  displayOrder: number;
};

export type DailyReportStaffOrder = {
  id: string;
  userId: string;
  mealType: MealType;
  username: string;
  buildingId: string | null;
  buildingName: string | null;
  menuItemId: string | null;
  title: string;
};

export type DailyReportGuestOrder = {
  id: string;
  mealType: MealType;
  buildingId: string | null;
  buildingName: string | null;
  menuItemId: string | null;
  title: string;
  quantity: number;
  note: string | null;
};

export type DailyReportFoodRow = {
  menuItemId: string | null;
  title: string;
  onMenu: boolean;
  staffCount: number;
  guestCount: number;
  total: number;
};

export type DailyReportMealSummary = {
  mealType: MealType;
  foods: DailyReportFoodRow[];
  staffTotal: number;
  guestTotal: number;
  total: number;
};

export type DailyReportUserRow = {
  userId: string;
  name: string;
  lunch: string[];
  dinner: string[];
};

export type DailyReportGuestRow = {
  id: string;
  mealType: MealType;
  title: string;
  quantity: number;
  note: string | null;
};

export type DailyReportBuilding = {
  buildingId: string | null;
  buildingName: string;
  users: DailyReportUserRow[];
  guests: DailyReportGuestRow[];
};

export type DailyReport = {
  mealDate: string;
  jalaliDate: string | null;
  generatedAt: string;
  lunch: DailyReportMealSummary;
  dinner: DailyReportMealSummary;
  buildings: DailyReportBuilding[];
  unassignedGuests: DailyReportGuestRow[];
};

type MealBucket = {
  mealType: MealType;
  foods: Map<string, DailyReportFoodRow>;
  extras: Map<string, DailyReportFoodRow>;
};

function foodKey(menuItemId: string | null, title: string) {
  return menuItemId ? `id:${menuItemId}` : `title:${title}`;
}

function emptyMeal(mealType: MealType, menuItems: DailyReportMenuItem[]): MealBucket {
  const foods = new Map<string, DailyReportFoodRow>();
  for (const item of [...menuItems].sort((a, b) => a.displayOrder - b.displayOrder)) {
    foods.set(foodKey(item.id, item.title), {
      menuItemId: item.id,
      title: item.title,
      onMenu: true,
      staffCount: 0,
      guestCount: 0,
      total: 0,
    });
  }
  return { mealType, foods, extras: new Map() };
}

function matchFood(bucket: MealBucket, menuItemId: string | null, title: string) {
  if (menuItemId) {
    const byId = bucket.foods.get(foodKey(menuItemId, title));
    if (byId) return byId;
  }
  if (title) {
    for (const food of bucket.foods.values()) {
      if (food.title === title) return food;
    }
  }
  const extraKey = foodKey(null, title || 'بدون عنوان');
  const existing = bucket.extras.get(extraKey);
  if (existing) return existing;
  const created: DailyReportFoodRow = {
    menuItemId: null,
    title: title || 'بدون عنوان',
    onMenu: false,
    staffCount: 0,
    guestCount: 0,
    total: 0,
  };
  bucket.extras.set(extraKey, created);
  return created;
}

function addCount(food: DailyReportFoodRow, kind: 'staff' | 'guest', amount: number) {
  if (amount <= 0) return;
  if (kind === 'staff') food.staffCount += amount;
  else food.guestCount += amount;
  food.total = food.staffCount + food.guestCount;
}

function summarize(bucket: MealBucket): DailyReportMealSummary {
  const foods = [...bucket.foods.values(), ...bucket.extras.values()];
  return {
    mealType: bucket.mealType,
    foods,
    staffTotal: foods.reduce((sum, food) => sum + food.staffCount, 0),
    guestTotal: foods.reduce((sum, food) => sum + food.guestCount, 0),
    total: foods.reduce((sum, food) => sum + food.total, 0),
  };
}

function buildingKey(buildingId: string | null) {
  return buildingId && buildingId.trim() ? buildingId : UNASSIGNED_BUILDING_KEY;
}

function buildingName(buildingId: string | null, name: string | null) {
  if (buildingKey(buildingId) === UNASSIGNED_BUILDING_KEY) return 'بدون ساختمان مشخص';
  return name?.trim() || 'ساختمان بدون نام';
}

function compareFa(left: string, right: string) {
  return left.localeCompare(right, 'fa');
}

export function buildDailyReport(input: {
  mealDate: string;
  jalaliDate: string | null;
  generatedAt: string;
  menuItems: DailyReportMenuItem[];
  staffOrders: DailyReportStaffOrder[];
  guestOrders: DailyReportGuestOrder[];
}): DailyReport {
  const lunch = emptyMeal(
    MealType.LUNCH,
    input.menuItems.filter((item) => item.mealType === MealType.LUNCH),
  );
  const dinner = emptyMeal(
    MealType.DINNER,
    input.menuItems.filter((item) => item.mealType === MealType.DINNER),
  );
  const meals = { [MealType.LUNCH]: lunch, [MealType.DINNER]: dinner };

  const seenStaff = new Set<string>();
  const users = new Map<
    string,
    DailyReportUserRow & { buildingId: string | null; buildingName: string }
  >();
  const buildings = new Map<string, DailyReportBuilding>();

  function ensureBuilding(buildingId: string | null, name: string | null) {
    const key = buildingKey(buildingId);
    const current = buildings.get(key);
    if (current) {
      if (!current.buildingName || current.buildingName === 'ساختمان بدون نام') {
        current.buildingName = buildingName(buildingId, name);
      }
      return current;
    }
    const created: DailyReportBuilding = {
      buildingId: key === UNASSIGNED_BUILDING_KEY ? null : buildingId,
      buildingName: buildingName(buildingId, name),
      users: [],
      guests: [],
    };
    buildings.set(key, created);
    return created;
  }

  for (const order of input.staffOrders) {
    if (seenStaff.has(order.id)) continue;
    seenStaff.add(order.id);
    const bucket = meals[order.mealType];
    addCount(matchFood(bucket, order.menuItemId, order.title), 'staff', 1);
    const userKey = `${buildingKey(order.buildingId)}:${order.userId}`;
    const row =
      users.get(userKey) ??
      ({
        userId: order.userId,
        name: order.username.trim() || 'کاربر',
        lunch: [],
        dinner: [],
        buildingId: order.buildingId,
        buildingName: buildingName(order.buildingId, order.buildingName),
      } satisfies DailyReportUserRow & { buildingId: string | null; buildingName: string });
    if (order.mealType === MealType.LUNCH) row.lunch.push(order.title || 'بدون عنوان');
    else row.dinner.push(order.title || 'بدون عنوان');
    users.set(userKey, row);
  }

  const unassignedGuests: DailyReportGuestRow[] = [];
  const seenGuests = new Set<string>();
  for (const order of input.guestOrders) {
    if (seenGuests.has(order.id)) continue;
    seenGuests.add(order.id);
    const quantity = Number.isInteger(order.quantity) ? order.quantity : 0;
    if (quantity <= 0) continue;
    const bucket = meals[order.mealType];
    addCount(matchFood(bucket, order.menuItemId, order.title), 'guest', quantity);
    const guestRow: DailyReportGuestRow = {
      id: order.id,
      mealType: order.mealType,
      title: order.title || 'بدون عنوان',
      quantity,
      note: order.note,
    };
    if (buildingKey(order.buildingId) === UNASSIGNED_BUILDING_KEY) {
      unassignedGuests.push(guestRow);
      continue;
    }
    ensureBuilding(order.buildingId, order.buildingName).guests.push(guestRow);
  }

  for (const row of users.values()) {
    ensureBuilding(row.buildingId, row.buildingName).users.push({
      userId: row.userId,
      name: row.name,
      lunch: row.lunch,
      dinner: row.dinner,
    });
  }

  const listed = [...buildings.values()]
    .filter((building) => building.users.length > 0 || building.guests.length > 0)
    .sort((left, right) => {
      if (left.buildingId === null) return 1;
      if (right.buildingId === null) return -1;
      return compareFa(left.buildingName, right.buildingName);
    })
    .map((building) => ({
      ...building,
      users: [...building.users].sort((left, right) => compareFa(left.name, right.name)),
      guests: building.guests,
    }));

  return {
    mealDate: input.mealDate,
    jalaliDate: input.jalaliDate,
    generatedAt: input.generatedAt,
    lunch: summarize(lunch),
    dinner: summarize(dinner),
    buildings: listed,
    unassignedGuests,
  };
}
