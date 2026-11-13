import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../database/prisma.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';

@Injectable()
export class BuildingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuthUser, dto: CreateBuildingDto) {
    const name = dto.name.trim();
    return this.prisma.$transaction(async (tx) => {
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
  }

  list() {
    return this.prisma.building.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async get(id: string) {
    const building = await this.prisma.building.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
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
    const name = dto.name.trim();
    return this.prisma.$transaction(async (tx) => {
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
  }
}
