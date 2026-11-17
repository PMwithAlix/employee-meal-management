import { MealType } from '@prisma/client';
import { buildMonthlyReport } from './monthly-report';

const generatedAt = '2026-11-16T12:00:00.000Z';

function report(
  staff: Parameters<typeof buildMonthlyReport>[0]['staffOrders'],
  guests: Parameters<typeof buildMonthlyReport>[0]['guestOrders'] = [],
  extra: Partial<Parameters<typeof buildMonthlyReport>[0]> = {},
) {
  return buildMonthlyReport({
    year: 1405,
    month: 9,
    monthLabel: 'آذر ۱۴۰۵',
    generatedAt,
    menuItems: [
      { id: 'lunch-1', mealType: MealType.LUNCH, title: 'چلو جوجه' },
      { id: 'lunch-2', mealType: MealType.LUNCH, title: 'قیمه' },
      { id: 'dinner-1', mealType: MealType.DINNER, title: 'چلو جوجه' },
    ],
    staffOrders: staff,
    guestOrders: guests,
    ...extra,
  });
}

describe('buildMonthlyReport', () => {
  it('counts staff and guests once, keeps lunch/dinner independent, and matches building totals', () => {
    const result = report(
      [
        {
          id: 'o1',
          mealType: MealType.LUNCH,
          buildingId: 'b1',
          buildingName: 'مرکزی',
          menuItemId: 'lunch-1',
          title: 'چلو جوجه',
        },
        {
          id: 'o1',
          mealType: MealType.LUNCH,
          buildingId: 'b1',
          buildingName: 'مرکزی',
          menuItemId: 'lunch-1',
          title: 'چلو جوجه',
        },
        {
          id: 'o2',
          mealType: MealType.DINNER,
          buildingId: 'b1',
          buildingName: 'مرکزی',
          menuItemId: 'dinner-1',
          title: 'چلو جوجه',
        },
        {
          id: 'o3',
          mealType: MealType.LUNCH,
          buildingId: 'b2',
          buildingName: 'شماره ۲',
          menuItemId: 'lunch-2',
          title: 'قیمه',
        },
      ],
      [
        {
          id: 'g1',
          mealType: MealType.LUNCH,
          buildingId: 'b2',
          buildingName: 'شماره ۲',
          menuItemId: 'lunch-1',
          title: 'چلو جوجه',
          quantity: 4,
        },
        {
          id: 'g1',
          mealType: MealType.LUNCH,
          buildingId: 'b2',
          buildingName: 'شماره ۲',
          menuItemId: 'lunch-1',
          title: 'چلو جوجه',
          quantity: 4,
        },
        {
          id: 'g0',
          mealType: MealType.LUNCH,
          buildingId: 'b2',
          buildingName: 'شماره ۲',
          menuItemId: 'lunch-1',
          title: 'چلو جوجه',
          quantity: 0,
        },
      ],
    );

    expect(result.foods).toHaveLength(3);
    expect(result.foods.find((item) => item.menuItemId === 'lunch-1')).toMatchObject({
      title: 'چلو جوجه',
      lunchCount: 5,
      dinnerCount: 0,
      staffCount: 1,
      guestCount: 4,
      total: 5,
    });
    expect(result.foods.find((item) => item.menuItemId === 'dinner-1')).toMatchObject({
      title: 'چلو جوجه',
      lunchCount: 0,
      dinnerCount: 1,
      staffCount: 1,
      guestCount: 0,
      total: 1,
    });
    expect(result.foods.find((item) => item.menuItemId === 'lunch-2')).toMatchObject({
      title: 'قیمه',
      lunchCount: 1,
      dinnerCount: 0,
      total: 1,
    });
    expect(result.foodsTotal.total).toBe(7);
    expect(result.supplyTotal.total).toBe(7);
    expect(result.reconciliation).toEqual({
      foodsTotal: 7,
      buildingsTotal: 7,
      difference: 0,
      matched: true,
    });
    expect(result.buildingTotals.map((item) => [item.buildingName, item.total])).toEqual([
      ['شماره ۲', 5],
      ['مرکزی', 2],
    ]);
  });

  it('keeps unmatched orders in totals without creating snapshot foods, and includes unassigned buildings', () => {
    const result = report(
      [
        {
          id: 'o1',
          mealType: MealType.LUNCH,
          buildingId: null,
          buildingName: null,
          menuItemId: 'x',
          title: 'آش',
        },
        {
          id: 'o2',
          mealType: MealType.LUNCH,
          buildingId: 'b1',
          buildingName: 'مرکزی',
          menuItemId: 'y',
          title: 'چلو جوجه',
        },
      ],
      [],
      {
        menuItems: [{ id: 'lunch-1', mealType: MealType.LUNCH, title: 'چلو جوجه' }],
      },
    );

    expect(result.foods).toEqual([]);
    expect(result.foodsTotal.total).toBe(2);
    expect(result.buildingRows).toEqual([]);
    expect(result.buildingTotals.some((row) => row.buildingId === null && row.total === 1)).toBe(true);
    expect(result.buildingTotals.some((row) => row.buildingName === 'مرکزی' && row.total === 1)).toBe(true);
    expect(result.reconciliation).toEqual({
      foodsTotal: 2,
      buildingsTotal: 2,
      difference: 0,
      matched: true,
    });
  });

  it('omits zero-order foods and applies the meal filter to every total', () => {
    const source = {
      staffOrders: [
        {
          id: 'o1',
          mealType: MealType.LUNCH,
          buildingId: 'b1',
          buildingName: 'مرکزی',
          menuItemId: 'lunch-1',
          title: 'چلو جوجه',
        },
        {
          id: 'o2',
          mealType: MealType.DINNER,
          buildingId: 'b1',
          buildingName: 'مرکزی',
          menuItemId: 'dinner-1',
          title: 'چلو جوجه',
        },
      ],
      guestOrders: [] as Parameters<typeof buildMonthlyReport>[0]['guestOrders'],
    };
    const lunchOnly = report(source.staffOrders, source.guestOrders, { meal: 'LUNCH' });
    expect(lunchOnly.foods).toHaveLength(1);
    expect(lunchOnly.foods[0]).toMatchObject({ lunchCount: 1, dinnerCount: 0, total: 1 });
    expect(lunchOnly.foodsTotal.dinnerCount).toBe(0);
    expect(lunchOnly.reconciliation.matched).toBe(true);

    const dinnerOnly = report(source.staffOrders, source.guestOrders, { meal: 'DINNER' });
    expect(dinnerOnly.foods[0]).toMatchObject({ lunchCount: 0, dinnerCount: 1, total: 1 });
    expect(dinnerOnly.buildingTotals[0]?.total).toBe(1);
  });

  it('attributes renamed foods by menu item id and does not invent a snapshot-only food', () => {
    const result = report(
      [
        {
          id: 'o1',
          mealType: MealType.LUNCH,
          buildingId: 'b1',
          buildingName: 'مرکزی',
          menuItemId: 'MENU_ITEM_123',
          title: 'چلو جوجه لاری',
        },
        {
          id: 'o2',
          mealType: MealType.LUNCH,
          buildingId: 'b1',
          buildingName: 'مرکزی',
          menuItemId: null,
          title: 'چلو جوجه زعفرانی',
        },
      ],
      [],
      {
        menuItems: [
          {
            id: 'MENU_ITEM_123',
            mealType: MealType.LUNCH,
            title: 'چلو جوجه زعفرانی',
          },
        ],
      },
    );
    expect(result.foods).toEqual([
      expect.objectContaining({
        menuItemId: 'MENU_ITEM_123',
        title: 'چلو جوجه زعفرانی',
        total: 1,
      }),
    ]);
    expect(result.foodsTotal.total).toBe(2);
    expect(result.buildingTotals[0]?.total).toBe(2);
    expect(result.reconciliation.matched).toBe(true);
  });
});
