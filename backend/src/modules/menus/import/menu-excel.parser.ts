import { MealType } from '@prisma/client';
import ExcelJS from 'exceljs';
import {
  datesInJalaliMonth,
  extractJalaliMonthFromText,
  formatJalali,
  gregorianToJalali,
  isJalaliFriday,
  jalaliToGregorian,
  normalizePersian,
  parseJalaliDate,
  utcDateFromGregorian,
  weekdayMatches,
} from '../../../common/calendar/jalali';
import type { ConfiguredMeal, MenuValidationIssue } from '../menu.types';
import { normalizeOptionTitle, optionTitleIssue } from '../menu.validation';

export const LUNCH_SHEET = 'ناهار';
export const DINNER_SHEET = 'شام';

const HEADERS = {
  row: 'ردیف',
  day: 'روز',
  date: 'تاریخ',
  option1: 'نوع اول',
  option2: 'نوع دوم',
  option3: 'نوع سوم',
} as const;

export type ParsedWorkbook = {
  jalaliYear: number;
  jalaliMonth: number;
  meals: ConfiguredMeal[];
  dates: string[];
  lunchMealCount: number;
  dinnerMealCount: number;
  optionCount: number;
  errors: MenuValidationIssue[];
  warnings: MenuValidationIssue[];
};

type SheetRow = {
  sheet: string;
  rowNumber: number;
  day: string;
  dateText: string;
  options: string[];
};

function cellText(value: ExcelJS.CellValue | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return normalizePersian(String(value));
  }
  if (value instanceof Date) {
    const jalali = gregorianToJalali(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
    );
    return jalali ? formatJalali(jalali) : '';
  }
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') {
      return normalizePersian(value.text);
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return normalizePersian(value.richText.map((part) => part.text).join(''));
    }
    if ('result' in value) {
      return cellText(value.result);
    }
  }
  return '';
}

function headerKey(value: string) {
  return normalizePersian(value).replace(/\s+/g, ' ');
}

function findHeaderRow(sheet: ExcelJS.Worksheet) {
  let title = '';
  for (
    let rowNumber = 1;
    rowNumber <= Math.min(sheet.rowCount, 15);
    rowNumber += 1
  ) {
    const row = sheet.getRow(rowNumber);
    const texts: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      texts.push(cellText(cell.value));
    });
    const joined = texts.join(' ');
    title ||= joined;
    const map = new Map<string, number>();
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const label = headerKey(cellText(cell.value));
      if (label) {
        map.set(label, col);
      }
    });
    if (map.has(HEADERS.date) && map.has(HEADERS.day)) {
      return { rowNumber, map, title: title || joined };
    }
  }
  return null;
}

function readSheetRows(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  requiredOptions: 2 | 3,
  errors: MenuValidationIssue[],
): { title: string; rows: SheetRow[] } {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    errors.push({
      sheet: sheetName,
      message: `برگه «${sheetName}» پیدا نشد.`,
    });
    return { title: '', rows: [] };
  }

  const header = findHeaderRow(sheet);
  if (!header) {
    errors.push({
      sheet: sheetName,
      message: 'ردیف عنوان ستون‌ها پیدا نشد.',
    });
    return { title: '', rows: [] };
  }

  const required: string[] = [
    HEADERS.day,
    HEADERS.date,
    HEADERS.option1,
    HEADERS.option2,
  ];
  if (requiredOptions === 3) {
    required.push(HEADERS.option3);
  }
  for (const name of required) {
    if (!header.map.has(name)) {
      errors.push({
        sheet: sheetName,
        row: header.rowNumber,
        field: name,
        message: `ستون «${name}» پیدا نشد.`,
      });
    }
  }

  const rows: SheetRow[] = [];
  for (
    let rowNumber = header.rowNumber + 1;
    rowNumber <= sheet.rowCount;
    rowNumber += 1
  ) {
    const row = sheet.getRow(rowNumber);
    const read = (name: string) => {
      const col = header.map.get(name);
      if (!col) {
        return '';
      }
      return cellText(row.getCell(col).value);
    };
    const options = [
      read(HEADERS.option1),
      read(HEADERS.option2),
      requiredOptions === 3 || header.map.has(HEADERS.option3)
        ? read(HEADERS.option3)
        : '',
    ];
    const day = read(HEADERS.day);
    const dateText = read(HEADERS.date);
    const index = read(HEADERS.row);
    if (!index && !day && !dateText && options.every((item) => !item)) {
      continue;
    }
    rows.push({
      sheet: sheetName,
      rowNumber,
      day,
      dateText,
      options: options.map((item) => normalizeOptionTitle(item)),
    });
  }

  return { title: header.title, rows };
}

