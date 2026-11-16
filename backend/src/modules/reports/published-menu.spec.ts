import { MenuVersionStatus, MealType } from '@prisma/client';
import { buildDailyReport } from './daily-report';
import { itemsFromPublishedMenu } from './published-menu';

const published = {
  id: 'pub-1',
  status: MenuVersionStatus.PUBLISHED,
  items: [
    { id: 'lunch-1', mealType: MealType.LUNCH, title: 'جوجه', displayOrder: 1 },
  ],
};

const draft = {
  id: 'draft-2',
  status: MenuVersionStatus.DRAFT,
  items: [
    { id: 'lunch-draft', mealType: MealType.LUNCH, title: 'غذای پیش‌نویس', displayOrder: 1 },
  ],
};

describe('itemsFromPublishedMenu', () => {
  it('uses the published version even when a newer draft exists', () => {
    expect(
      itemsFromPublishedMenu({
        publishedVersionId: published.id,
        publishedVersion: published,
      }),
    ).toEqual(published.items);
    expect(
      itemsFromPublishedMenu({
        publishedVersionId: published.id,
        publishedVersion: { ...published, items: published.items },
      }).map((item) => item.title),
    ).toEqual(['جوجه']);
  });

  it('does not fall back to a draft when nothing is published', () => {
    expect(
      itemsFromPublishedMenu({
        publishedVersionId: null,
        publishedVersion: null,
      }),
    ).toEqual([]);
    expect(
      itemsFromPublishedMenu({
        publishedVersionId: draft.id,
        publishedVersion: draft,
      }),
    ).toEqual([]);
  });

  it('ignores a mismatched publishedVersionId so another version cannot be chosen at random', () => {
    expect(
      itemsFromPublishedMenu({
        publishedVersionId: 'pub-1',
        publishedVersion: draft,
      }),
    ).toEqual([]);
  });
});

describe('published menu with extra ordered foods', () => {
  it('keeps ordered foods that are missing from the published version as off-menu rows', () => {
    const report = buildDailyReport({
      mealDate: '2026-11-16',
      jalaliDate: '1405/08/25',
      generatedAt: '2026-11-16T12:00:00.000Z',
      menuItems: itemsFromPublishedMenu({
        publishedVersionId: published.id,
        publishedVersion: published,
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
    expect(report.lunch.foods.map((item) => item.title)).toEqual(['قیمه']);
    expect(report.lunch.foods.find((item) => item.title === 'قیمه')?.onMenu).toBe(false);
    expect(report.lunch.total).toBe(1);
  });
});
