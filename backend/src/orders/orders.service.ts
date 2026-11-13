import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MealType, OrderCycleStatus, Prisma, Role } from '@prisma/client';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { normalizeUsername } from '../auth/crypto/username';
import type { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../database/prisma.service';
import {
  canBypassEmployeeDeadline,
  employeeDeadlineOpen,
  parseGregorianDateOnly,
} from '../dates/iso-date';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders.query';
import { UpdateOrderDto } from './dto/update-order.dto';
import { membershipsValidAtWhere } from './membership-snapshot';
import { requirePublishedOption } from './order-option';
import { orderCycleInclude, presentOrder } from './order.presenter';

const managers: Role[] = [Role.ADMIN, Role.SUPPORT];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuthUser, dto: CreateOrderDto) {
    const targetId = dto.userId ?? actor.id;
    if (targetId !== actor.id && !managers.includes(actor.role)) {
      throw new ForbiddenException('اجازهٔ ثبت سفارش برای دیگران را ندارید.');
    }
    const mealDate = parseGregorianDateOnly(dto.mealDate);
    return this.writeCycle(actor, {
      userId: targetId,
      mealDate,
      mealType: dto.mealType,
      menuItemId: dto.menuItemId,
      mode: 'create',
    });
  }

  async update(
    actor: AuthUser,
    orderId: string,
    dto: UpdateOrderDto,
    selfOnly: boolean,
  ) {
    const existing = await this.requireOrder(
      orderId,
      selfOnly ? actor.id : undefined,
    );
    return this.writeCycle(actor, {
      userId: existing.userId,
      mealDate: existing.mealDate,
      mealType: existing.mealType,
      menuItemId: dto.menuItemId,
      mode: 'update',
      orderId,
    });
  }

  async cancel(actor: AuthUser, orderId: string, selfOnly: boolean) {
    const existing = await this.requireOrder(
      orderId,
      selfOnly ? actor.id : undefined,
    );
    const bypass = canBypassEmployeeDeadline(actor.role);
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: existing.id },
        include: { currentCycle: true },
      });
      if (
        !order.currentCycle ||
        order.currentCycle.status !== OrderCycleStatus.ACTIVE
      ) {
        throw new UnprocessableEntityException(
          'سفارش فعالی برای لغو وجود ندارد.',
        );
      }
      await this.assertDeadline(tx, order.mealDate, order.mealType, bypass);
      const cancelled = await tx.orderCycle.update({
        where: { id: order.currentCycle.id },
        data: { status: OrderCycleStatus.CANCELLED },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderCycleId: cancelled.id,
          oldStatus: OrderCycleStatus.ACTIVE,
          newStatus: OrderCycleStatus.CANCELLED,
          actorId: actor.id,
          reason: 'CANCELLED',
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.OrderCancelled,
          entityType: AuditEntity.Order,
          entityId: order.id,
          beforeData: { cycleId: order.currentCycle.id, status: 'ACTIVE' },
          afterData: {
            cycleId: cancelled.id,
            status: 'CANCELLED',
            userId: order.userId,
          },
        },
        tx,
      );
      return this.loadPresented(tx, order.id);
    });
  }

  async getMine(actor: AuthUser, id: string) {
    return presentOrder(await this.requireOrder(id, actor.id));
  }

  async getManaged(id: string) {
    return presentOrder(await this.requireOrder(id));
  }

  async listMine(actor: AuthUser, query: ListOrdersQueryDto) {
    return this.list({ ...query, userId: actor.id });
  }

  async listManaged(query: ListOrdersQueryDto) {
    return this.list(query);
  }

  private async list(query: ListOrdersQueryDto & { userId?: string }) {
    const where: Prisma.OrderWhereInput = {};
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.mealDate) {
      where.mealDate = parseGregorianDateOnly(query.mealDate);
    }
    if (query.from || query.to) {
      where.mealDate = {
        ...(query.from ? { gte: parseGregorianDateOnly(query.from) } : {}),
        ...(query.to ? { lte: parseGregorianDateOnly(query.to) } : {}),
      };
    }
    if (query.mealType) {
      where.mealType = query.mealType;
    }
    if (query.username) {
      const username = normalizeUsername(query.username);
      where.OR = [
        { user: { username: { contains: username, mode: 'insensitive' } } },
        {
          currentCycle: {
            usernameSnapshot: { contains: username, mode: 'insensitive' },
          },
        },
      ];
    }
    const currentCycle: Prisma.OrderCycleWhereInput = {};
    if (query.status) {
      currentCycle.status = query.status;
    }
    if (query.buildingId) {
      currentCycle.buildingIdSnapshot = query.buildingId;
    }
    if (query.groupId) {
      currentCycle.groupSnapshots = { some: { groupId: query.groupId } };
    }
    if (Object.keys(currentCycle).length > 0) {
      where.currentCycle = currentCycle;
    }

    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          currentCycle: { include: orderCycleInclude },
          cycles: { orderBy: { cycleNumber: 'asc' } },
        },
        orderBy: { createdAt: query.sortOrder },
        skip,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: items.map((item) => presentOrder(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private async writeCycle(
    actor: AuthUser,
    input: {
      userId: string;
      mealDate: Date;
      mealType: MealType;
      menuItemId: string;
      mode: 'create' | 'update';
      orderId?: string;
    },
  ) {
    const bypass = canBypassEmployeeDeadline(actor.role);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: input.userId },
          include: { building: true },
        });
        if (!user) {
          throw new NotFoundException('کاربر پیدا نشد.');
        }
        if (!user.isActive) {
          throw new UnprocessableEntityException(
            'امکان ثبت سفارش برای کاربر غیرفعال وجود ندارد.',
          );
        }
        const item = await requirePublishedOption(
          tx,
          input.menuItemId,
          input.mealDate,
          input.mealType,
        );
        await this.assertDeadline(tx, input.mealDate, input.mealType, bypass);

        let order = input.orderId
          ? await tx.order.findUnique({
              where: { id: input.orderId },
              include: { currentCycle: true, cycles: true },
            })
          : await tx.order.findUnique({
              where: {
                userId_mealDate_mealType: {
                  userId: input.userId,
                  mealDate: input.mealDate,
                  mealType: input.mealType,
                },
              },
              include: { currentCycle: true, cycles: true },
            });

        if (input.mode === 'create') {
          if (order?.currentCycle?.status === OrderCycleStatus.ACTIVE) {
            throw new ConflictException(
              'برای این تاریخ و وعده سفارش فعال وجود دارد.',
            );
          }
          if (!order) {
            order = await tx.order.create({
              data: {
                userId: input.userId,
                mealDate: input.mealDate,
                mealType: input.mealType,
              },
              include: { currentCycle: true, cycles: true },
            });
          }
        } else {
          if (!order) {
            throw new NotFoundException('سفارش پیدا نشد.');
          }
          if (order.currentCycle?.status !== OrderCycleStatus.ACTIVE) {
            throw new UnprocessableEntityException(
              'سفارش لغوشده قابل ویرایش نیست.',
            );
          }
          await tx.orderCycle.update({
            where: { id: order.currentCycle.id },
            data: { status: OrderCycleStatus.CANCELLED },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderCycleId: order.currentCycle.id,
              oldStatus: OrderCycleStatus.ACTIVE,
              newStatus: OrderCycleStatus.CANCELLED,
              actorId: actor.id,
              reason: 'OPTION_CHANGED',
            },
          });
        }

        const cycleNumber =
          (order.cycles?.reduce(
            (max, cycle) => Math.max(max, cycle.cycleNumber),
            0,
          ) ?? 0) + 1;
        const snapshotAt = new Date();
        const memberships = await tx.groupMembership.findMany({
          where: membershipsValidAtWhere(input.userId, snapshotAt),
          include: { group: true },
        });
        const cycle = await tx.orderCycle.create({
          data: {
            orderId: order.id,
            menuItemId: item.id,
            cycleNumber,
            createdAt: snapshotAt,
            usernameSnapshot: user.username,
            buildingIdSnapshot: user.buildingId,
            buildingNameSnapshot: user.building?.name ?? null,
            mealTitleSnapshot: item.title,
            mealDateSnapshot: input.mealDate,
            mealTypeSnapshot: input.mealType,
            status: OrderCycleStatus.ACTIVE,
            groupSnapshots: {
              create: memberships.map((membership) => ({
                groupId: membership.groupId,
                groupNameSnapshot: membership.group.name,
              })),
            },
            statusHistory: {
              create: {
                oldStatus: null,
                newStatus: OrderCycleStatus.ACTIVE,
                actorId: actor.id,
                reason: input.mode === 'create' ? 'CREATED' : 'OPTION_CHANGED',
              },
            },
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: { currentCycleId: cycle.id },
        });
        await this.audit.record(
          {
            actorId: actor.id,
            action:
              input.mode === 'create'
                ? AuditAction.OrderCreated
                : AuditAction.OrderUpdated,
            entityType: AuditEntity.Order,
            entityId: order.id,
            afterData: {
              userId: input.userId,
              menuItemId: item.id,
              menuVersionId: item.menuVersionId,
              mealType: input.mealType,
              cycleId: cycle.id,
            },
          },
          tx,
        );
        return this.loadPresented(tx, order.id);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'برای این تاریخ و وعده سفارش فعال وجود دارد.',
        );
      }
      throw error;
    }
  }

  private async assertDeadline(
    tx: Prisma.TransactionClient,
    mealDate: Date,
    mealType: MealType,
    bypass: boolean,
  ) {
    if (bypass) {
      return;
    }
    const deadline = await tx.orderDeadline.findUnique({
      where: { mealDate_mealType: { mealDate, mealType } },
    });
    if (!deadline || !employeeDeadlineOpen(deadline.deadlineAt)) {
      throw new UnprocessableEntityException(
        'مهلت ثبت یا تغییر این سفارش گذشته است.',
      );
    }
  }

  private async requireOrder(id: string, ownerId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        currentCycle: { include: orderCycleInclude },
        cycles: { orderBy: { cycleNumber: 'asc' } },
      },
    });
    if (!order || (ownerId && order.userId !== ownerId)) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }
    return order;
  }

  private async loadPresented(tx: Prisma.TransactionClient, id: string) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id },
      include: {
        currentCycle: { include: orderCycleInclude },
        cycles: { orderBy: { cycleNumber: 'asc' } },
      },
    });
    return presentOrder(order);
  }
}
