import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  GuestOrderStatus,
  MenuVersionStatus,
  OrderCycleStatus,
  Prisma,
} from '@prisma/client';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../database/prisma.service';
import {
  gregorianFromUtcDate,
  gregorianToJalali,
  isValidJalaliMonth,
  utcDateFromGregorian,
} from '../../common/calendar/jalali';
import { AnnounceMenuDto } from './dto/announce-menu.dto';
import { CreateMenuDto } from './dto/create-menu.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { ListMenusQueryDto } from './dto/list-menus.query';
import { UpsertMealDto } from './dto/upsert-meal.dto';
import { classifyMenuItem } from './food-knowledge';
import { normalizeFoodName } from './food-name';
import {
  describeBlockingEmployeeOrder,
  describeBlockingGuestOrder,
  MENU_ITEM_ACTIVE_ORDER_FALLBACK,
  menuItemRemovalBlocked,
} from './menu-item-removal';
import { presentMenu, presentVersion } from './menu.presenter';
import { MENU_PUBLISHED_NOTIFICATION } from './menu.types';
import { normalizeOptionTitle, validateConfiguredMeals } from './menu.validation';

@Injectable()
export class MenusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListMenusQueryDto) {
    const where: Prisma.MenuWhereInput = {};
    if (query.year) {
      where.year = query.year;
    }
    if (query.month) {
      where.month = query.month;
    }
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.menu.findMany({
        where,
        include: { _count: { select: { versions: true } } },
        orderBy: [{ year: query.sortOrder }, { month: query.sortOrder }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.menu.count({ where }),
    ]);
    return {
      items: items.map((item) => presentMenu(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string) {
    const menu = await this.prisma.menu.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            status: true,
            publishedAt: true,
            createdAt: true,
          },
        },
      },
    });
    if (!menu) {
      throw new NotFoundException('منوی ماهانه پیدا نشد.');
    }
    return presentMenu(menu);
  }

  async create(actor: AuthUser, dto: CreateMenuDto) {
    if (!isValidJalaliMonth(dto.year, dto.month)) {
      throw new UnprocessableEntityException('سال یا ماه نامعتبر است.');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const menu = await tx.menu.create({
          data: { year: dto.year, month: dto.month },
        });
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.MenuCreated,
            entityType: AuditEntity.Menu,
            entityId: menu.id,
            afterData: { id: menu.id, year: menu.year, month: menu.month },
          },
          tx,
        );
        return presentMenu(menu);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('منوی این ماه قبلاً ایجاد شده است.');
      }
      throw error;
    }
  }

  async listVersions(menuId: string) {
    await this.requireMenu(menuId);
    const versions = await this.prisma.menuVersion.findMany({
      where: { menuId },
      orderBy: { versionNumber: 'desc' },
    });
    return versions.map((version) => presentVersion(version));
  }

  async getVersion(menuId: string, versionId: string) {
    const version = await this.requireVersion(menuId, versionId);
    return presentVersion(version);
  }

  async createVersion(actor: AuthUser, menuId: string, dto: CreateVersionDto) {
    const menu = await this.requireMenu(menuId);
    const sourceId =
      dto.sourceVersionId === null
        ? null
        : (dto.sourceVersionId ?? menu.publishedVersionId);
    const source = sourceId
      ? await this.requireVersion(menuId, sourceId)
      : null;

    return this.prisma.$transaction(async (tx) => {
      const aggregate = await tx.menuVersion.aggregate({
        where: { menuId },
        _max: { versionNumber: true },
      });
      const versionNumber = (aggregate._max.versionNumber ?? 0) + 1;
      const created = await tx.menuVersion.create({
        data: {
          menuId,
          versionNumber,
          status: MenuVersionStatus.DRAFT,
          createdBy: actor.id,
        },
      });
      if (source?.items.length) {
        await tx.menuItem.createMany({
          data: source.items.map((item) => ({
            menuVersionId: created.id,
            mealDate: item.mealDate,
            mealType: item.mealType,
            title: item.title,
            displayOrder: item.displayOrder,
            isRice: item.isRice,
          })),
        });
      }
      const full = await tx.menuVersion.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          items: { orderBy: [{ mealDate: 'asc' }, { displayOrder: 'asc' }] },
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.DraftVersionCreated,
          entityType: AuditEntity.MenuVersion,
          entityId: created.id,
          afterData: {
            id: created.id,
            versionNumber,
            sourceVersionId: source?.id ?? null,
          },
        },
        tx,
      );
      return presentVersion(full);
    });
  }

  async upsertMeal(
    actor: AuthUser,
    menuId: string,
    versionId: string,
    dto: UpsertMealDto,
  ) {
    try {
      return await this.writeMeal(actor, menuId, versionId, dto);
    } catch (error) {
      this.rethrowMenuMutationError(error);
    }
  }

  private async writeMeal(
    actor: AuthUser,
    menuId: string,
    versionId: string,
    dto: UpsertMealDto,
  ) {
    const version = await this.requireLiveVersion(menuId, versionId);
    const mealDate = this.parseMenuDate(
      dto.mealDate,
      version.menu.year,
      version.menu.month,
    );
    const options = dto.options.map((option, index) => ({
      id: option.id,
      title: normalizeOptionTitle(option.title),
      displayOrder: option.displayOrder ?? index + 1,
      isRice: option.isRice,
    }));

    if (options.length === 0) {
      return this.prisma.$transaction(async (tx) => {
        const existing = await tx.menuItem.findMany({
          where: {
            menuVersionId: versionId,
            mealDate,
            mealType: dto.mealType,
          },
        });
        await this.assertMenuItemsRemovable(
          tx,
          existing.map((item) => item.id),
        );
        await tx.menuItem.deleteMany({
          where: {
            menuVersionId: versionId,
            mealDate,
            mealType: dto.mealType,
          },
        });
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.MealConfigured,
            entityType: AuditEntity.MenuVersion,
            entityId: versionId,
            beforeData: existing,
            afterData: {
              mealDate: dto.mealDate,
              mealType: dto.mealType,
              options: [],
            },
          },
          tx,
        );
        return this.getVersion(menuId, versionId);
      });
    }

    const issues = validateConfiguredMeals(
      [{ mealDate, mealType: dto.mealType, options }],
      version.menu.year,
      version.menu.month,
    );
    if (issues.length) {
      throw new UnprocessableEntityException({
        message: 'پیکربندی وعده نامعتبر است.',
        errors: issues,
      });
    }

    const existingIds = new Set(
      (
        await this.prisma.menuItem.findMany({
          where: { menuVersionId: versionId },
          select: { id: true },
        })
      ).map((item) => item.id),
    );
    for (const option of options) {
      if (option.id && !existingIds.has(option.id)) {
        throw new UnprocessableEntityException(
          'شناسه گزینه متعلق به این نسخه نیست.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.menuItem.findMany({
        where: {
          menuVersionId: versionId,
          mealDate,
          mealType: dto.mealType,
        },
        orderBy: { displayOrder: 'asc' },
      });
      const keepIds = options
        .map((option) => option.id)
        .filter((id): id is string => !!id);
      await this.assertMenuItemsRemovable(
        tx,
        before
          .filter((item) => !keepIds.includes(item.id))
          .map((item) => item.id),
      );
      await tx.menuItem.deleteMany({
        where: {
          menuVersionId: versionId,
          mealDate,
          mealType: dto.mealType,
          ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
        },
      });
      const after: {
        id: string;
        title: string;
        displayOrder: number;
        isRice: boolean;
        mealDate: Date;
        mealType: string;
      }[] = [];
      for (const option of options) {
        const previous = option.id
          ? before.find((item) => item.id === option.id)
          : undefined;
        const isRice = await classifyMenuItem(tx, {
          title: option.title,
          previousNormalized: previous
            ? normalizeFoodName(previous.title)
            : undefined,
          previousIsRice: previous?.isRice,
          requestedIsRice: option.isRice,
        });
        if (option.id) {
          after.push(
            await tx.menuItem.update({
              where: { id: option.id },
              data: {
                title: option.title,
                displayOrder: option.displayOrder,
                mealDate,
                mealType: dto.mealType,
                isRice,
              },
            }),
          );
        } else {
          after.push(
            await tx.menuItem.create({
              data: {
                menuVersionId: versionId,
                mealDate,
                mealType: dto.mealType,
                title: option.title,
                displayOrder: option.displayOrder,
                isRice,
              },
            }),
          );
        }
      }
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.MealConfigured,
          entityType: AuditEntity.MenuVersion,
          entityId: versionId,
          beforeData: before,
          afterData: after,
        },
        tx,
      );
      const full = await tx.menuVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: {
          items: { orderBy: [{ mealDate: 'asc' }, { displayOrder: 'asc' }] },
        },
      });
      return presentVersion(full);
    });
  }

  async announce(actor: AuthUser, menuId: string, dto: AnnounceMenuDto) {
    const menu = await this.requireMenu(menuId);
    const title = dto.title.replace(/\s+/g, ' ').trim();
    const body = dto.body.replace(/\s+/g, ' ').trim();
    if (!title || !body) {
      throw new UnprocessableEntityException('عنوان و متن اعلام الزامی است.');
    }

    return this.prisma.$transaction(async (tx) => {
      const recipients = await tx.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      const announcedAt = new Date();
      if (recipients.length) {
        await tx.notification.createMany({
          data: recipients.map((user) => ({
            userId: user.id,
            type: MENU_PUBLISHED_NOTIFICATION,
            title,
            body,
            data: {
              page: 'menu',
              jalaliYear: menu.year,
              jalaliMonth: menu.month,
              menuId: menu.id,
            },
          })),
        });
      }
      const updated = await tx.menu.update({
        where: { id: menuId },
        data: {
          lastAnnouncedAt: announcedAt,
          lastAnnouncedBy: actor.id,
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.MenuPublicationAnnounced,
          entityType: AuditEntity.Menu,
          entityId: menuId,
          beforeData: {
            lastAnnouncedAt: menu.lastAnnouncedAt,
            lastAnnouncedBy: menu.lastAnnouncedBy,
          },
          afterData: {
            lastAnnouncedAt: announcedAt,
            lastAnnouncedBy: actor.id,
            recipientCount: recipients.length,
            title,
            body,
            jalaliYear: menu.year,
            jalaliMonth: menu.month,
          },
        },
        tx,
      );
      return {
        ...presentMenu(updated),
        recipientCount: recipients.length,
      };
    });
  }

  private async assertMenuItemsRemovable(
    tx: Prisma.TransactionClient,
    itemIds: string[],
  ) {
    if (!itemIds.length) {
      return;
    }
    const [cycles, guests] = await Promise.all([
      tx.orderCycle.findMany({
        where: {
          menuItemId: { in: itemIds },
          status: OrderCycleStatus.ACTIVE,
        },
        take: 5,
        select: {
          usernameSnapshot: true,
          mealDateSnapshot: true,
          mealTypeSnapshot: true,
          order: { select: { user: { select: { username: true, role: true } } } },
        },
      }),
      tx.guestOrder.findMany({
        where: {
          menuItemId: { in: itemIds },
          status: GuestOrderStatus.ACTIVE,
        },
        take: 5,
        select: {
          mealDate: true,
          mealType: true,
          buildingNameSnapshot: true,
        },
      }),
    ]);
    if (!cycles.length && !guests.length) {
      return;
    }
    const samples = [
      ...cycles.map((cycle) =>
        describeBlockingEmployeeOrder({
          username: cycle.order.user.username || cycle.usernameSnapshot,
          role: cycle.order.user.role,
          mealDate: cycle.mealDateSnapshot,
          mealType: cycle.mealTypeSnapshot,
        }),
      ),
      ...guests.map((guest) =>
        describeBlockingGuestOrder({
          buildingName: guest.buildingNameSnapshot,
          mealDate: guest.mealDate,
          mealType: guest.mealType,
        }),
      ),
    ];
    throw new UnprocessableEntityException(menuItemRemovalBlocked(samples));
  }

  private rethrowMenuMutationError(error: unknown): never {
    const meta =
      error && typeof error === 'object' && 'meta' in error
        ? JSON.stringify((error as { meta?: unknown }).meta)
        : '';
    const text = `${error instanceof Error ? error.message : String(error)} ${meta}`;
    if (
      text.includes('published menu versions are immutable') ||
      text.includes('historical published menu versions are immutable')
    ) {
      throw new UnprocessableEntityException(
        'نسخه‌های قدیمی منو قابل ویرایش نیستند. فقط نسخه جاری ذخیره می‌شود.',
      );
    }
    if (text.includes('each meal may have at most 3 menu items')) {
      throw new UnprocessableEntityException(
        'هر وعده حداکثر ۳ گزینه می‌تواند داشته باشد.',
      );
    }
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003') ||
      text.includes('cannot detach menu item from an active order cycle')
    ) {
      throw new UnprocessableEntityException(MENU_ITEM_ACTIVE_ORDER_FALLBACK);
    }
    throw error;
  }

  async requireMenu(id: string) {
    const menu = await this.prisma.menu.findUnique({ where: { id } });
    if (!menu) {
      throw new NotFoundException('منوی ماهانه پیدا نشد.');
    }
    return menu;
  }

  async requireVersion(menuId: string, versionId: string) {
    const version = await this.prisma.menuVersion.findFirst({
      where: { id: versionId, menuId },
      include: {
        menu: true,
        items: { orderBy: [{ mealDate: 'asc' }, { displayOrder: 'asc' }] },
      },
    });
    if (!version) {
      throw new NotFoundException('نسخه منو پیدا نشد.');
    }
    return version;
  }

  async requireLiveVersion(menuId: string, versionId: string) {
    const version = await this.requireVersion(menuId, versionId);
    const live = await this.prisma.menuVersion.findFirst({
      where: { menuId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true },
    });
    if (!live || live.id !== version.id) {
      throw new UnprocessableEntityException(
        'فقط نسخه جاری منو قابل ویرایش است.',
      );
    }
    return version;
  }

  async getPublished(year: number, month: number) {
    const menu = await this.prisma.menu.findUnique({
      where: { year_month: { year, month } },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            items: {
              orderBy: [{ mealDate: 'asc' }, { displayOrder: 'asc' }],
            },
          },
        },
      },
    });
    const live = menu?.versions[0];
    if (!menu || !live) {
      throw new NotFoundException('منویی برای این ماه وجود ندارد.');
    }
    return {
      ...presentMenu(menu),
      version: presentVersion(live),
    };
  }

  parseMenuDate(value: string, jalaliYear: number, jalaliMonth: number) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      throw new UnprocessableEntityException('تاریخ میلادی نامعتبر است.');
    }
    const gregorian = {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
    const utc = utcDateFromGregorian(gregorian);
    const check = gregorianFromUtcDate(utc);
    if (
      check.year !== gregorian.year ||
      check.month !== gregorian.month ||
      check.day !== gregorian.day
    ) {
      throw new UnprocessableEntityException('تاریخ میلادی نامعتبر است.');
    }
    const jalali = gregorianToJalali(
      gregorian.year,
      gregorian.month,
      gregorian.day,
    );
    if (!jalali || jalali.year !== jalaliYear || jalali.month !== jalaliMonth) {
      throw new UnprocessableEntityException(
        'تاریخ انتخاب‌شده داخل ماه منو نیست.',
      );
    }
    return utc;
  }
}
