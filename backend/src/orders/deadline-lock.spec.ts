import {
  DEADLINE_MONTH_LOCK_CLASS,
  deadlineMonthLockKey,
} from './deadline-lock';

describe('deadlineMonthLockKey', () => {
  it('maps a Jalali year/month onto a stable int4 pair', () => {
    expect(DEADLINE_MONTH_LOCK_CLASS).toBe(0x4b484e44);
    expect(deadlineMonthLockKey(1413, 1)).toBe(141301);
    expect(deadlineMonthLockKey(1413, 12)).not.toBe(
      deadlineMonthLockKey(1414, 1),
    );
  });
});