function mealFromRow(
  row: SheetRow,
  mealType: MealType,
  expectedYear: number,
  expectedMonth: number,
  errors: MenuValidationIssue[],
  warnings: MenuValidationIssue[],
): ConfiguredMeal | null {
  if (!row.dateText) {
    if (row.day || row.options.some((item) => item)) {
      errors.push({
        sheet: row.sheet,
        row: row.rowNumber,
        field: 'تاریخ',
        message: 'ردیف ناقص است و تاریخ ندارد.',
      });
    }
    return null;
  }

  const jalali = parseJalaliDate(row.dateText);
  if (!jalali) {
    errors.push({
      sheet: row.sheet,
      row: row.rowNumber,
      field: 'تاریخ',
      message: `تاریخ جلالی نامعتبر است: ${row.dateText}`,
    });
    return null;
  }
  if (jalali.year !== expectedYear || jalali.month !== expectedMonth) {
    errors.push({
      sheet: row.sheet,
      row: row.rowNumber,
      field: 'تاریخ',
      message: `تاریخ ${formatJalali(jalali)} داخل ماه هدف نیست.`,
    });
    return null;
  }

  const gregorian = jalaliToGregorian(jalali.year, jalali.month, jalali.day);
  if (!gregorian) {
    errors.push({
      sheet: row.sheet,
      row: row.rowNumber,
      field: 'تاریخ',
      message: `تاریخ ${formatJalali(jalali)} قابل تبدیل نیست.`,
    });
    return null;
  }
  const utc = utcDateFromGregorian(gregorian);
  if (row.day && !weekdayMatches(row.day, utc)) {
    errors.push({
      sheet: row.sheet,
      row: row.rowNumber,
      field: 'روز',
      message: `روز «${row.day}» با تاریخ ${formatJalali(jalali)} هم‌خوان نیست.`,
    });
  }

  const filled = row.options.filter((item) => item);
  if (filled.length === 0) {
    if (!isJalaliFriday(utc)) {
      warnings.push({
        sheet: row.sheet,
        row: row.rowNumber,
        message: `وعده خالی در روز غیرجمعه (${formatJalali(jalali)}) نادیده گرفته شد.`,
      });
    }
    return null;
  }

  if (mealType === MealType.LUNCH && filled.length < 3) {
    warnings.push({
      sheet: row.sheet,
      row: row.rowNumber,
      field: 'گزینه',
      message: 'ناهار این ردیف کمتر از سه گزینه دارد.',
    });
  }

  if (mealType === MealType.DINNER && filled.length < 1) {
    errors.push({
      sheet: row.sheet,
      row: row.rowNumber,
      message: 'شام پیکربندی‌شده باید حداقل یک گزینه داشته باشد.',
    });
    return null;
  }

  if (row.options[0] && row.options[2] && !row.options[1]) {
    errors.push({
      sheet: row.sheet,
      row: row.rowNumber,
      message: 'ترتیب گزینه‌ها ناقص است.',
    });
    return null;
  }

  const options = filled.map((title, index) => {
    const titleError = optionTitleIssue(title);
    if (titleError) {
      errors.push({
        sheet: row.sheet,
        row: row.rowNumber,
        field: 'عنوان',
        message: titleError,
      });
    }
    return { title, displayOrder: index + 1 };
  });

  return {
    mealDate: utc,
    mealType,
    options,
  };
}

