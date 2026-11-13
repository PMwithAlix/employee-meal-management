import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

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
}
