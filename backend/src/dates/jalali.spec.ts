import {
  datesInJalaliMonth,
  extractJalaliMonthFromText,
  formatJalali,
  gregorianToJalali,
  isJalaliFriday,
  isLeapJalaliYear,
  jalaliMonthLength,
  jalaliToGregorian,
  jalaliWeekdayName,
  parseJalaliDate,
  utcDateFromGregorian,
  weekdayMatches,
} from './jalali';

describe('jalali conversion', () => {
  it('converts Jalali to Gregorian and back', () => {
    const gregorian = jalaliToGregorian(1405, 6, 1);
    expect(gregorian).toEqual({ year: 2026, month: 8, day: 23 });
    expect(gregorianToJalali(2026, 8, 23)).toEqual({
      year: 1405,
      month: 6,
      day: 1,
    });
  });

  it('handles Jalali leap years and Esfand length', () => {
    expect(isLeapJalaliYear(1403)).toBe(true);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(isLeapJalaliYear(1404)).toBe(false);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
    expect(jalaliToGregorian(1403, 12, 30)).toEqual({
      year: 2025,
      month: 3,
      day: 20,
    });
    expect(jalaliToGregorian(1404, 12, 30)).toBeNull();
  });

  it('handles Gregorian leap-year dates', () => {
    expect(gregorianToJalali(2024, 2, 29)).toEqual({
      year: 1402,
      month: 12,
      day: 10,
    });
  });

  it('covers Jalali year transition', () => {
    expect(jalaliToGregorian(1403, 12, 30)?.year).toBe(2025);
    expect(jalaliToGregorian(1404, 1, 1)).toEqual({
      year: 2025,
      month: 3,
      day: 21,
    });
  });

  it('rejects dates outside a Jalali month', () => {
    expect(jalaliToGregorian(1405, 6, 32)).toBeNull();
    expect(parseJalaliDate('1405/13/01')).toBeNull();
  });

  it('parses Persian digits and formats Jalali dates', () => {
    expect(parseJalaliDate('۱۴۰۵/۰۶/۰۱')).toEqual({
      year: 1405,
      month: 6,
      day: 1,
    });
    expect(formatJalali({ year: 1405, month: 6, day: 1 })).toBe('1405/06/01');
  });

  it('matches Iranian weekdays including Friday', () => {
    const first = utcDateFromGregorian(jalaliToGregorian(1405, 6, 1)!);
    expect(jalaliWeekdayName(first)).toBe('یکشنبه');
    expect(weekdayMatches('یکشنبه', first)).toBe(true);
    const friday = utcDateFromGregorian(jalaliToGregorian(1405, 6, 6)!);
    expect(isJalaliFriday(friday)).toBe(true);
    expect(weekdayMatches('جمعه', friday)).toBe(true);
  });

  it('lists every day of Shahrivar 1405', () => {
    const days = datesInJalaliMonth(1405, 6);
    expect(days).toHaveLength(31);
    expect(formatJalali(days[0].jalali)).toBe('1405/06/01');
    expect(formatJalali(days[30].jalali)).toBe('1405/06/31');
    expect(days[0].gregorian).toEqual({ year: 2026, month: 8, day: 23 });
    expect(days[30].gregorian.month).not.toBe(days[0].gregorian.month);
  });

  it('extracts the month from a workbook title', () => {
    expect(
      extractJalaliMonthFromText('منو ناهار رستوران  (شهریور 1405)'),
    ).toEqual({ year: 1405, month: 6 });
  });
});
