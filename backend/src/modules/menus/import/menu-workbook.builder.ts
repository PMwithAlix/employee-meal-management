import ExcelJS from 'exceljs';
import {
  datesInJalaliMonth,
  formatJalali,
  JALALI_MONTHS,
  jalaliWeekdayName,
} from '../../../common/calendar/jalali';

export type WorkbookBuilderOptions = {
  year?: number;
  month?: number;
  lunchName?: string;
  dinnerName?: string;
  includeLunchOption3Header?: boolean;
  includeDinnerOption3Header?: boolean;
  skipFridayMeals?: boolean;
  emptyNonFriday?: string;
  omitLunchOption3?: string;
  duplicateLunchDate?: string;
  invalidDate?: string;
  inconsistentDay?: string;
  incompleteWithoutDate?: boolean;
  dropDate?: string;
  lunchTitle?: string;
};

export async function buildMenuWorkbook(
  options: WorkbookBuilderOptions = {},
): Promise<Buffer> {
  const year = options.year ?? 1405;
  const month = options.month ?? 6;
  const days = datesInJalaliMonth(year, month);
  const workbook = new ExcelJS.Workbook();
  const lunch = workbook.addWorksheet(options.lunchName ?? 'ناهار');
  const dinner = workbook.addWorksheet(options.dinnerName ?? 'شام');
  const monthName = JALALI_MONTHS[month - 1];
  const title =
    options.lunchTitle ?? `منو ناهار رستوران  (${monthName} ${year})`;
  writeTitle(lunch, title, 6);
  writeTitle(dinner, `منو شام رستوران  (${monthName} ${year})`, 5);

  const lunchHeaders = ['ردیف', 'روز', 'تاریخ', 'نوع اول', 'نوع دوم '];
  if (options.includeLunchOption3Header !== false) {
    lunchHeaders.push('نوع سوم');
  }
  lunch.addRow(lunchHeaders);
  const dinnerHeaders = ['ردیف', 'روز', 'تاریخ', 'نوع اول', 'نوع دوم '];
  if (options.includeDinnerOption3Header) {
    dinnerHeaders.push('نوع سوم');
  }
  dinner.addRow(dinnerHeaders);

  days.forEach((day, index) => {
    const jalali = formatJalali(day.jalali);
    const weekday = jalaliWeekdayName(day.utc);
    const friday = weekday === 'جمعه';
    const skipMeals =
      (options.skipFridayMeals !== false && friday) ||
      jalali === options.emptyNonFriday;
    const lunchRow = [
      index + 1,
      jalali === options.inconsistentDay ? 'شنبه' : weekday,
      options.invalidDate === jalali
        ? '1405/99/01'
        : jalali === options.dropDate
          ? ''
          : jalali,
      skipMeals ? '' : `چلو ${index + 1}`,
      skipMeals ? '' : `خورش ${index + 1}`,
      skipMeals || jalali === options.omitLunchOption3
        ? ''
        : `گزینه ${index + 1}`,
    ];
    if (options.includeLunchOption3Header === false) {
      lunchRow.pop();
    }
    lunch.addRow(lunchRow);
    dinner.addRow([
      index + 1,
      weekday,
      jalali,
      skipMeals ? '' : `شام ${index + 1}`,
      skipMeals ? '' : `ساندویچ ${index + 1}`,
    ]);
    if (options.duplicateLunchDate === jalali) {
      lunch.addRow([99, weekday, jalali, 'تکراری ۱', 'تکراری ۲', 'تکراری ۳']);
    }
  });

  if (options.incompleteWithoutDate) {
    lunch.addRow(['', '', '', 'غذا بدون تاریخ', 'دوم', 'سوم']);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function writeTitle(sheet: ExcelJS.Worksheet, title: string, cols: number) {
  for (let row = 1; row <= 3; row += 1) {
    const values = Array.from({ length: cols }, () => title);
    sheet.addRow(values);
  }
}
