import { UnprocessableEntityException } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  assertEligibleGroupMemberRole,
  isEligibleGroupMemberRole,
} from './groups.access';

describe('groups.access', () => {
  it('allows EMPLOYEE role only', () => {
    expect(isEligibleGroupMemberRole(Role.EMPLOYEE)).toBe(true);
    expect(() => assertEligibleGroupMemberRole(Role.EMPLOYEE)).not.toThrow();
  });

  it.each([
    Role.ADMIN,
    Role.HR,
    Role.SUPPORT,
    Role.MANAGEMENT,
  ])('rejects %s role', (role) => {
    expect(isEligibleGroupMemberRole(role)).toBe(false);
    expect(() => assertEligibleGroupMemberRole(role)).toThrow(
      UnprocessableEntityException,
    );
  });
});
