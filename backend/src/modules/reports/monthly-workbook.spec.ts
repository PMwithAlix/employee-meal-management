import { MealType } from '@prisma/client';
import ExcelJS from 'exceljs';
import { buildMonthlyReport } from './monthly-report';
import { buildMonthlyWorkbook } from './monthly-workbook';

describe('buildMonthlyWorkbook', () => {
  it('writes month, meal, food totals, and matching building totals', async () => {
    const report = buildMonthlyReport({
      year: 1405,
      month: 9,
      monthLabel: 'آذر ۱۴۰۵',
      generatedAt: '2026-11-16T12:00:00.000Z',
      meal: 'ALL',
      menuItems: [
        { id: '1', mealType: MealType.LUNCH, title: 'قیمه' },
        { id: '2', mealType: MealType.DINNER, title: 'قیمه' },
      ],
      staffOrders: [
        {
          id: 'o1',
          mealType: MealType.LUNCH,
          buildingId: 'b1',
          buildingName: 'مرکزی',
          menuItemId: '1',
          title: 'قیمه قدیمی',
        },
      ],
      guestOrders: [
        {
          id: 'g1',
          mealType: MealType.DINNER,
          buildingId: 'b1',
          buildingName: 'مرکزی',
          menuItemId: '2',
          title: 'قیمه قدیمی',
          quantity: 2,
        },
      ],
    });
    const buffer = await buildMonthlyWorkbook(report);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const foods = workbook.getWorksheet('غذاها');
    const buildings = workbook.getWorksheet('ساختمان‌ها');
    const supply = workbook.getWorksheet('تأمین');
    expect(foods?.getRow(2).getCell(2).value).toBe('آذر ۱۴۰۵');
    expect(foods?.getRow(3).getCell(2).value).toBe('هر دو وعده');
    expect(foods?.getRow(6).getCell(1).value).toBe('نام غذا');
    expect(foods?.getRow(6).getCell(7).value).not.toBe('وضعیت منو');
    expect(foods?.getRow(7).getCell(1).value).toBe('قیمه');
    expect(foods?.getRow(7).getCell(4).value).toBe(1);
    expect(foods?.getRow(8).getCell(1).value).toBe('قیمه');
    expect(foods?.getRow(8).getCell(4).value).toBe(2);
    expect(foods?.getRow(9).getCell(4).value).toBe(3);
    expect(JSON.stringify(foods?.getRow(7).values)).not.toContain('خارج از منوی جاری');
    expect(buildings?.getRow(6).getCell(5).value).toBe(1);
    expect(buildings?.getRow(7).getCell(5).value).toBe(2);
    expect(supply?.getRow(7).getCell(4).value).toBe(1);
    expect(supply?.getRow(8).getCell(4).value).toBe(2);
    expect(supply?.getRow(9).getCell(4).value).toBe(3);
    expect(supply?.getRow(3).getCell(2).value).toBe('هر دو وعده');
  });
});
