import { MealType, Role } from '@prisma/client';
import {
  describeBlockingEmployeeOrder,
  describeBlockingGuestOrder,
  menuItemRemovalBlocked,
} from './menu-item-removal';

describe('menu item removal copy', () => {
  it('names the HR user and points staff to the all-roles order tab', () => {
    const sample = describeBlockingEmployeeOrder({
      username: 'hr.one',
      role: Role.HR,
      mealDate: new Date(Date.UTC(2026, 10, 16)),
      mealType: MealType.LUNCH,
    });
    expect(sample).toContain('منابع انسانی');
    expect(sample).toContain('hr.one');
    expect(sample).toContain('ناهار');

    const blocked = menuItemRemovalBlocked([sample]);
    expect(blocked.message).toContain('سفارش فعال');
    expect(blocked.message).toContain('منابع انسانی');
    expect(blocked.message).toContain('سفارش کارکنان');
    expect(blocked.errors).toEqual([sample]);
  });

  it('describes a guest order separately', () => {
    expect(
      describeBlockingGuestOrder({
        buildingName: 'برج یک',
        mealDate: new Date(Date.UTC(2026, 10, 16)),
        mealType: MealType.DINNER,
      }),
    ).toContain('سفارش مهمان');
  });
});
