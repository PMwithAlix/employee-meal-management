import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DeadlineDayRelation, MealType } from '@prisma/client';
import { AuditAction, AuditEntity } from '../../audit/audit.actions';
import { AuditService } from '../../audit/audit.service';
import type { AuthUser } from '../../../common/types/auth-user';
import { PrismaService } from '../../../database/prisma.service';
import { orderDeadlineInstantUtc } from '../../../common/calendar/tehran';
import { employeeDeadlineOpen } from '../../../common/calendar/iso-date';
import { UpsertDeadlinePolicyDto } from './dto/upsert-deadline-policy.dto';

@Injectable()
export class OrderDeadlinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPolicy() {
    const rows = await this.prisma.orderDeadlinePolicy.findMany({
      orderBy: { mealType: 'asc' },
    });
    return rows.map((row) => this.present(row));
  }

  async replacePolicy(actor: AuthUser, dto: UpsertDeadlinePolicyDto) {
    const seen = new Set<MealType>();
    for (const item of dto.items) {
      if (seen.has(item.mealType)) {
        throw new UnprocessableEntityException(
          'سیاست تکراری برای یک وعده ارسال شده است.',
        );
      }
      seen.add(item.mealType);
    }
    if (!seen.has(MealType.LUNCH) || !seen.has(MealType.DINNER)) {
      throw new UnprocessableEntityException(
        'سیاست مهلت باید برای ناهار و شام ارسال شود.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.orderDeadlinePolicy.findMany({
        orderBy: { mealType: 'asc' },
      });
      for (const item of dto.items) {
        await tx.orderDeadlinePolicy.upsert({
          where: { mealType: item.mealType },
          create: {
            mealType: item.mealType,
            relation: item.relation,
            hour: item.hour,
            minute: item.minute,
            updatedBy: actor.id,
          },
          update: {
            relation: item.relation,
            hour: item.hour,
            minute: item.minute,
            updatedBy: actor.id,
          },
        });
      }
      const after = await tx.orderDeadlinePolicy.findMany({
        orderBy: { mealType: 'asc' },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.OrderDeadlinePolicyUpdated,
          entityType: AuditEntity.OrderDeadlinePolicy,
          entityId: after[0]?.id ?? actor.id,
          beforeData: { policies: before.map((row) => this.present(row)) },
          afterData: { policies: after.map((row) => this.present(row)) },
        },
        tx,
      );
      return after.map((row) => this.present(row));
    });
  }

  async deadlineAtFor(
    mealDate: Date,
    mealType: MealType,
    now = new Date(),
  ): Promise<{ at: Date; open: boolean } | null> {
    const policy = await this.prisma.orderDeadlinePolicy.findUnique({
      where: { mealType },
    });
    if (!policy) {
      return null;
    }
    const at = orderDeadlineInstantUtc(
      mealDate,
      policy.relation,
      policy.hour,
      policy.minute,
    );
    return { at, open: employeeDeadlineOpen(at, now) };
  }

  present(row: {
    id: string;
    mealType: MealType;
    relation: DeadlineDayRelation;
    hour: number;
    minute: number;
    updatedBy: string | null;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      mealType: row.mealType,
      relation: row.relation,
      hour: row.hour,
      minute: row.minute,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  }
}
