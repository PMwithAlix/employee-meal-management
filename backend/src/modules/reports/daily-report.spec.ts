import { MealType } from '@prisma/client';
import { buildDailyReport } from './daily-report';

describe('buildDailyReport', () => {
  it('counts staff and guests separately, skips cancelled duplicates, and omits zero-order menu rows', () => {
    const report = buildDailyReport({
      mealDate: '2026-11-16',
      jalaliDate: '1405/08/25',
      generatedAt: '2026-11-16T12:00:00.000Z',
      menuItems: [
        { id: 'lunch-1', mealType: MealType.LUNCH, title: 'جوجه', displayOrder: 1 },
        { id: 'lunch-2', mealType: MealType.LUNCH, title: 'قیمه', displayOrder: 2 },
        { id: 'dinner-1', mealType: MealType.DINNER, title: 'کوکو', displayOrder: 1 },
      ],
      staffOrders: [
        {
          id: 'o1',
          userId: 'u1',
          mealType: MealType.LUNCH,
          username: 'کاربر اول',
          buildingId: 'b1',
          buildingName: 'دهقان',
          menuItemId: 'lunch-1',
          title: 'جوجه',
        },
        {
          id: 'o1',
          userId: 'u1',
          mealType: MealType.LUNCH,
          username: 'کاربر اول',
          buildingId: 'b1',
          buildingName: 'دهقان',
          menuItemId: 'lunch-1',
          title: 'جوجه',
        },
        {
          id: 'o2',
          userId: 'u2',
          mealType: MealType.LUNCH,
          username: 'کاربر دوم',
          buildingId: 'b1',
          buildingName: 'دهقان',
          menuItemId: null,
          title: 'جوجه',
        },
        {
          id: 'o3',
          userId: 'u-admin',
          mealType: MealType.DINNER,
          username: 'ادمین',
          buildingId: 'b2',
          buildingName: 'مرکزی',
          menuItemId: 'dinner-1',
          title: 'کوکو',
        },
      ],
      guestOrders: [
        {
          id: 'g1',
          mealType: MealType.LUNCH,
          buildingId: 'b1',
          buildingName: 'دهقان',
          menuItemId: 'lunch-1',
          title: 'جوجه',
          quantity: 3,
          note: 'جلسه',
        },
        {
          id: 'g1',
          mealType: MealType.LUNCH,
          buildingId: 'b1',
          buildingName: 'دهقان',
          menuItemId: 'lunch-1',
          title: 'جوجه',
          quantity: 3,
          note: 'جلسه',
        },
        {
          id: 'g0',
          mealType: MealType.LUNCH,
          buildingId: 'b1',
          buildingName: 'دهقان',
          menuItemId: 'lunch-1',
          title: 'جوجه',
          quantity: 0,
          note: null,
        },
        {
          id: 'g2',
          mealType: MealType.DINNER,
          buildingId: null,
          buildingName: null,
          menuItemId: null,
          title: 'کوکو',
          quantity: 2,
          note: null,
        },
      ],
    });

    expect(report.lunch.foods).toEqual([
      {
        menuItemId: 'lunch-1',
        title: 'جوجه',
        staffCount: 1,
        guestCount: 3,
        total: 4,
      },
    ]);
    expect(report.lunch.staffTotal).toBe(2);
    expect(report.lunch.guestTotal).toBe(3);
    expect(report.lunch.total).toBe(5);
    expect(report.dinner.foods).toEqual([
      {
        menuItemId: 'dinner-1',
        title: 'کوکو',
        staffCount: 1,
        guestCount: 0,
        total: 1,
      },
    ]);
    expect(report.dinner.staffTotal).toBe(1);
    expect(report.dinner.guestTotal).toBe(2);
    expect(report.dinner.total).toBe(3);
    expect(report.buildings.map((item) => item.buildingName)).toEqual(['دهقان', 'مرکزی']);
    expect(report.buildings[0].users).toHaveLength(2);
    expect(report.buildings[0].guests).toEqual([
      { id: 'g1', mealType: MealType.LUNCH, title: 'جوجه', quantity: 3, note: 'جلسه' },
    ]);
    expect(report.unassignedGuests).toEqual([
      { id: 'g2', mealType: MealType.DINNER, title: '—', quantity: 2, note: null },
    ]);
  });

  it('keeps unmatched active orders in totals without inventing a snapshot food', () => {
    const report = buildDailyReport({
      mealDate: '2026-11-16',
      jalaliDate: '1405/08/25',
      generatedAt: '2026-11-16T12:00:00.000Z',
      menuItems: [{ id: 'lunch-1', mealType: MealType.LUNCH, title: 'جوجه', displayOrder: 1 }],
      staffOrders: [
        {
          id: 'o1',
          userId: 'u1',
          mealType: MealType.LUNCH,
          username: 'کاربر',
          buildingId: null,
          buildingName: null,
          menuItemId: null,
          title: 'غذای حذف‌شده',
        },
        {
          id: 'o2',
          userId: 'u1',
          mealType: MealType.DINNER,
          username: 'کاربر',
          buildingId: null,
          buildingName: null,
          menuItemId: null,
          title: 'آش',
        },
      ],
      guestOrders: [],
    });

    expect(report.lunch.foods).toEqual([]);
    expect(report.lunch.staffTotal).toBe(1);
    expect(report.lunch.total).toBe(1);
    expect(report.dinner.foods).toEqual([]);
    expect(report.dinner.staffTotal).toBe(1);
    expect(report.buildings).toHaveLength(1);
    expect(report.buildings[0].buildingId).toBeNull();
    expect(report.buildings[0].users[0].lunch).toEqual([]);
    expect(report.buildings[0].users[0].dinner).toEqual([]);
  });

  it('hides zero-order foods independently for lunch and dinner without changing meal totals', () => {
    const report = buildDailyReport({
      mealDate: '2026-11-16',
      jalaliDate: '1405/08/25',
      generatedAt: '2026-11-16T12:00:00.000Z',
      menuItems: [
        { id: 'lunch-1', mealType: MealType.LUNCH, title: 'جوجه', displayOrder: 1 },
        { id: 'lunch-2', mealType: MealType.LUNCH, title: 'قیمه', displayOrder: 2 },
        { id: 'dinner-1', mealType: MealType.DINNER, title: 'کوکو', displayOrder: 1 },
        { id: 'dinner-2', mealType: MealType.DINNER, title: 'آش', displayOrder: 2 },
      ],
      staffOrders: [
        {
          id: 'o1',
          userId: 'u1',
          mealType: MealType.LUNCH,
          username: 'کاربر',
          buildingId: 'b1',
          buildingName: 'دهقان',
          menuItemId: 'lunch-1',
          title: 'جوجه',
        },
      ],
      guestOrders: [],
    });

    expect(report.lunch.foods.every((item) => item.total > 0)).toBe(true);
    expect(report.dinner.foods.every((item) => item.total > 0)).toBe(true);
    expect(report.lunch.foods.map((item) => item.title)).toEqual(['جوجه']);
    expect(report.dinner.foods).toEqual([]);
    expect(report.lunch.staffTotal).toBe(1);
    expect(report.lunch.guestTotal).toBe(0);
    expect(report.lunch.total).toBe(1);
    expect(report.dinner.staffTotal).toBe(0);
    expect(report.dinner.guestTotal).toBe(0);
    expect(report.dinner.total).toBe(0);
  });

  it('limits restaurant and building rows to the selected meal', () => {
    const report = buildDailyReport({
      mealDate: '2026-11-16',
      jalaliDate: '1405/08/25',
      generatedAt: '2026-11-16T12:00:00.000Z',
      meal: 'LUNCH',
      menuItems: [
        { id: 'lunch-1', mealType: MealType.LUNCH, title: 'جوجه', displayOrder: 1 },
        { id: 'dinner-1', mealType: MealType.DINNER, title: 'کوکو', displayOrder: 1 },
      ],
      staffOrders: [
        {
          id: 'o1',
          userId: 'u1',
          mealType: MealType.LUNCH,
          username: 'کاربر',
          buildingId: 'b1',
          buildingName: 'دهقان',
          menuItemId: 'lunch-1',
          title: 'جوجه',
        },
        {
          id: 'o2',
          userId: 'u1',
          mealType: MealType.DINNER,
          username: 'کاربر',
          buildingId: 'b1',
          buildingName: 'دهقان',
          menuItemId: 'dinner-1',
          title: 'کوکو',
        },
      ],
      guestOrders: [],
    });
    expect(report.meal).toBe('LUNCH');
    expect(report.lunch.total).toBe(1);
    expect(report.dinner.total).toBe(0);
    expect(report.dinner.foods).toEqual([]);
    expect(report.buildings[0]?.users[0]?.lunch).toEqual(['جوجه']);
    expect(report.buildings[0]?.users[0]?.dinner).toEqual([]);
  });

  it('uses the live menu title when it differs from the order snapshot', () => {
    const report = buildDailyReport({
      mealDate: '2026-11-22',
      jalaliDate: '1405/09/01',
      generatedAt: '2026-11-22T12:00:00.000Z',
      menuItems: [
        {
          id: 'MENU_ITEM_123',
          mealType: MealType.LUNCH,
          title: 'چلو جوجه زعفرانی',
          displayOrder: 1,
        },
      ],
      staffOrders: [
        {
          id: 'o1',
          userId: 'u1',
          mealType: MealType.LUNCH,
          username: 'کاربر',
          buildingId: 'b1',
          buildingName: 'دهقان',
          menuItemId: 'MENU_ITEM_123',
          title: 'چلو جوجه لاری',
        },
      ],
      guestOrders: [],
    });
    expect(report.lunch.foods).toEqual([
      {
        menuItemId: 'MENU_ITEM_123',
        title: 'چلو جوجه زعفرانی',
        staffCount: 1,
        guestCount: 0,
        total: 1,
      },
    ]);
    expect(report.buildings[0]?.users[0]?.lunch).toEqual(['چلو جوجه زعفرانی']);
  });

  it('does not merge a deleted item into another food with the same snapshot title', () => {
    const report = buildDailyReport({
      mealDate: '2026-11-22',
      jalaliDate: '1405/09/01',
      generatedAt: '2026-11-22T12:00:00.000Z',
      menuItems: [
        {
          id: 'current',
          mealType: MealType.LUNCH,
          title: 'چلو جوجه لاری',
          displayOrder: 1,
        },
      ],
      staffOrders: [
        {
          id: 'o1',
          userId: 'u1',
          mealType: MealType.LUNCH,
          username: 'کاربر',
          buildingId: 'b1',
          buildingName: 'دهقان',
          menuItemId: 'removed',
          title: 'چلو جوجه لاری',
        },
        {
          id: 'o2',
          userId: 'u2',
          mealType: MealType.LUNCH,
          username: 'کاربر دو',
          buildingId: 'b1',
          buildingName: 'دهقان',
          menuItemId: 'current',
          title: 'چلو جوجه لاری',
        },
      ],
      guestOrders: [],
    });
    expect(report.lunch.foods).toEqual([
      {
        menuItemId: 'current',
        title: 'چلو جوجه لاری',
        staffCount: 1,
        guestCount: 0,
        total: 1,
      },
    ]);
    expect(report.lunch.staffTotal).toBe(2);
    expect(report.lunch.total).toBe(2);
    expect(JSON.stringify(report)).not.toContain('خارج از منوی جاری');
  });

  it('does not attach a lunch order to a dinner menu item with the same id mismatch', () => {
    const report = buildDailyReport({
      mealDate: '2026-11-16',
      jalaliDate: '1405/08/25',
      generatedAt: '2026-11-16T12:00:00.000Z',
      menuItems: [
        { id: 'dinner-1', mealType: MealType.DINNER, title: 'کوکو', displayOrder: 1 },
      ],
      staffOrders: [
        {
          id: 'o1',
          userId: 'u1',
          mealType: MealType.LUNCH,
          username: 'کاربر',
          buildingId: 'b1',
          buildingName: 'دهقان',
          menuItemId: 'dinner-1',
          title: 'کوکو',
        },
      ],
      guestOrders: [],
    });
    expect(report.lunch.foods).toEqual([]);
    expect(report.lunch.total).toBe(1);
    expect(report.dinner.foods).toEqual([]);
    expect(report.dinner.total).toBe(0);
  });
});
