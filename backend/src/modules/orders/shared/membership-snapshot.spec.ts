import {
  membershipIsValidAt,
  membershipsValidAtWhere,
} from './membership-snapshot';

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

  it('includes every membership that is valid at snapshot time', () => {
    const memberships = [
      {
        group: 'open',
        startedAt: new Date('2026-08-01T00:00:00.000Z'),
        endedAt: null,
      },
      {
        group: 'overlapping',
        startedAt: snapshotAt,
        endedAt: new Date('2026-08-24T00:00:00.000Z'),
      },
      {
        group: 'future',
        startedAt: new Date('2026-08-23T06:30:00.001Z'),
        endedAt: null,
      },
      {
        group: 'ended',
        startedAt: new Date('2026-08-01T00:00:00.000Z'),
        endedAt: snapshotAt,
      },
    ];
    expect(
      memberships
        .filter((membership) => membershipIsValidAt(membership, snapshotAt))
        .map((membership) => membership.group),
    ).toEqual(['open', 'overlapping']);
  });
});

describe('membershipsValidAtWhere', () => {
  it('scopes historical memberships to the target employee, not the actor', () => {
    const employeeId = '11111111-1111-1111-1111-111111111111';
    expect(membershipsValidAtWhere(employeeId, snapshotAt)).toEqual({
      userId: employeeId,
      startedAt: { lte: snapshotAt },
      OR: [{ endedAt: null }, { endedAt: { gt: snapshotAt } }],
    });
  });
});
