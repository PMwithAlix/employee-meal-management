import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  deleteGuestOrders,
  enableAdminPurge,
  purgeUserRecord,
} from '../purge/entity-purge';
import { normalizeBuildingName } from './building-name';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';

@Injectable()
export class BuildingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuthUser, dto: CreateBuildingDto) {
    const name = normalizeBuildingName(dto.name);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertUniqueName(tx, name);
        const building = await tx.building.create({ data: { name } });
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.BuildingCreated,
            entityType: AuditEntity.Building,
            entityId: building.id,
            afterData: building,
          },
          tx,
        );
        return building;
      });
    } catch (error) {
      this.throwIfUnique(error);
      throw error;
    }
  }

  list() {
    return this.prisma.building.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async deactivate(actor: AuthUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "buildings" WHERE "id" = ${id}::uuid FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new NotFoundException('ساختمان پیدا نشد.');
      }

      const current = await tx.building.findUniqueOrThrow({ where: { id } });
      if (!current.isActive) {
        return current;
      }

      const activeUsers = await tx.user.count({
        where: { buildingId: id, isActive: true },
      });
      if (activeUsers > 0) {
        throw new ConflictException(
          `ابتدا ${activeUsers} کاربر فعال این ساختمان را به ساختمان دیگری منتقل کنید.`,
        );
      }

      const building = await tx.building.update({
        where: { id },
        data: { isActive: false },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.BuildingDeactivated,
          entityType: AuditEntity.Building,
          entityId: id,
          beforeData: current,
          afterData: building,
        },
        tx,
      );
      return building;
    });
  }

  async reactivate(actor: AuthUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "buildings" WHERE "id" = ${id}::uuid FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new NotFoundException('ساختمان پیدا نشد.');
      }
      const current = await tx.building.findUniqueOrThrow({ where: { id } });
      if (current.isActive) {
        return current;
      }
      const building = await tx.building.update({
        where: { id },
        data: { isActive: true },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.BuildingReactivated,
          entityType: AuditEntity.Building,
          entityId: id,
          beforeData: current,
          afterData: building,
        },
        tx,
      );
      return building;
    });
  }

  async get(id: string) {
    const building = await this.prisma.building.findUnique({
      where: { id },
      include: { _count: { select: { users: true, guestOrders: true } } },
    });
    if (!building) {
      throw new NotFoundException('ساختمان پیدا نشد.');
    }
    return building;
  }

  async update(actor: AuthUser, id: string, dto: UpdateBuildingDto) {
    const current = await this.prisma.building.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('ساختمان پیدا نشد.');
    }
    const name = normalizeBuildingName(dto.name);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertUniqueName(tx, name, id);
        const building = await tx.building.update({
          where: { id },
          data: { name },
        });
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.BuildingUpdated,
            entityType: AuditEntity.Building,
            entityId: id,
            beforeData: current,
            afterData: building,
          },
          tx,
        );
        return building;
      });
    } catch (error) {
      this.throwIfUnique(error);
      throw error;
    }
  }

  async remove(actor: AuthUser, id: string) {
    const current = await this.get(id);
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "buildings" WHERE "id" = ${id}::uuid FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new NotFoundException('ساختمان پیدا نشد.');
      }
      await enableAdminPurge(tx);
      await tx.user.updateMany({
        where: { id: actor.id, buildingId: id },
        data: { buildingId: null },
      });
      await deleteGuestOrders(tx, { buildingId: id });
      const assigned = await tx.user.findMany({
        where: { buildingId: id },
        select: {
          id: true,
          username: true,
          role: true,
          buildingId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      for (const user of assigned) {
        await purgeUserRecord(tx, this.audit, {
          actorId: actor.id,
          userId: user.id,
          beforeData: user,
        });
      }
      await tx.auditLog.deleteMany({
        where: { entityType: AuditEntity.Building, entityId: id },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.BuildingDeleted,
          entityType: AuditEntity.Building,
          entityId: id,
          beforeData: current,
        },
        tx,
      );
      await tx.building.delete({ where: { id } });
    });
    return { ok: true as const };
  }

  private async assertUniqueName(
    tx: Prisma.TransactionClient,
    name: string,
    excludeId?: string,
  ) {
    const existing = await tx.building.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('نام ساختمان تکراری است.');
    }
  }

  private throwIfUnique(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('نام ساختمان تکراری است.');
    }
  }
}
