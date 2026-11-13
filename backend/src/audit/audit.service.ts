import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.query';

const SECRET_KEYS = new Set([
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'confirmNewPassword',
  'tokenHash',
  'token',
]);

type AuditInput = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput, tx: Prisma.TransactionClient = this.prisma) {
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeData:
          input.beforeData === undefined
            ? undefined
            : (this.sanitize(input.beforeData) as Prisma.InputJsonValue),
        afterData:
          input.afterData === undefined
            ? undefined
            : (this.sanitize(input.afterData) as Prisma.InputJsonValue),
        metadata:
          input.metadata === undefined
            ? undefined
            : (this.sanitize(input.metadata) as Prisma.InputJsonValue),
      },
    });
  }

  sanitize(value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value)) {
        if (SECRET_KEYS.has(key)) {
          continue;
        }
        result[key] = this.sanitize(nested);
      }
      return result;
    }
    return value;
  }

  async list(query: ListAuditLogsQueryDto) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) {
      where.action = query.action;
    }
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, username: true, role: true } },
        },
        orderBy: { createdAt: query.sortOrder },
        skip,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        actorId: item.actorId,
        actor: item.actor
          ? {
              id: item.actor.id,
              username: item.actor.username,
              role: item.actor.role,
            }
          : null,
        beforeData: this.sanitize(item.beforeData),
        afterData: this.sanitize(item.afterData),
        metadata: this.sanitize(item.metadata),
        createdAt: item.createdAt,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
