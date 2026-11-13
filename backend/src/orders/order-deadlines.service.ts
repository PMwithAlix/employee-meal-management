import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../database/prisma.service';
import {
  assertDateInJalaliMonth,
  parseGregorianDateOnly,
} from '../dates/iso-date';
import {
  datesInJalaliMonth,
  formatDateOnly,
  isValidJalaliMonth,
} from '../dates/jalali';
import { deadlineTxOptions, lockDeadlineMonth } from './deadline-lock';
import { UpsertDeadlinesDto } from './dto/upsert-deadlines.dto';
import { presentDeadline } from './order.presenter';

@Injectable()
export class OrderDeadlinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(year?: number, month?: number) {
    if (year && month) {
      return this.listMonth(year, month);
    }
    return this.prisma.orderDeadline
      .findMany({ orderBy: [{ mealDate: 'asc' }, { mealType: 'asc' }] })
      .then((rows) => rows.map((row) => presentDeadline(row)));
  }

  async listMonth(year: number, month: number) {
    this.assertMonth(year, month);
    const bounds = datesInJalaliMonth(year, month);
    const from = bounds[0]?.utc;
    const to = bounds[bounds.length - 1]?.utc;
    const rows = await this.prisma.orderDeadline.findMany({
      where:
        from && to ? { mealDate: { gte: from, lte: to } } : { id: { in: [] } },
      orderBy: [{ mealDate: 'asc' }, { mealType: 'asc' }],
    });
    return rows.map((row) => presentDeadline(row));
  }

  async replaceMonth(
    actor: AuthUser,
    year: number,
    month: number,
    dto: UpsertDeadlinesDto,
  ) {
    this.assertMonth(year, month);
    const dates = new Set(
      datesInJalaliMonth(year, month).map((item) => formatDateOnly(item.utc)),
    );
    const seen = new Set<string>();
    const parsed = dto.items.map((item) => {
      const mealDate = parseGregorianDateOnly(item.mealDate);
      assertDateInJalaliMonth(mealDate, year, month);
      const key = `${formatDateOnly(mealDate)}:${item.mealType}`;
      if (seen.has(key)) {
        throw new UnprocessableEntityException(
          `مهلت تکراری برای ${key} ارسال شده است.`,
        );
      }
      seen.add(key);
      if (!dates.has(formatDateOnly(mealDate))) {
        throw new UnprocessableEntityException('تاریخ مهلت داخل ماه نیست.');
      }
      return {
        mealDate,
        mealType: item.mealType,
        deadlineAt: new Date(item.deadlineAt),
      };
    });
    if (parsed.some((item) => Number.isNaN(item.deadlineAt.getTime()))) {
      throw new UnprocessableEntityException('زمان مهلت نامعتبر است.');
    }

    const bounds = datesInJalaliMonth(year, month);
    const from = bounds[0].utc;
    const to = bounds[bounds.length - 1].utc;

    return this.prisma.$transaction(async (tx) => {
      await lockDeadlineMonth(tx, year, month);
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "order_deadlines" WHERE "mealDate" >= ${from} AND "mealDate" <= ${to} FOR UPDATE`,
      );
      const beforeRows = await tx.orderDeadline.findMany({
        where: { mealDate: { gte: from, lte: to } },
        orderBy: [{ mealDate: 'asc' }, { mealType: 'asc' }],
      });
      await tx.orderDeadline.deleteMany({
        where: { mealDate: { gte: from, lte: to } },
      });
      await tx.orderDeadline.createMany({
        data: parsed.map((item) => ({
          mealDate: item.mealDate,
          mealType: item.mealType,
          deadlineAt: item.deadlineAt,
          createdBy: actor.id,
        })),
      });
      const afterRows = await tx.orderDeadline.findMany({
        where: { mealDate: { gte: from, lte: to } },
        orderBy: [{ mealDate: 'asc' }, { mealType: 'asc' }],
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.OrderDeadlinesUpdated,
          entityType: AuditEntity.OrderDeadline,
          entityId: afterRows[0]?.id ?? beforeRows[0]?.id ?? actor.id,
          beforeData: {
            jalaliYear: year,
            jalaliMonth: month,
            deadlines: beforeRows.map((row) => this.auditDeadline(row)),
          },
          afterData: {
            jalaliYear: year,
            jalaliMonth: month,
            deadlines: afterRows.map((row) => this.auditDeadline(row)),
          },
        },
        tx,
      );
      return afterRows.map((row) => presentDeadline(row));
    }, deadlineTxOptions);
  }

  private auditDeadline(row: {
    id: string;
    mealDate: Date;
    mealType: string;
    deadlineAt: Date;
  }) {
    return {
      id: row.id,
      mealDate: formatDateOnly(row.mealDate),
      mealType: row.mealType,
      deadlineAt: row.deadlineAt.toISOString(),
    };
  }

  private assertMonth(year: number, month: number) {
    if (!isValidJalaliMonth(year, month) || year < 1300 || year > 1600) {
      throw new UnprocessableEntityException('سال یا ماه جلالی نامعتبر است.');
    }
  }
}
