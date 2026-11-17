import { MealType } from '@prisma/client';
import { buildDailyReport } from './daily-report';
import { itemsFromCurrentMenu } from './published-menu';

const live = {
  id: 'live-1',
  items: [
    { id: 'lunch-1', mealType: MealType.LUNCH, title: 'جوجه', displayOrder: 1 },
  ],
};

describe('itemsFromCurrentMenu', () => {
  it('uses the latest stored version even when it was never announced', () => {
    expect(
      itemsFromCurrentMenu({
        versions: [live],
      }),
    ).toEqual(live.items);
  });

  it('returns an empty list when the month has no live version yet', () => {
    expect(itemsFromCurrentMenu(null)).toEqual([]);
    expect(itemsFromCurrentMenu({ versions: [] })).toEqual([]);
  });
});

describe('current menu with extra ordered foods', () => {
  it('does not invent a snapshot food when the order is missing from the live menu', () => {
    const report = buildDailyReport({
      mealDate: '2026-11-16',
      jalaliDate: '1405/08/25',
      generatedAt: '2026-11-16T12:00:00.000Z',
      menuItems: itemsFromCurrentMenu({
        versions: [live],
      }),
      staffOrders: [
        {
          id: 'o1',
          userId: 'u1',
          mealType: MealType.LUNCH,
          username: 'کاربر',
          buildingId: 'b1',
          buildingName: 'دهقان',
          menuItemId: null,
          title: 'قیمه',
        },
      ],
      guestOrders: [],
    });
    expect(report.lunch.foods.map((item) => item.title)).toEqual([]);
    expect(report.lunch.staffTotal).toBe(1);
    expect(report.lunch.total).toBe(1);
  });
});
