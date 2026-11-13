import { Prisma } from '@prisma/client';

export function membershipsValidAtWhere(
  userId: string,
  snapshotAt: Date,
): Prisma.GroupMembershipWhereInput {
  return {
    userId,
    startedAt: { lte: snapshotAt },
    OR: [{ endedAt: null }, { endedAt: { gt: snapshotAt } }],
  };
}

export function membershipIsValidAt(
  membership: { startedAt: Date; endedAt: Date | null },
  snapshotAt: Date,
) {
  if (membership.startedAt.getTime() > snapshotAt.getTime()) {
    return false;
  }
  if (
    membership.endedAt !== null &&
    membership.endedAt.getTime() <= snapshotAt.getTime()
  ) {
    return false;
  }
  return true;
}
