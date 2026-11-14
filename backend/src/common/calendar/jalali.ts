import jalaali from 'jalaali-js';

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

const WEEKDAYS = [
  'یکشنبه',
  'دوشنبه',
  'سهشنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
  'شنبه',
] as const;

const PERSIAN_DIGITS: Record<string, string> = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

export function toLatinDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => PERSIAN_DIGITS[digit] ?? digit);
}

export function normalizePersian(value: string) {
  return toLatinDigits(value)
    .replace(/\u200c/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function compactPersian(value: string) {
  return normalizePersian(value).replace(/\s+/g, '');
}

export type GregorianYmd = { year: number; month: number; day: number };
export type JalaliYmd = { year: number; month: number; day: number };

export function isValidJalaliMonth(year: number, month: number) {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    year >= 1 &&
    month >= 1 &&
    month <= 12
  );
}

export function jalaliMonthLength(year: number, month: number) {
  if (!isValidJalaliMonth(year, month)) {
    return 0;
  }
  return jalaali.jalaaliMonthLength(year, month);
}

export function isLeapJalaliYear(year: number) {
  return jalaali.isLeapJalaaliYear(year);
}

export function jalaliToGregorian(
  year: number,
  month: number,
  day: number,
): GregorianYmd | null {
  if (!jalaali.isValidJalaaliDate(year, month, day)) {
    return null;
  }
  const converted = jalaali.toGregorian(year, month, day);
  return { year: converted.gy, month: converted.gm, day: converted.gd };
}

export function gregorianToJalali(
  year: number,
  month: number,
  day: number,
): JalaliYmd | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const converted = jalaali.toJalaali(year, month, day);
  if (!jalaali.isValidJalaaliDate(converted.jy, converted.jm, converted.jd)) {
    return null;
  }
  return { year: converted.jy, month: converted.jm, day: converted.jd };
}

export function utcDateFromGregorian(parts: GregorianYmd) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function gregorianFromUtcDate(value: Date): GregorianYmd {
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

export function formatDateOnly(value: Date) {
  const parts = gregorianFromUtcDate(value);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function formatJalali(parts: JalaliYmd) {
  return `${parts.year}/${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}`;
}

export function jalaliFromUtcDate(value: Date): JalaliYmd | null {
  const g = gregorianFromUtcDate(value);
  return gregorianToJalali(g.year, g.month, g.day);
}

export function parseJalaliDate(value: string): JalaliYmd | null {
  const normalized = normalizePersian(value).replace(/-/g, '/');
  const match = /^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!jalaali.isValidJalaaliDate(year, month, day)) {
    return null;
  }
  return { year, month, day };
}

export function weekdayIndexUtc(value: Date) {
  return value.getUTCDay();
}

export function jalaliWeekdayName(value: Date) {
  return WEEKDAYS[weekdayIndexUtc(value)];
}

export function weekdayMatches(label: string, value: Date) {
  return compactPersian(label) === jalaliWeekdayName(value);
}

export function isJalaliFriday(value: Date) {
  return weekdayIndexUtc(value) === 5;
}

export function parseJalaliMonthName(value: string) {
  const compact = compactPersian(value);
  const index = JALALI_MONTHS.findIndex(
    (name) => compactPersian(name) === compact,
  );
  return index === -1 ? null : index + 1;
}

export function extractJalaliMonthFromText(value: string) {
  const normalized = normalizePersian(value);
  for (let i = 0; i < JALALI_MONTHS.length; i += 1) {
    const monthName = JALALI_MONTHS[i];
    const pattern = new RegExp(`${monthName}\\s+(\\d{4})`);
    const match = pattern.exec(normalized);
    if (match) {
      return { year: Number(match[1]), month: i + 1 };
    }
  }
  return null;
}

export function datesInJalaliMonth(year: number, month: number) {
  const length = jalaliMonthLength(year, month);
  const dates: { jalali: JalaliYmd; gregorian: GregorianYmd; utc: Date }[] = [];
  for (let day = 1; day <= length; day += 1) {
    const gregorian = jalaliToGregorian(year, month, day);
    if (!gregorian) {
      continue;
    }
    dates.push({
      jalali: { year, month, day },
      gregorian,
      utc: utcDateFromGregorian(gregorian),
    });
  }
  return dates;
}