export class MenuExcelParser {
  async parse(buffer: Buffer): Promise<ParsedWorkbook> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      return {
        jalaliYear: 0,
        jalaliMonth: 0,
        meals: [],
        dates: [],
        lunchMealCount: 0,
        dinnerMealCount: 0,
        optionCount: 0,
        errors: [{ message: 'فایل اکسل قابل خواندن نیست.' }],
        warnings: [],
      };
    }

    const names = workbook.worksheets.map((sheet) => sheet.name);
    const errors: MenuValidationIssue[] = [];
    const warnings: MenuValidationIssue[] = [];
    if (!names.includes(LUNCH_SHEET)) {
      errors.push({ message: `برگه «${LUNCH_SHEET}» پیدا نشد.` });
    }
    if (!names.includes(DINNER_SHEET)) {
      errors.push({ message: `برگه «${DINNER_SHEET}» پیدا نشد.` });
    }
    for (const name of names) {
      if (name !== LUNCH_SHEET && name !== DINNER_SHEET) {
        warnings.push({
          sheet: name,
          message: `برگه اضافی «${name}» نادیده گرفته شد.`,
        });
      }
    }

    const lunch = readSheetRows(workbook, LUNCH_SHEET, 3, errors);
    const dinner = readSheetRows(workbook, DINNER_SHEET, 2, errors);
    const titleMonth =
      extractJalaliMonthFromText(lunch.title) ??
      extractJalaliMonthFromText(dinner.title);

    const sampleDate =
      parseJalaliDate(
        lunch.rows.find((row) => row.dateText)?.dateText ??
          dinner.rows.find((row) => row.dateText)?.dateText ??
          '',
      ) ?? titleMonth;

    if (!sampleDate) {
      errors.push({ message: 'ماه و سال جلالی از فایل قابل تشخیص نیست.' });
      return {
        jalaliYear: 0,
        jalaliMonth: 0,
        meals: [],
        dates: [],
        lunchMealCount: 0,
        dinnerMealCount: 0,
        optionCount: 0,
        errors,
        warnings,
      };
    }

    const jalaliYear = titleMonth?.year ?? sampleDate.year;
    const jalaliMonth = titleMonth?.month ?? sampleDate.month;
    if (
      titleMonth &&
      (titleMonth.year !== sampleDate.year ||
        titleMonth.month !== sampleDate.month) &&
      sampleDate.year
    ) {
      const fromDates = parseJalaliDate(
        lunch.rows.find((row) => row.dateText)?.dateText ?? '',
      );
      if (
        fromDates &&
        (fromDates.year !== titleMonth.year ||
          fromDates.month !== titleMonth.month)
      ) {
        errors.push({
          message: 'ماه عنوان فایل با تاریخ ردیف‌ها یکسان نیست.',
        });
      }
    }

    const lunchMeals: ConfiguredMeal[] = [];
    const dinnerMeals: ConfiguredMeal[] = [];
    const lunchDates = new Set<string>();
    const dinnerDates = new Set<string>();

    for (const row of lunch.rows) {
      if (row.dateText) {
        const parsed = parseJalaliDate(row.dateText);
        if (parsed) {
          const key = formatJalali(parsed);
          if (lunchDates.has(key)) {
            errors.push({
              sheet: row.sheet,
              row: row.rowNumber,
              message: `تاریخ تکراری: ${key}`,
            });
          }
          lunchDates.add(key);
        }
      }
      const meal = mealFromRow(
        row,
        MealType.LUNCH,
        jalaliYear,
        jalaliMonth,
        errors,
        warnings,
      );
      if (meal) {
        lunchMeals.push(meal);
      }
    }

    for (const row of dinner.rows) {
      if (row.dateText) {
        const parsed = parseJalaliDate(row.dateText);
        if (parsed) {
          const key = formatJalali(parsed);
          if (dinnerDates.has(key)) {
            errors.push({
              sheet: row.sheet,
              row: row.rowNumber,
              message: `تاریخ تکراری: ${key}`,
            });
          }
          dinnerDates.add(key);
        }
      }
      const meal = mealFromRow(
        row,
        MealType.DINNER,
        jalaliYear,
        jalaliMonth,
        errors,
        warnings,
      );
      if (meal) {
        dinnerMeals.push(meal);
      }
    }

    const expected = datesInJalaliMonth(jalaliYear, jalaliMonth).map((item) =>
      formatJalali(item.jalali),
    );
    for (const date of expected) {
      if (!lunchDates.has(date) || !dinnerDates.has(date)) {
        errors.push({
          message: `پوشش کامل ماه برقرار نیست؛ تاریخ ${date} در هر دو برگه نیست.`,
        });
      }
    }
    for (const date of lunchDates) {
      if (!dinnerDates.has(date)) {
        errors.push({
          message: `مجموعه تاریخ ناهار و شام یکسان نیست (${date}).`,
        });
      }
    }
    for (const date of dinnerDates) {
      if (!lunchDates.has(date)) {
        errors.push({
          message: `مجموعه تاریخ ناهار و شام یکسان نیست (${date}).`,
        });
      }
    }

    const meals = [...lunchMeals, ...dinnerMeals];
    return {
      jalaliYear,
      jalaliMonth,
      meals,
      dates: expected,
      lunchMealCount: lunchMeals.length,
      dinnerMealCount: dinnerMeals.length,
      optionCount: meals.reduce((sum, meal) => sum + meal.options.length, 0),
      errors,
      warnings,
    };
  }
}
