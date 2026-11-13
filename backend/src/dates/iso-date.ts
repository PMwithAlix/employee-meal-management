import { UnprocessableEntityException } from '@nestjs/common';
import {
  gregorianFromUtcDate,
  gregorianToJalali,
  utcDateFromGregorian,
} from './jalali';

export function parseGregorianDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new UnprocessableEntityException('تاریخ میلادی نامعتبر است.');
  }
  const gregorian = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const utc = utcDateFromGregorian(gregorian);
  const check = gregorianFromUtcDate(utc);
  if (
    check.year !== gregorian.year ||
    check.month !== gregorian.month ||
    check.day !== gregorian.day
  ) {
    throw new UnprocessableEntityException('تاریخ میلادی نامعتبر است.');
  }
  return utc;
}

export function assertDateInJalaliMonth(
  mealDate: Date,
  jalaliYear: number,
  jalaliMonth: number,
) {
  const g = gregorianFromUtcDate(mealDate);
  const jalali = gregorianToJalali(g.year, g.month, g.day);
  if (!jalali || jalali.year !== jalaliYear || jalali.month !== jalaliMonth) {
    throw new UnprocessableEntityException(
      'تاریخ داخل ماه جلالی انتخاب‌شده نیست.',
    );
  }
}

export function employeeDeadlineOpen(deadlineAt: Date, now = new Date()) {
  return now.getTime() < deadlineAt.getTime();
}

export function canBypassEmployeeDeadline(role: string) {
  return role === 'SUPPORT' || role === 'ADMIN';
}
