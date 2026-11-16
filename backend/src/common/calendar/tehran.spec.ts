import {
  mealServingHasEnded,
  orderDeadlineInstantUtc,
  parseClockHm,
  servingInstantUtc,
  servingTimeUtcDate,
} from './tehran';

describe('tehran serving instants', () => {
  it('parses HH:mm clocks', () => {
    expect(parseClockHm('12:00')).toEqual({
      hours: 12,
      minutes: 0,
      seconds: 0,
    });
    expect(parseClockHm('25:00')).toBeNull();
  });

  it('places a Tehran wall clock on the meal DATE', () => {
    const mealDate = new Date('2026-08-23T00:00:00.000Z');
    const serving = servingTimeUtcDate(12, 0, 0);
    const instant = servingInstantUtc(mealDate, serving);
    expect(instant.toISOString()).toBe('2026-08-23T08:30:00.000Z');
  });

  it('treats the exact serving instant as not yet ended', () => {
    const mealDate = new Date('2026-08-23T00:00:00.000Z');
    const serving = servingTimeUtcDate(12, 0, 0);
    const instant = servingInstantUtc(mealDate, serving);
    expect(mealServingHasEnded(mealDate, serving, instant)).toBe(false);
    expect(
      mealServingHasEnded(mealDate, serving, new Date(instant.getTime() + 1)),
    ).toBe(true);
  });
});

describe('orderDeadlineInstantUtc', () => {
  it('places same-day and previous-day policies on Tehran wall clocks', () => {
    const mealDate = new Date('2026-11-17T00:00:00.000Z');
    expect(
      orderDeadlineInstantUtc(mealDate, 'SAME_DAY', 10, 0).toISOString(),
    ).toBe('2026-11-17T06:30:00.000Z');
    expect(
      orderDeadlineInstantUtc(mealDate, 'PREVIOUS_DAY', 14, 0).toISOString(),
    ).toBe('2026-11-16T10:30:00.000Z');
  });
});
