import { MealType } from '@prisma/client';
import { jalaliToGregorian, utcDateFromGregorian } from '../dates/jalali';
import { validateConfiguredMeals } from './menu.validation';

const day = (jalaliDay: number) =>
  utcDateFromGregorian(jalaliToGregorian(1405, 6, jalaliDay)!);

describe('validateConfiguredMeals', () => {
  it('accepts independent lunch and dinner on the same date', () => {
    const issues = validateConfiguredMeals(
      [
        {
          mealDate: day(1),
          mealType: MealType.LUNCH,
          options: [
            { title: 'کباب', displayOrder: 1 },
            { title: 'قورمه', displayOrder: 2 },
            { title: 'ماکارونی', displayOrder: 3 },
          ],
        },
        {
          mealDate: day(1),
          mealType: MealType.DINNER,
          options: [{ title: 'سوپ', displayOrder: 1 }],
        },
      ],
      1405,
      6,
    );
    expect(issues).toEqual([]);
  });

  it('rejects dates outside the menu month, zero options, and duplicate orders', () => {
    const outside = utcDateFromGregorian(jalaliToGregorian(1405, 7, 1)!);
    const issues = validateConfiguredMeals(
      [
        {
          mealDate: outside,
          mealType: MealType.LUNCH,
          options: [{ title: 'خارج', displayOrder: 1 }],
        },
        {
          mealDate: day(2),
          mealType: MealType.LUNCH,
          options: [],
        },
        {
          mealDate: day(3),
          mealType: MealType.DINNER,
          options: [
            { title: 'الف', displayOrder: 1 },
            { title: 'ب', displayOrder: 1 },
          ],
        },
      ],
      1405,
      6,
    );
    expect(issues.some((issue) => issue.message.includes('ماه'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('۱ تا ۳'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('تکراری'))).toBe(true);
  });
});
