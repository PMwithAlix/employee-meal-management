import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { GuestOrderAction, GuestOrderStatus, Prisma } from '@prisma/client';
import { AuditAction, AuditEntity } from '../../audit/audit.actions';
import { AuditService } from '../../audit/audit.service';
import type { AuthUser } from '../../../common/types/auth-user';
import { PrismaService } from '../../../database/prisma.service';
import { parseGregorianDateOnly } from '../../../common/calendar/iso-date';
import { CreateGuestOrderDto } from './dto/create-guest-order.dto';
import { ListGuestOrdersQueryDto } from './dto/list-guest-orders.query';
import { UpdateGuestOrderDto } from './dto/update-guest-order.dto';
import { requireCurrentMenuOption } from '../shared/order-option';
import { presentGuestOrder } from '../shared/order.presenter';

const guestInclude = {
  menuItem: { select: { menuVersionId: true } },
  history: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class GuestOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuthUser, dto: CreateGuestOrderDto) {
    const mealDate = parseGregorianDateOnly(dto.mealDate);
    return this.prisma.$transaction(async (tx) => {
      const lockedBuildings = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "buildings"
        WHERE "id" = ${dto.buildingId}::uuid AND "isActive" = TRUE
        FOR KEY SHARE
      `;
      if (lockedBuildings.length === 0) {
        const existingBuilding = await tx.building.findUnique({
          where: { id: dto.buildingId },
        });
        if (!existingBuilding) {
          throw new NotFoundException('ساختمان پیدا نشد.');
        }
        throw new UnprocessableEntityException(
          'ثبت سفارش مهمان برای ساختمان غیرفعال امکان‌پذیر نیست.',
        );
      }
      const building = await tx.building.findUniqueOrThrow({
        where: { id: dto.buildingId },
      });
      const item = await requireCurrentMenuOption(
        tx,
        dto.menuItemId,
        mealDate,
        dto.mealType,
      );
      const created = await tx.guestOrder.create({
        data: {
          buildingId: building.id,
          menuItemId: item.id,
          mealDate,
          mealType: dto.mealType,
          quantity: dto.quantity,
          note: dto.note ?? null,
          status: GuestOrderStatus.ACTIVE,
          buildingNameSnapshot: building.name,
          mealTitleSnapshot: item.title,
          createdBy: actor.id,
        },
      });
      await tx.guestOrderHistory.create({
        data: {
          guestOrderId: created.id,
          actorId: actor.id,
          action: GuestOrderAction.CREATED,
          beforeData: {},
          afterData: {
            id: created.id,
            buildingId: created.buildingId,
            menuItemId: created.menuItemId,
            quantity: created.quantity,
          },
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.GuestOrderCreated,
          entityType: AuditEntity.GuestOrder,
          entityId: created.id,
          afterData: {
            buildingId: building.id,
            quantity: dto.quantity,
            menuItemId: item.id,
          },
        },
        tx,
      );
      return presentGuestOrder(
        await tx.guestOrder.findUniqueOrThrow({
          where: { id: created.id },
          include: guestInclude,
        }),
      );
    });
  }

  async list(query: ListGuestOrdersQueryDto) {
    const where: Prisma.GuestOrderWhereInput = {};
    if (query.mealDate) {
      where.mealDate = parseGregorianDateOnly(query.mealDate);
    }
    if (query.mealType) {
      where.mealType = query.mealType;
    }
    if (query.buildingId) {
      where.buildingId = query.buildingId;
    }
    if (query.status) {
      where.status = query.status;
    }
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.guestOrder.findMany({
        where,
        include: guestInclude,
        orderBy: { createdAt: query.sortOrder },
        skip,
        take: query.pageSize,
      }),
      this.prisma.guestOrder.count({ where }),
    ]);
    return {
      items: items.map((item) => presentGuestOrder(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string) {
    return presentGuestOrder(await this.require(id));
  }

  async update(actor: AuthUser, id: string, dto: UpdateGuestOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.guestOrder.findUnique({
        where: { id },
        include: guestInclude,
      });
      if (!current) {
        throw new NotFoundException('سفارش مهمان پیدا نشد.');
      }
      if (current.status !== GuestOrderStatus.ACTIVE) {
        throw new UnprocessableEntityException(
          'سفارش مهمان لغوشده قابل ویرایش نیست.',
        );
      }
      let menuItemId = current.menuItemId;
      let mealTitleSnapshot = current.mealTitleSnapshot;
      if (dto.menuItemId) {
        const item = await requireCurrentMenuOption(
          tx,
          dto.menuItemId,
          current.mealDate,
          current.mealType,
        );
        menuItemId = item.id;
        mealTitleSnapshot = item.title;
      }
      const updated = await tx.guestOrder.update({
        where: { id },
        data: {
          menuItemId,
          mealTitleSnapshot,
          quantity: dto.quantity ?? current.quantity,
          note: dto.note === undefined ? current.note : dto.note,
        },
      });
      await tx.guestOrderHistory.create({
        data: {
          guestOrderId: id,
          actorId: actor.id,
          action: GuestOrderAction.UPDATED,
          beforeData: {
            menuItemId: current.menuItemId,
            quantity: current.quantity,
            note: current.note,
          },
          afterData: {
            menuItemId: updated.menuItemId,
            quantity: updated.quantity,
            note: updated.note,
          },
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.GuestOrderUpdated,
          entityType: AuditEntity.GuestOrder,
          entityId: id,
          beforeData: {
            menuItemId: current.menuItemId,
            quantity: current.quantity,
          },
          afterData: {
            menuItemId: updated.menuItemId,
            quantity: updated.quantity,
          },
        },
        tx,
      );
      return presentGuestOrder(
        await tx.guestOrder.findUniqueOrThrow({
          where: { id },
          include: guestInclude,
        }),
      );
    });
  }

  async cancel(actor: AuthUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.guestOrder.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException('سفارش مهمان پیدا نشد.');
      }
      if (current.status !== GuestOrderStatus.ACTIVE) {
        throw new UnprocessableEntityException(
          'این سفارش مهمان قبلاً لغو شده است.',
        );
      }
      const updated = await tx.guestOrder.update({
        where: { id },
        data: { status: GuestOrderStatus.CANCELLED },
      });
      await tx.guestOrderHistory.create({
        data: {
          guestOrderId: id,
          actorId: actor.id,
          action: GuestOrderAction.CANCELLED,
          beforeData: { status: current.status },
          afterData: { status: updated.status },
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.GuestOrderCancelled,
          entityType: AuditEntity.GuestOrder,
          entityId: id,
          afterData: { status: updated.status },
        },
        tx,
      );
      return presentGuestOrder(
        await tx.guestOrder.findUniqueOrThrow({
          where: { id },
          include: guestInclude,
        }),
      );
    });
  }

  private async require(id: string) {
    const order = await this.prisma.guestOrder.findUnique({
      where: { id },
      include: guestInclude,
    });
    if (!order) {
      throw new NotFoundException('سفارش مهمان پیدا نشد.');
    }
    return order;
  }
}
