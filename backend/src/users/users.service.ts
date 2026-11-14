import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import { normalizeUsername, usernameIssue } from '../auth/crypto/username';
import { passwordIssue } from '../auth/password.policy';
import { PasswordService } from '../auth/password.service';
import type { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  assertCanAssignRole,
  assertCanManageUser,
  assertRoleBuilding,
} from './users.access';

const userPublic = {
  id: true,
  username: true,
  role: true,
  buildingId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  building: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuthUser, dto: CreateUserDto) {
    const usernameError = usernameIssue(dto.username);
    if (usernameError) {
      throw new UnprocessableEntityException(usernameError);
    }
    const policy = passwordIssue(dto.password);
    if (policy) {
      throw new UnprocessableEntityException(policy);
    }

    const username = normalizeUsername(dto.username);
    assertCanAssignRole(actor, dto.role);
    const buildingId = dto.buildingId ?? null;
    assertRoleBuilding(dto.role, buildingId);
    const passwordHash = await this.passwords.hash(dto.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (buildingId) {
          await this.requireActiveBuilding(tx, buildingId);
        }
        const created = await tx.user.create({
          data: {
            username,
            passwordHash,
            role: dto.role,
            buildingId,
          },
          select: userPublic,
        });
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.UserCreated,
            entityType: AuditEntity.User,
            entityId: created.id,
            afterData: created,
          },
          tx,
        );
        return created;
      });
    } catch (error) {
      this.throwIfUnique(error);
      throw error;
    }
  }

  async list(query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {};
    if (query.username) {
      where.username = {
        contains: normalizeUsername(query.username),
        mode: 'insensitive',
      };
    }
    if (query.role) {
      where.role = query.role;
    }
    if (query.buildingId) {
      where.buildingId = query.buildingId;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userPublic,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userPublic,
    });
    if (!user) {
      throw new NotFoundException('کاربر پیدا نشد.');
    }
    return user;
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const current = await this.requireUser(id);
    assertCanManageUser(actor, current.role);
    const nextRole = dto.role ?? current.role;
    const nextBuilding =
      dto.buildingId === undefined ? current.buildingId : dto.buildingId;
    if (dto.role) {
      assertCanAssignRole(actor, dto.role);
    }
    assertRoleBuilding(nextRole, nextBuilding);
    const changed =
      nextRole !== current.role || nextBuilding !== current.buildingId;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (nextBuilding) {
        await this.requireActiveBuilding(tx, nextBuilding);
      }
      const user = await tx.user.update({
        where: { id },
        data: { role: nextRole, buildingId: nextBuilding },
        select: userPublic,
      });
      if (changed) {
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.UserUpdated,
            entityType: AuditEntity.User,
            entityId: id,
            beforeData: current,
            afterData: user,
          },
          tx,
        );
      }
      return user;
    });
    if (changed) {
      await this.sessions.revokeAllForUser(id);
    }
    return updated;
  }

  async deactivate(actor: AuthUser, id: string) {
    const current = await this.requireUser(id);
    assertCanManageUser(actor, current.role);
    if (!current.isActive) {
      return current;
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { isActive: false },
        select: userPublic,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.UserDeactivated,
          entityType: AuditEntity.User,
          entityId: id,
          beforeData: current,
          afterData: user,
        },
        tx,
      );
      return user;
    });
    await this.sessions.revokeAllForUser(id);
    return updated;
  }

  async reactivate(actor: AuthUser, id: string) {
    const current = await this.requireUser(id);
    assertCanManageUser(actor, current.role);
    if (current.isActive) {
      return current;
    }
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { isActive: true },
        select: userPublic,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.UserReactivated,
          entityType: AuditEntity.User,
          entityId: id,
          beforeData: current,
          afterData: user,
        },
        tx,
      );
      return user;
    });
  }

  async resetPassword(actor: AuthUser, id: string, dto: ResetPasswordDto) {
    const current = await this.requireUser(id);
    assertCanManageUser(actor, current.role);
    const policy = passwordIssue(dto.newPassword);
    if (policy) {
      throw new UnprocessableEntityException(policy);
    }
    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash },
      });
      await tx.notification.create({
        data: {
          userId: id,
          type: 'PASSWORD_RESET',
          title: 'رمز عبور حساب شما بازنشانی شد',
          body: 'رمز عبور حساب شما بازنشانی شد. برای ورود از رمز جدید استفاده کنید.',
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.PasswordReset,
          entityType: AuditEntity.User,
          entityId: id,
          afterData: { id, username: current.username },
        },
        tx,
      );
    });
    await this.sessions.revokeAllForUser(id);
    return { ok: true as const };
  }

  private async requireUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userPublic,
    });
    if (!user) {
      throw new NotFoundException('کاربر پیدا نشد.');
    }
    return user;
  }

  private async requireActiveBuilding(
    tx: Prisma.TransactionClient,
    id: string,
  ) {
    const buildings = await tx.$queryRaw<
      Array<{ id: string; isActive: boolean }>
    >`
      SELECT id, is_active AS "isActive"
      FROM "buildings"
      WHERE id = ${id}::uuid
      FOR KEY SHARE
    `;
    const building = buildings[0];
    if (!building) {
      throw new NotFoundException('ساختمان پیدا نشد.');
    }
    if (!building.isActive) {
      throw new UnprocessableEntityException(
        'امکان تخصیص کاربر به ساختمان غیرفعال وجود ندارد.',
      );
    }
    return building;
  }

  private throwIfUnique(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('این نام کاربری قبلاً ثبت شده است.');
    }
  }
}
