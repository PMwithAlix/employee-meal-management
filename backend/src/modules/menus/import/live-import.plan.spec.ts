import { utcDateFromGregorian } from '../../../common/calendar/jalali';
import { planLiveImport } from './live-import.plan';

const day = utcDateFromGregorian({ year: 2026, month: 11, day: 22 });

describe('planLiveImport', () => {
  it('keeps the same item id when only the title changes', () => {
    const plan = planLiveImport(
      [
        {
          id: 'MENU_ITEM_123',
          mealDate: day,
          mealType: 'LUNCH',
          title: 'چلو جوجه لاری',
          displayOrder: 1,
        },
      ],
      [
        {
          mealDate: day,
          mealType: 'LUNCH',
          title: 'چلو جوجه زعفرانی',
          displayOrder: 1,
        },
      ],
    );

    expect(plan.updates).toEqual([
      {
        id: 'MENU_ITEM_123',
        mealDate: day,
        mealType: 'LUNCH',
        title: 'چلو جوجه زعفرانی',
        displayOrder: 1,
      },
    ]);
    expect(plan.creates).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });

  it('does not merge two independent items that share a title', () => {
    const plan = planLiveImport(
      [
        {
          id: 'a',
          mealDate: day,
          mealType: 'LUNCH',
          title: 'چلو جوجه',
          displayOrder: 1,
        },
        {
          id: 'b',
          mealDate: day,
          mealType: 'LUNCH',
          title: 'چلو جوجه',
          displayOrder: 2,
        },
      ],
      [
        {
          mealDate: day,
          mealType: 'LUNCH',
          title: 'چلو جوجه',
          displayOrder: 1,
        },
        {
          mealDate: day,
          mealType: 'LUNCH',
          title: 'چلو جوجه',
          displayOrder: 2,
        },
      ],
    );

    expect(plan.updates.map((item) => item.id).sort()).toEqual(['a', 'b']);
    expect(plan.creates).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });

  it('keeps the slot id when excel replaces the title in the same order', () => {
    const plan = planLiveImport(
      [
        {
          id: 'keep',
          mealDate: day,
          mealType: 'LUNCH',
          title: 'عدسی',
          displayOrder: 1,
        },
        {
          id: 'slot-2',
          mealDate: day,
          mealType: 'LUNCH',
          title: 'قیمه',
          displayOrder: 2,
        },
      ],
      [
        {
          mealDate: day,
          mealType: 'LUNCH',
          title: 'عدسی',
          displayOrder: 1,
        },
        {
          mealDate: day,
          mealType: 'LUNCH',
          title: 'کوکو',
          displayOrder: 2,
        },
      ],
    );

    expect(plan.updates.map((item) => item.id).sort()).toEqual(['keep', 'slot-2']);
    expect(plan.updates.find((item) => item.id === 'slot-2')?.title).toBe('کوکو');
    expect(plan.creates).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });

  it('creates new items and deletes removed slots', () => {
    const plan = planLiveImport(
      [
        {
          id: 'keep',
          mealDate: day,
          mealType: 'LUNCH',
          title: 'عدسی',
          displayOrder: 1,
        },
        {
          id: 'gone',
          mealDate: day,
          mealType: 'LUNCH',
          title: 'قیمه',
          displayOrder: 2,
        },
      ],
      [
        {
          mealDate: day,
          mealType: 'LUNCH',
          title: 'عدسی',
          displayOrder: 1,
        },
      ],
    );

    expect(plan.updates.map((item) => item.id)).toEqual(['keep']);
    expect(plan.creates).toEqual([]);
    expect(plan.deletes).toEqual(['gone']);
  });
});
