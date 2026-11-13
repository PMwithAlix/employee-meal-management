import { membershipIsValidAt } from './membership-snapshot';

const snapshotAt = new Date('2026-08-23T06:30:00.000Z');

describe('membershipIsValidAt', () => {
  it('includes a membership started before snapshot time and not ended', () => {
    expect(
      membershipIsValidAt(
        { startedAt: new Date('2026-08-01T00:00:00.000Z'), endedAt: null },
        snapshotAt,
      ),
    ).toBe(true);
  });

  it('includes a membership started exactly at snapshot time', () => {
    expect(
      membershipIsValidAt({ startedAt: snapshotAt, endedAt: null }, snapshotAt),
    ).toBe(true);
  });

  it('excludes a membership that starts after snapshot time', () => {
    expect(
      membershipIsValidAt(
        { startedAt: new Date('2026-08-23T06:30:00.001Z'), endedAt: null },
        snapshotAt,
      ),
    ).toBe(false);
  });

  it('excludes a membership that ended before snapshot time', () => {
    expect(
      membershipIsValidAt(
        {
          startedAt: new Date('2026-08-01T00:00:00.000Z'),
          endedAt: new Date('2026-08-22T00:00:00.000Z'),
        },
        snapshotAt,
      ),
    ).toBe(false);
  });

  it('excludes a membership that ended exactly at snapshot time', () => {
    expect(
      membershipIsValidAt(
        {
          startedAt: new Date('2026-08-01T00:00:00.000Z'),
          endedAt: snapshotAt,
        },
        snapshotAt,
      ),
    ).toBe(false);
  });

  it('includes a membership that ends after snapshot time', () => {
    expect(
      membershipIsValidAt(
        {
          startedAt: new Date('2026-08-01T00:00:00.000Z'),
          endedAt: new Date('2026-08-23T06:30:00.001Z'),
        },
        snapshotAt,
      ),
    ).toBe(true);
  });
});
