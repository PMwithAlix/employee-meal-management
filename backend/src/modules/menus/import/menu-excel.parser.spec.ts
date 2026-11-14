import { MealType } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MenuExcelParser } from './menu-excel.parser';
import { buildMenuWorkbook } from './menu-workbook.builder';

const parser = new MenuExcelParser();

describe('MenuExcelParser', () => {
  it('parses a valid generated workbook including empty Fridays', async () => {
    const buffer = await buildMenuWorkbook();
    const parsed = await parser.parse(buffer);
    expect(parsed.errors).toEqual([]);
    expect(parsed.jalaliYear).toBe(1405);
    expect(parsed.jalaliMonth).toBe(6);
    expect(parsed.dates).toHaveLength(31);
    expect(parsed.lunchMealCount).toBeGreaterThan(0);
    expect(
      parsed.meals.some(
        (meal) =>
          meal.mealType === MealType.DINNER && meal.options.length === 2,
      ),
    ).toBe(true);
  });

  it('parses the reference Shahrivar workbook when present', () => {
    const path = join(
      __dirname,
      '..',
      '..',
      '..',
      'test',
      'fixtures',
      'shahrivar-1405.xlsx',
    );
    let buffer: Buffer;
    try {
      buffer = readFileSync(path);
    } catch {
      return;
    }
    return parser.parse(buffer).then((parsed) => {
      expect(parsed.errors).toEqual([]);
      expect(parsed.jalaliYear).toBe(1405);
      expect(parsed.jalaliMonth).toBe(6);
      expect(parsed.dates).toHaveLength(31);
    });
  });

  it('rejects a missing worksheet', async () => {
    const buffer = await buildMenuWorkbook({ dinnerName: 'شب' });
    const parsed = await parser.parse(buffer);
    expect(parsed.errors.some((error) => error.message.includes('شام'))).toBe(
      true,
    );
  });

  it('rejects a missing lunch option header', async () => {
    const buffer = await buildMenuWorkbook({
      includeLunchOption3Header: false,
    });
    const parsed = await parser.parse(buffer);
    expect(
      parsed.errors.some((error) => error.message.includes('نوع سوم')),
    ).toBe(true);
  });

  it('rejects duplicate dates', async () => {
    const buffer = await buildMenuWorkbook({
      duplicateLunchDate: '1405/06/01',
    });
    const parsed = await parser.parse(buffer);
    expect(
      parsed.errors.some((error) => error.message.includes('تکراری')),
    ).toBe(true);
  });

  it('rejects an invalid Jalali date', async () => {
    const buffer = await buildMenuWorkbook({ invalidDate: '1405/06/01' });
    const parsed = await parser.parse(buffer);
    expect(
      parsed.errors.some((error) => error.message.includes('نامعتبر')),
    ).toBe(true);
  });

  it('rejects inconsistent day/date pairs', async () => {
    const buffer = await buildMenuWorkbook({ inconsistentDay: '1405/06/01' });
    const parsed = await parser.parse(buffer);
    expect(
      parsed.errors.some((error) => error.message.includes('هم‌خوان')),
    ).toBe(true);
  });

  it('rejects an incomplete row without a date', async () => {
    const buffer = await buildMenuWorkbook({ incompleteWithoutDate: true });
    const parsed = await parser.parse(buffer);
    expect(
      parsed.errors.some((error) => error.message.includes('تاریخ ندارد')),
    ).toBe(true);
  });

  it('warns when a configured lunch is missing option 3', async () => {
    const buffer = await buildMenuWorkbook({ omitLunchOption3: '1405/06/02' });
    const parsed = await parser.parse(buffer);
    expect(parsed.errors).toEqual([]);
    expect(
      parsed.warnings.some((warning) => warning.message.includes('کمتر از سه')),
    ).toBe(true);
  });

  it('rejects when a date is missing from a sheet', async () => {
    const buffer = await buildMenuWorkbook({ dropDate: '1405/06/10' });
    const parsed = await parser.parse(buffer);
    expect(
      parsed.errors.some((error) => error.message.includes('پوشش کامل')),
    ).toBe(true);
  });
});
