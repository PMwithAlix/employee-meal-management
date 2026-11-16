import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../database/prisma.service';
import { AddGroupMemberDto } from './dto/add-group-member.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { assertEligibleGroupMemberRole } from './groups.access';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuthUser, dto: CreateGroupDto) {
    const name = dto.name.trim();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const group = await tx.group.create({ data: { name } });
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.GroupCreated,
            entityType: AuditEntity.Group,
            entityId: group.id,
            afterData: group,
          },
          tx,
        );
        return group;
      });
    } catch (error) {
      this.throwIfUnique(error);
      throw error;
    }
  }

  list() {
    return this.prisma.group.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async get(id: string) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        _count: {
          select: { memberships: { where: { endedAt: null } } },
        },
      },
    });
    if (!group) {
      throw new NotFoundException('گروه پیدا نشد.');
    }
    return group;
  }

  async update(actor: AuthUser, id: string, dto: UpdateGroupDto) {
    const current = await this.requireGroup(id);
    const name = dto.name.trim();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const group = await tx.group.update({
          where: { id },
          data: { name },
        });
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.GroupUpdated,
            entityType: AuditEntity.Group,
            entityId: id,
            beforeData: current,
            afterData: group,
          },
          tx,
        );
        return group;
      });
    } catch (error) {
      this.throwIfUnique(error);
      throw error;
    }
  }

  async deactivate(actor: AuthUser, id: string) {
    const current = await this.requireGroup(id);
    const endedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.groupMembership.updateMany({
        where: { groupId: id, endedAt: null },
        data: { endedAt },
      });
      const group = await tx.group.update({
        where: { id },
        data: { isActive: false },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.GroupDeactivated,
          entityType: AuditEntity.Group,
          entityId: id,
          beforeData: current,
          afterData: group,
        },
        tx,
      );
      return group;
    });
  }

  async members(id: string) {
    await this.requireGroup(id);
    return this.prisma.groupMembership.findMany({
      where: { groupId: id, endedAt: null },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            buildingId: true,
            isActive: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async history(id: string) {
    await this.requireGroup(id);
    return this.prisma.groupMembership.findMany({
      where: { groupId: id },
      include: {
        user: { select: { id: true, username: true, role: true } },
      },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async addMember(actor: AuthUser, groupId: string, dto: AddGroupMemberDto) {
    const group = await this.requireGroup(groupId);
    if (!group.isActive) {
      throw new UnprocessableEntityException('گروه غیرفعال است.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException('کاربر پیدا نشد.');
    }
    if (!user.isActive) {
      throw new UnprocessableEntityException(
        'افزودن کاربر غیرفعال به گروه مجاز نیست.',
      );
    }
    assertEligibleGroupMemberRole(user.role);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const membership = await tx.groupMembership.create({
          data: {
            groupId,
            userId: dto.userId,
            startedAt: new Date(),
          },
        });
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.UserAddedToGroup,
            entityType: AuditEntity.GroupMembership,
            entityId: membership.id,
            afterData: {
              groupId,
              userId: dto.userId,
              startedAt: membership.startedAt,
            },
          },
          tx,
        );
        return membership;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2004')
      ) {
        throw new ConflictException('عضویت فعال تکراری یا بازهٔ هم‌پوشان است.');
      }
      throw error;
    }
  }

  async removeMember(actor: AuthUser, groupId: string, userId: string) {
    await this.requireGroup(groupId);
    const active = await this.prisma.groupMembership.findFirst({
      where: { groupId, userId, endedAt: null },
    });
    if (!active) {
      throw new NotFoundException('عضویت فعالی برای این کاربر وجود ندارد.');
    }
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.groupMembership.update({
        where: { id: active.id },
        data: { endedAt: new Date() },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.UserRemovedFromGroup,
          entityType: AuditEntity.GroupMembership,
          entityId: membership.id,
          beforeData: { endedAt: null },
          afterData: { endedAt: membership.endedAt },
        },
        tx,
      );
      return membership;
    });
  }

  async remove(actor: AuthUser, id: string) {
    const current = await this.requireGroup(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.groupMembership.deleteMany({ where: { groupId: id } });
      await tx.orderGroupSnapshot.deleteMany({ where: { groupId: id } });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.GroupDeleted,
          entityType: AuditEntity.Group,
          entityId: id,
          beforeData: current,
        },
        tx,
      );
      await tx.group.delete({ where: { id } });
    });
    return { ok: true as const };
  }

  private async requireGroup(id: string) {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) {
      throw new NotFoundException('گروه پیدا نشد.');
    }
    return group;
  }

  private throwIfUnique(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('نام گروه تکراری است.');
    }
  }
}
