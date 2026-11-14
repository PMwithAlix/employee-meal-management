import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../common/types/auth-user';
import {
  assertCanAssignRole,
  assertCanManageUser,
  assertRoleBuilding,
} from './users.access';

const actor = (role: Role): AuthUser => ({
  id: 'a',
  username: 'actor',
  role,
  buildingId: null,
  sessionId: 's',
  sessionExpiresAt: new Date(),
});

describe('users.access', () => {
  it('lets HR manage employee/support/management but not admin or HR', () => {
    const hr = actor(Role.HR);
    expect(() => assertCanAssignRole(hr, Role.EMPLOYEE)).not.toThrow();
    expect(() => assertCanAssignRole(hr, Role.ADMIN)).toThrow(
      ForbiddenException,
    );
    expect(() => assertCanManageUser(hr, Role.ADMIN)).toThrow(
      ForbiddenException,
    );
    expect(() => assertCanManageUser(hr, Role.HR)).toThrow(ForbiddenException);
  });

  it('lets ADMIN assign any role and allows ADMIN without a building', () => {
    expect(() =>
      assertCanAssignRole(actor(Role.ADMIN), Role.ADMIN),
    ).not.toThrow();
    expect(() => assertRoleBuilding(Role.ADMIN, null)).not.toThrow();
    expect(() => assertRoleBuilding(Role.EMPLOYEE, null)).toThrow(
      UnprocessableEntityException,
    );
  });
});
