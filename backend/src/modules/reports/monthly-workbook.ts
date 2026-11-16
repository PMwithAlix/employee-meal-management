import ExcelJS from 'exceljs';
import type { MonthlyReport } from './monthly-report';

function addHeader(sheet: ExcelJS.Worksheet, values: Array<string | number>) {
  const row = sheet.addRow(values);
  row.font = { bold: true };
}

export async function buildMonthlyWorkbook(report: MonthlyReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'khaan';
  const foods = workbook.addWorksheet('غذاها');
  const buildings = workbook.addWorksheet('ساختمان‌ها');
  const supply = workbook.addWorksheet('تأمین');

  foods.addRow(['گزارش ماهانه غذاها']);
  foods.addRow(['ماه', report.monthLabel]);
  foods.addRow(['وعده', report.mealLabel]);
  foods.addRow(['زمان تهیه', report.generatedAt]);
  foods.addRow([]);
  addHeader(foods, [
    'نام غذا',
    'تعداد ناهار',
    'تعداد شام',
    'مجموع',
    'سفارش کاربران',
    'سفارش مهمان‌ها',
    'وضعیت منو',
  ]);
  for (const food of report.foods) {
    foods.addRow([
      food.title,
      food.lunchCount,
      food.dinnerCount,
      food.total,
      food.staffCount,
      food.guestCount,
      food.onMenu ? 'منوی جاری' : 'خارج از منوی جاری',
    ]);
  }
  addHeader(foods, [
    'مجموع',
    report.foodsTotal.lunchCount,
    report.foodsTotal.dinnerCount,
    report.foodsTotal.total,
    report.foodsTotal.staffCount,
    report.foodsTotal.guestCount,
    '',
  ]);

  buildings.addRow(['گزارش ماهانه به تفکیک ساختمان']);
  buildings.addRow(['ماه', report.monthLabel]);
  buildings.addRow(['وعده', report.mealLabel]);
  buildings.addRow([]);
  addHeader(buildings, [
    'ساختمان',
    'نوع غذا',
    'تعداد ناهار',
    'تعداد شام',
    'مجموع',
    'سفارش کاربران',
    'سفارش مهمان‌ها',
  ]);
  for (const row of report.buildingRows) {
    buildings.addRow([
      row.buildingName,
      row.title,
      row.lunchCount,
      row.dinnerCount,
      row.total,
      row.staffCount,
      row.guestCount,
    ]);
  }
  buildings.addRow([]);
  addHeader(buildings, ['ساختمان', 'مجموع ناهار', 'مجموع شام', 'کل موردنیاز']);
  for (const total of report.buildingTotals) {
    buildings.addRow([
      total.buildingName,
      total.lunchCount,
      total.dinnerCount,
      total.total,
    ]);
  }

  supply.addRow(['جمع‌بندی تأمین غذا']);
  supply.addRow(['ماه', report.monthLabel]);
  supply.addRow(['وعده', report.mealLabel]);
  supply.addRow([
    'تطابق مجموع ساختمان‌ها با گزارش کلی',
    report.reconciliation.matched ? 'مطابق' : 'اختلاف',
    report.reconciliation.difference,
  ]);
  supply.addRow([]);
  addHeader(supply, ['نوع غذا', 'مجموع ناهار', 'مجموع شام', 'کل موردنیاز']);
  for (const food of report.supply) {
    supply.addRow([
      food.title,
      food.lunchCount,
      food.dinnerCount,
      food.total,
    ]);
  }
  addHeader(supply, [
    'مجموع',
    report.supplyTotal.lunchCount,
    report.supplyTotal.dinnerCount,
    report.supplyTotal.total,
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function monthlyWorkbookFilename(report: MonthlyReport) {
  return `monthly-report-${report.year}-${String(report.month).padStart(2, '0')}-${report.meal}.xlsx`;
}
