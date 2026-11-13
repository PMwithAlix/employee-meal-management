import { UnprocessableEntityException } from '@nestjs/common';
import { Role } from '@prisma/client';

export function isEligibleGroupMemberRole(role: Role): boolean {
  return role === Role.EMPLOYEE;
}

export function assertEligibleGroupMemberRole(role: Role): void {
  if (!isEligibleGroupMemberRole(role)) {
    throw new UnprocessableEntityException(
      'فقط کاربران دارای نقش کارمند می‌توانند عضو گروه باشند.',
    );
  }
}
