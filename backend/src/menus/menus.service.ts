import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MenuVersionStatus, Prisma } from '@prisma/client';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../database/prisma.service';
import {
  gregorianFromUtcDate,
  gregorianToJalali,
  isValidJalaliMonth,
  utcDateFromGregorian,
} from '../dates/jalali';
import { CreateMenuDto } from './dto/create-menu.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { ListMenusQueryDto } from './dto/list-menus.query';
import { UpsertMealDto } from './dto/upsert-meal.dto';
import { presentMenu, presentVersion } from './menu.presenter';
import {
  groupItemsAsMeals,
  normalizeOptionTitle,
  validateConfiguredMeals,
} from './menu.validation';

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
    const version = await this.requireDraft(menuId, versionId);
    const mealDate = this.parseMenuDate(
      dto.mealDate,
      version.menu.year,
      version.menu.month,
    );
    const options = dto.options.map((option, index) => ({
      id: option.id,
      title: normalizeOptionTitle(option.title),
      displayOrder: option.displayOrder ?? index + 1,
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
      await tx.menuItem.deleteMany({
        where: {
          menuVersionId: versionId,
          mealDate,
          mealType: dto.mealType,
          id: {
            notIn: options
              .map((option) => option.id)
              .filter((id): id is string => !!id),
          },
        },
      });
      const after: {
        id: string;
        title: string;
        displayOrder: number;
        mealDate: Date;
        mealType: string;
      }[] = [];
      for (const option of options) {
        if (option.id) {
          after.push(
            await tx.menuItem.update({
              where: { id: option.id },
              data: {
                title: option.title,
                displayOrder: option.displayOrder,
                mealDate,
                mealType: dto.mealType,
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

  async publish(actor: AuthUser, menuId: string, versionId: string) {
    const menu = await this.requireMenu(menuId);
    const version = await this.requireVersion(menuId, versionId);
    if (version.status !== MenuVersionStatus.DRAFT) {
      throw new UnprocessableEntityException(
        'فقط نسخه پیش‌نویس قابل انتشار است.',
      );
    }
    const meals = groupItemsAsMeals(version.items);
    const issues = validateConfiguredMeals(meals, menu.year, menu.month);
    if (issues.length) {
      throw new UnprocessableEntityException({
        message: 'نسخه برای انتشار معتبر نیست.',
        errors: issues,
      });
    }
    if (meals.length === 0) {
      throw new UnprocessableEntityException({
        message: 'نسخه برای انتشار معتبر نیست.',
        errors: [{ message: 'نسخه خالی قابل انتشار نیست.' }],
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.menuVersion.findUniqueOrThrow({
          where: { id: versionId },
        });
        if (current.status !== MenuVersionStatus.DRAFT) {
          throw new UnprocessableEntityException(
            'فقط نسخه پیش‌نویس قابل انتشار است.',
          );
        }
        const published = await tx.menuVersion.update({
          where: { id: versionId },
          data: {
            status: MenuVersionStatus.PUBLISHED,
            publishedAt: new Date(),
          },
          include: { items: true },
        });
        await tx.menu.update({
          where: { id: menuId },
          data: { publishedVersionId: versionId },
        });
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.MenuVersionPublished,
            entityType: AuditEntity.MenuVersion,
            entityId: versionId,
            beforeData: {
              previousPublishedVersionId: menu.publishedVersionId,
              status: MenuVersionStatus.DRAFT,
            },
            afterData: {
              status: published.status,
              versionNumber: published.versionNumber,
            },
          },
          tx,
        );
        return presentVersion(published);
      });
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }
      throw error;
    }
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

  async requireDraft(menuId: string, versionId: string) {
    const version = await this.requireVersion(menuId, versionId);
    if (version.status !== MenuVersionStatus.DRAFT) {
      throw new UnprocessableEntityException('نسخه منتشرشده قابل ویرایش نیست.');
    }
    return version;
  }

  async getPublished(year: number, month: number) {
    const menu = await this.prisma.menu.findUnique({
      where: { year_month: { year, month } },
      include: {
        publishedVersion: {
          include: {
            items: {
              orderBy: [{ mealDate: 'asc' }, { displayOrder: 'asc' }],
            },
          },
        },
      },
    });
    if (!menu?.publishedVersion) {
      throw new NotFoundException('منوی منتشرشده‌ای برای این ماه وجود ندارد.');
    }
    return {
      ...presentMenu(menu),
      version: presentVersion(menu.publishedVersion),
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
