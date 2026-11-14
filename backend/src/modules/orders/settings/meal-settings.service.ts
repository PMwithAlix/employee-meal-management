import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { MealType } from '@prisma/client';
import { AuditAction, AuditEntity } from '../../audit/audit.actions';
import { AuditService } from '../../audit/audit.service';
import type { AuthUser } from '../../../common/types/auth-user';
import { PrismaService } from '../../../database/prisma.service';
import {
  formatClockHm,
  parseClockHm,
  servingTimeUtcDate,
} from '../../../common/calendar/tehran';
import { UpsertMealSettingsDto } from './dto/upsert-meal-settings.dto';

@Injectable()
export class MealSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const rows = await this.prisma.mealSetting.findMany({
      orderBy: { mealType: 'asc' },
    });
    return rows.map((row) => this.present(row));
  }

  async replace(actor: AuthUser, dto: UpsertMealSettingsDto) {
    const seen = new Set<MealType>();
    const parsed = dto.items.map((item) => {
      if (seen.has(item.mealType)) {
        throw new UnprocessableEntityException(
          'ساعت تکراری برای یک وعده ارسال شده است.',
        );
      }
      seen.add(item.mealType);
      const clock = parseClockHm(item.servingTime);
      if (!clock) {
        throw new UnprocessableEntityException('ساعت وعده نامعتبر است.');
      }
      return {
        mealType: item.mealType,
        servingTime: servingTimeUtcDate(
          clock.hours,
          clock.minutes,
          clock.seconds,
        ),
      };
    });
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.mealSetting.findMany({
        orderBy: { mealType: 'asc' },
      });
      for (const item of parsed) {
        await tx.mealSetting.upsert({
          where: { mealType: item.mealType },
          create: {
            mealType: item.mealType,
            servingTime: item.servingTime,
            updatedBy: actor.id,
          },
          update: {
            servingTime: item.servingTime,
            updatedBy: actor.id,
          },
        });
      }
      const after = await tx.mealSetting.findMany({
        orderBy: { mealType: 'asc' },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.MealSettingsUpdated,
          entityType: AuditEntity.MealSetting,
          entityId: after[0]?.id ?? actor.id,
          beforeData: {
            meals: before.map((row) => this.present(row)),
          },
          afterData: {
            meals: after.map((row) => this.present(row)),
          },
        },
        tx,
      );
      return after.map((row) => this.present(row));
    });
  }

  private present(row: {
    id: string;
    mealType: MealType;
    servingTime: Date;
    updatedBy: string;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      mealType: row.mealType,
      servingTime: formatClockHm(row.servingTime),
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  }
}
