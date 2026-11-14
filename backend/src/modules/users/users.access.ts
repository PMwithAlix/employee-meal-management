import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../common/types/auth-user';

export const HR_MANAGED_ROLES: Role[] = [
  Role.EMPLOYEE,
  Role.SUPPORT,
  Role.MANAGEMENT,
];

export function assertCanAssignRole(actor: AuthUser, role: Role) {
  if (actor.role === Role.ADMIN) {
    return;
  }
  if (actor.role === Role.HR && HR_MANAGED_ROLES.includes(role)) {
    return;
  }
  throw new ForbiddenException('اجازهٔ تعیین این نقش را ندارید.');
}

export function assertCanManageUser(actor: AuthUser, targetRole: Role) {
  if (actor.role === Role.ADMIN) {
    return;
  }
  if (actor.role === Role.HR && HR_MANAGED_ROLES.includes(targetRole)) {
    return;
  }
  throw new ForbiddenException('اجازهٔ مدیریت این حساب را ندارید.');
}

export function assertRoleBuilding(role: Role, buildingId: string | null) {
  if (role === Role.ADMIN) {
    return;
  }
  if (!buildingId) {
    throw new UnprocessableEntityException(
      'برای این نقش باید یک ساختمان انتخاب شود.',
    );
  }
}
