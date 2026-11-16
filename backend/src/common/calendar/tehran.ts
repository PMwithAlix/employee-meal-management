import { formatDateOnly } from './jalali';

const TEHRAN = 'Asia/Tehran';

export function clockFromUtcDate(value: Date) {
  return {
    hours: value.getUTCHours(),
    minutes: value.getUTCMinutes(),
    seconds: value.getUTCSeconds(),
  };
}

export function formatClockHm(value: Date) {
  const clock = clockFromUtcDate(value);
  return `${String(clock.hours).padStart(2, '0')}:${String(clock.minutes).padStart(2, '0')}`;
}

export function parseClockHm(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value.trim());
  if (!match) {
    return null;
  }
  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
    seconds: Number(match[3] ?? 0),
  };
}

export function servingTimeUtcDate(
  hours: number,
  minutes: number,
  seconds = 0,
) {
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds));
}

function tehranParts(instant: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TEHRAN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function tehranWallToUtc(
  ymd: string,
  hours: number,
  minutes: number,
  seconds = 0,
) {
  const [year, month, day] = ymd.split('-').map(Number);
  let utc =
    Date.UTC(year, month - 1, day, hours, minutes, seconds) - 3.5 * 3600 * 1000;
  for (let i = 0; i < 6; i += 1) {
    const parts = tehranParts(new Date(utc));
    const target = Date.UTC(year, month - 1, day, hours, minutes, seconds);
    const actual = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const delta = target - actual;
    utc += delta;
    if (delta === 0) {
      break;
    }
  }
  return new Date(utc);
}

export function servingInstantUtc(mealDate: Date, servingTime: Date) {
  const clock = clockFromUtcDate(servingTime);
  return tehranWallToUtc(
    formatDateOnly(mealDate),
    clock.hours,
    clock.minutes,
    clock.seconds,
  );
}

export function mealServingHasEnded(
  mealDate: Date,
  servingTime: Date,
  now = new Date(),
) {
  return now.getTime() > servingInstantUtc(mealDate, servingTime).getTime();
}

export type DeadlineDayRelation = 'SAME_DAY' | 'PREVIOUS_DAY';

export function orderDeadlineInstantUtc(
  mealDate: Date,
  relation: DeadlineDayRelation,
  hour: number,
  minute: number,
) {
  const ymd = formatDateOnly(mealDate);
  const [year, month, day] = ymd.split('-').map(Number);
  const wall =
    relation === 'PREVIOUS_DAY'
      ? new Date(Date.UTC(year, month - 1, day - 1))
      : new Date(Date.UTC(year, month - 1, day));
  const wallYmd = `${wall.getUTCFullYear()}-${String(wall.getUTCMonth() + 1).padStart(2, '0')}-${String(wall.getUTCDate()).padStart(2, '0')}`;
  return tehranWallToUtc(wallYmd, hour, minute);
}
