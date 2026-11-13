import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrderCycleStatus, Prisma, Role } from '@prisma/client';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../database/prisma.service';
import { parseGregorianDateOnly } from '../dates/iso-date';
import { mealServingHasEnded } from '../dates/tehran';
import { ListRatingsQueryDto } from './dto/list-ratings.query';
import { UpsertRatingDto } from './dto/upsert-rating.dto';
import { presentRating } from './order.presenter';

const viewers: Role[] = [Role.ADMIN, Role.SUPPORT, Role.MANAGEMENT];

@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async upsertMine(actor: AuthUser, orderId: string, dto: UpsertRatingDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { currentCycle: true, rating: true },
        });
        if (!order || order.userId !== actor.id) {
          throw new NotFoundException('سفارش پیدا نشد.');
        }
        if (
          !order.currentCycle ||
          order.currentCycle.status !== OrderCycleStatus.ACTIVE
        ) {
          throw new UnprocessableEntityException(
            'سفارش لغوشده یا بدون چرخه فعال قابل امتیازدهی نیست.',
          );
        }
        const setting = await tx.mealSetting.findUnique({
          where: { mealType: order.mealType },
        });
        if (!setting) {
          throw new UnprocessableEntityException(
            'ساعت این وعده در تنظیمات سامانه تعریف نشده است.',
          );
        }
        if (!mealServingHasEnded(order.mealDate, setting.servingTime)) {
          throw new UnprocessableEntityException(
            'ثبت نظرسنجی فقط پس از پایان زمان وعده مجاز است.',
          );
        }
        const comment =
          dto.comment === undefined || dto.comment.trim() === ''
            ? null
            : dto.comment.trim();
        const before = order.rating
          ? {
              score: order.rating.score,
              comment: order.rating.comment,
              orderCycleId: order.rating.orderCycleId,
            }
          : null;
        const saved = order.rating
          ? await tx.rating.update({
              where: { id: order.rating.id },
              data: {
                score: dto.score,
                comment,
                orderCycleId: order.currentCycle.id,
              },
              include: this.staffInclude,
            })
          : await tx.rating.create({
              data: {
                orderId: order.id,
                orderCycleId: order.currentCycle.id,
                score: dto.score,
                comment,
              },
              include: this.staffInclude,
            });
        await this.audit.record(
          {
            actorId: actor.id,
            action: before
              ? AuditAction.RatingUpdated
              : AuditAction.RatingCreated,
            entityType: AuditEntity.Rating,
            entityId: saved.id,
            beforeData: before ?? undefined,
            afterData: {
              orderId: order.id,
              orderCycleId: saved.orderCycleId,
              score: saved.score,
              comment: saved.comment,
            },
          },
          tx,
        );
        return presentRating(saved);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('برای این سفارش قبلاً نظرسنجی ثبت شده است.');
      }
      throw error;
    }
  }

  async getMine(actor: AuthUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { rating: { include: this.staffInclude } },
    });
    if (!order || order.userId !== actor.id) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }
    if (!order.rating) {
      throw new NotFoundException('نظرسنجی پیدا نشد.');
    }
    return presentRating(order.rating);
  }

  async list(actor: AuthUser, query: ListRatingsQueryDto) {
    if (!viewers.includes(actor.role)) {
      throw new ForbiddenException('به این بخش دسترسی ندارید.');
    }
    const where: Prisma.RatingWhereInput = {};
    const orderWhere: Prisma.OrderWhereInput = {};
    if (query.userId) {
      orderWhere.userId = query.userId;
    }
    if (query.mealDate) {
      orderWhere.mealDate = parseGregorianDateOnly(query.mealDate);
    }
    if (query.mealType) {
      orderWhere.mealType = query.mealType;
    }
    if (Object.keys(orderWhere).length > 0) {
      where.order = orderWhere;
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.rating.findMany({
        where,
        include: this.staffInclude,
        orderBy: { createdAt: query.sortOrder },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.rating.count({ where }),
    ]);
    return {
      items: items.map((item) => presentRating(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private readonly staffInclude = {
    order: {
      select: {
        id: true,
        userId: true,
        mealDate: true,
        mealType: true as const,
      },
    },
    orderCycle: {
      select: {
        id: true,
        usernameSnapshot: true,
        mealTitleSnapshot: true,
        buildingNameSnapshot: true,
        mealTypeSnapshot: true as const,
        status: true,
      },
    },
  };
}
