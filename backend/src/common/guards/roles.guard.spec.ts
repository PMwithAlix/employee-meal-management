import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function contextWith(userRole?: Role): ExecutionContext {
  const request: { authUser?: { role: Role } } = {};
  if (userRole) {
    request.authUser = { role: userRole };
  }
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows any authenticated user when no roles are declared', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextWith(Role.EMPLOYEE))).toBe(true);
  });

  it('allows an allowed role and rejects a client-supplied mismatch', () => {
    const reflector = {
      getAllAndOverride: () => [Role.ADMIN],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextWith(Role.ADMIN))).toBe(true);
    expect(() => guard.canActivate(contextWith(Role.EMPLOYEE))).toThrow(
      ForbiddenException,
    );
  });
});
