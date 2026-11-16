import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MealType, MenuVersionStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditAction, AuditEntity } from '../../audit/audit.actions';
import { AuditService } from '../../audit/audit.service';
import type { AuthUser } from '../../../common/types/auth-user';
import { PrismaService } from '../../../database/prisma.service';
import {
  formatDateOnly,
  gregorianFromUtcDate,
  gregorianToJalali,
  utcDateFromGregorian,
} from '../../../common/calendar/jalali';
import { classifyMenuItem } from '../food-knowledge';
import { normalizeFoodName } from '../food-name';
import type { ConfiguredMeal, ImportPolicy } from '../menu.types';
import {
  presentConfiguredMeals,
  presentMenu,
  presentVersion,
} from '../menu.presenter';
import { liveVersionInclude, itemsFromLiveMenu } from '../live-menu';
import { normalizeOptionTitle, optionTitleIssue } from '../menu.validation';
import {
  assertPolicy,
  ImportImpact,
  ImportPreviewStore,
  StoredImportPreview,
} from './import-preview.store';
import { planLiveImport } from './live-import.plan';
import { MenuExcelParser } from './menu-excel.parser';
import type { UpdateImportMealDto } from '../dto/update-import-meal.dto';

type ItemRef = {
  id?: string;
  mealDate: Date;
  mealType: string;
  title: string;
  displayOrder?: number;
};

@Injectable()
export class MenuImportService {
  private readonly previews = new ImportPreviewStore();

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: MenuExcelParser,
    private readonly audit: AuditService,
  ) {}

  async preview(actor: AuthUser, buffer: Buffer) {
    const parsed = await this.parser.parse(buffer);
    const existing = await this.prisma.menu.findUnique({
      where: {
        year_month: { year: parsed.jalaliYear, month: parsed.jalaliMonth },
      },
      include: {
        versions: liveVersionInclude(),
        _count: { select: { versions: true } },
      },
    });

    const importedItems = parsed.meals.flatMap((meal) =>
      meal.options.map((option) => ({
        mealDate: meal.mealDate,
        mealType: meal.mealType,
        title: option.title,
        displayOrder: option.displayOrder,
      })),
    );
    const impact = await this.buildImpact(
      itemsFromLiveMenu(existing),
      importedItems,
    );
    const valid = parsed.errors.length === 0 && parsed.jalaliYear > 0;
    let importId: string | null = null;
    if (valid) {
      const stored = this.previews.create({
        actorId: actor.id,
        fingerprint: this.fingerprint(existing),
        parsed,
        meals: parsed.meals,
        impact,
        existingMenuId: existing?.id ?? null,
      });
      importId = stored.id;
    }

    await this.audit.record({
      actorId: actor.id,
      action: AuditAction.ExcelImportPreviewCreated,
      entityType: AuditEntity.MenuImport,
      entityId: importId ?? randomUUID(),
      afterData: {
        jalaliYear: parsed.jalaliYear,
        jalaliMonth: parsed.jalaliMonth,
        valid,
        errorCount: parsed.errors.length,
        lunchMealCount: parsed.lunchMealCount,
        dinnerMealCount: parsed.dinnerMealCount,
        optionCount: parsed.optionCount,
      },
    });

    return this.presentPreview({
      importId,
      valid,
      parsed,
      meals: parsed.meals,
      impact,
      existing,
      expiresAt: importId
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null,
    });
  }

  async updateMeal(actor: AuthUser, importId: string, dto: UpdateImportMealDto) {
    const stored = this.previews.peek(importId);
    if (!stored || stored.actorId !== actor.id) {
      throw new NotFoundException(
        'پیش‌نمایش واردسازی پیدا نشد یا منقضی شده است.',
      );
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dto.mealDate);
    if (!match) {
      throw new UnprocessableEntityException('تاریخ وعده نامعتبر است.');
    }
    const mealDate = utcDateFromGregorian({
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    });
    const gregorian = gregorianFromUtcDate(mealDate);
    const jalali = gregorianToJalali(gregorian.year, gregorian.month, gregorian.day);
    if (
      !jalali ||
      jalali.year !== stored.parsed.jalaliYear ||
      jalali.month !== stored.parsed.jalaliMonth
    ) {
      throw new UnprocessableEntityException(
        'فقط روزهای همان ماه فایل را می‌توان ویرایش کرد.',
      );
    }

    const options = dto.options.map((option, index) => {
      const title = normalizeOptionTitle(option.title);
      const issue = optionTitleIssue(title);
      if (issue) {
        throw new UnprocessableEntityException(issue);
      }
      return {
        title,
        displayOrder: option.displayOrder ?? index + 1,
      };
    });
    if (new Set(options.map((option) => option.title)).size !== options.length) {
      throw new UnprocessableEntityException('عنوان غذاها در یک وعده تکراری است.');
    }

    const nextMeals: ConfiguredMeal[] = stored.meals.filter(
      (meal) =>
        !(
          formatDateOnly(meal.mealDate) === dto.mealDate &&
          meal.mealType === dto.mealType
        ),
    );
    if (options.length) {
      nextMeals.push({
        mealDate,
        mealType: dto.mealType as MealType,
        options,
      });
    }
    nextMeals.sort(
      (a, b) =>
        a.mealDate.getTime() - b.mealDate.getTime() ||
        a.mealType.localeCompare(b.mealType),
    );

    const existing = await this.prisma.menu.findUnique({
      where: stored.existingMenuId
        ? { id: stored.existingMenuId }
        : {
            year_month: {
              year: stored.parsed.jalaliYear,
              month: stored.parsed.jalaliMonth,
            },
          },
      include: {
        versions: liveVersionInclude(),
        _count: { select: { versions: true } },
      },
    });
    const importedItems = nextMeals.flatMap((meal) =>
      meal.options.map((option) => ({
        mealDate: meal.mealDate,
        mealType: meal.mealType,
        title: option.title,
        displayOrder: option.displayOrder,
      })),
    );
    const impact = await this.buildImpact(
      itemsFromLiveMenu(existing),
      importedItems,
    );
    const updated = this.previews.replaceMeals(importId, actor.id, nextMeals);
    if (!updated) {
      throw new NotFoundException(
        'پیش‌نمایش واردسازی پیدا نشد یا منقضی شده است.',
      );
    }
    updated.impact = impact;

    return this.presentStored(updated, existing);
  }

  async confirm(actor: AuthUser, importId: string, policy: ImportPolicy) {
    const stored = this.previews.peek(importId);
    if (!stored || stored.actorId !== actor.id) {
      throw new NotFoundException(
        'پیش‌نمایش واردسازی پیدا نشد یا منقضی شده است.',
      );
    }

    const existing = await this.prisma.menu.findUnique({
      where: stored.existingMenuId
        ? { id: stored.existingMenuId }
        : {
            year_month: {
              year: stored.parsed.jalaliYear,
              month: stored.parsed.jalaliMonth,
            },
          },
      include: {
        versions: liveVersionInclude(),
        _count: { select: { versions: true } },
      },
    });
    if (this.fingerprint(existing) !== stored.fingerprint) {
      this.previews.take(importId, actor.id);
      await this.audit.record({
        actorId: actor.id,
        action: AuditAction.ExcelImportRejected,
        entityType: AuditEntity.MenuImport,
        entityId: importId,
        afterData: { reason: 'stale' },
      });
      throw new UnprocessableEntityException(
        'وضعیت منو از زمان پیش‌نمایش تغییر کرده است. دوباره فایل را بررسی کنید.',
      );
    }

    const importedItems = stored.meals.flatMap((meal) =>
      meal.options.map((option) => ({
        mealDate: meal.mealDate,
        mealType: meal.mealType,
        title: option.title,
        displayOrder: option.displayOrder,
      })),
    );
    const impact = await this.buildImpact(
      itemsFromLiveMenu(existing),
      importedItems,
    );
    const policyError = assertPolicy(policy, impact);
    if (policyError) {
      this.previews.take(importId, actor.id);
      await this.audit.record({
        actorId: actor.id,
        action: AuditAction.ExcelImportRejected,
        entityType: AuditEntity.MenuImport,
        entityId: importId,
        afterData: { policy, reason: policyError },
      });
      throw new UnprocessableEntityException({
        message: policyError,
        impact,
      });
    }

    this.previews.take(importId, actor.id);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const menu =
          existing ??
          (await tx.menu.create({
            data: {
              year: stored.parsed.jalaliYear,
              month: stored.parsed.jalaliMonth,
            },
          }));
        if (!existing) {
          await this.audit.record(
            {
              actorId: actor.id,
              action: AuditAction.MenuCreated,
              entityType: AuditEntity.Menu,
              entityId: menu.id,
              afterData: {
                year: menu.year,
                month: menu.month,
                via: 'excel-import',
              },
            },
            tx,
          );
        }

        let live = await tx.menuVersion.findFirst({
          where: { menuId: menu.id },
          orderBy: { versionNumber: 'desc' },
        });
        if (!live) {
          live = await tx.menuVersion.create({
            data: {
              menuId: menu.id,
              versionNumber: 1,
              status: MenuVersionStatus.PUBLISHED,
              publishedAt: new Date(),
              createdBy: actor.id,
            },
          });
        } else if (live.status !== MenuVersionStatus.PUBLISHED) {
          live = await tx.menuVersion.update({
            where: { id: live.id },
            data: {
              status: MenuVersionStatus.PUBLISHED,
              publishedAt: live.publishedAt ?? new Date(),
            },
          });
        }
        await tx.menu.update({
          where: { id: menu.id },
          data: {
            publishedVersionId: live.id,
            updatedAt: new Date(),
          },
        });

        const existingItems = await tx.menuItem.findMany({
          where: { menuVersionId: live.id },
        });
        const imported = stored.meals.flatMap((meal) =>
          meal.options.map((option) => ({
            mealDate: meal.mealDate,
            mealType: meal.mealType,
            title: option.title,
            displayOrder: option.displayOrder,
          })),
        );
        const plan = planLiveImport(existingItems, imported);
        const atRiskIds = new Set(
          impact.atRiskOrders.map((order) => order.menuItemId),
        );
        const deleteIds =
          policy === 'KEEP_EXISTING_ORDERS'
            ? plan.deletes.filter((id) => !atRiskIds.has(id))
            : plan.deletes;
        if (deleteIds.length) {
          await tx.menuItem.deleteMany({
            where: { id: { in: deleteIds }, menuVersionId: live.id },
          });
        }
        for (const item of plan.updates) {
          const previous = existingItems.find((row) => row.id === item.id);
          const isRice = await classifyMenuItem(tx, {
            title: item.title,
            previousNormalized: previous
              ? normalizeFoodName(previous.title)
              : undefined,
            previousIsRice: previous?.isRice,
          });
          await tx.menuItem.update({
            where: { id: item.id },
            data: {
              title: item.title,
              displayOrder: item.displayOrder,
              mealDate: item.mealDate,
              mealType: item.mealType as MealType,
              isRice,
            },
          });
        }
        for (const item of plan.creates) {
          await tx.menuItem.create({
            data: {
              menuVersionId: live.id,
              mealDate: item.mealDate,
              mealType: item.mealType as MealType,
              title: item.title,
              displayOrder: item.displayOrder,
              isRice: await classifyMenuItem(tx, { title: item.title }),
            },
          });
        }
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.ExcelImportConfirmed,
            entityType: AuditEntity.MenuVersion,
            entityId: live.id,
            afterData: {
              policy,
              importId,
              jalaliYear: stored.parsed.jalaliYear,
              jalaliMonth: stored.parsed.jalaliMonth,
              optionCount: stored.parsed.optionCount,
              matchCount: impact.matches.length,
              keptItemIds: plan.updates.map((item) => item.id),
            },
          },
          tx,
        );
        const full = await tx.menuVersion.findUniqueOrThrow({
          where: { id: live.id },
          include: {
            items: {
              orderBy: [{ mealDate: 'asc' }, { displayOrder: 'asc' }],
            },
            menu: true,
          },
        });
        return {
          menu: presentMenu(full.menu),
          version: presentVersion(full),
          policy,
          impact,
        };
      });
    } catch (error) {
      await this.audit.record({
        actorId: actor.id,
        action: AuditAction.ExcelImportRejected,
        entityType: AuditEntity.MenuImport,
        entityId: importId,
        afterData: { policy, reason: 'transaction-failed' },
      });
      throw error;
    }
  }

  private presentStored(
    stored: StoredImportPreview,
    existing: {
      id: string;
      publishedVersionId: string | null;
      updatedAt: Date;
      _count: { versions: number };
      versions: { id: string; items: unknown[] }[];
    } | null,
  ) {
    return this.presentPreview({
      importId: stored.id,
      valid: true,
      parsed: stored.parsed,
      meals: stored.meals,
      impact: stored.impact,
      existing,
      expiresAt: new Date(stored.expiresAt).toISOString(),
    });
  }

  private presentPreview(input: {
    importId: string | null;
    valid: boolean;
    parsed: StoredImportPreview['parsed'];
    meals: ConfiguredMeal[];
    impact: ImportImpact;
    existing: {
      id: string;
      publishedVersionId: string | null;
      updatedAt: Date;
      _count: { versions: number };
      versions: { id: string; items: unknown[] }[];
    } | null;
    expiresAt: string | null;
  }) {
    const live = input.existing?.versions[0];
    return {
      importId: input.importId,
      valid: input.valid,
      jalaliYear: input.parsed.jalaliYear,
      jalaliMonth: input.parsed.jalaliMonth,
      dateCount: input.parsed.dates.length,
      lunchMealCount: input.parsed.lunchMealCount,
      dinnerMealCount: input.parsed.dinnerMealCount,
      optionCount: input.parsed.optionCount,
      errors: input.parsed.errors,
      warnings: input.parsed.warnings,
      meals: input.valid ? presentConfiguredMeals(input.meals) : [],
      existing: input.existing
        ? {
            menuId: input.existing.id,
            currentVersionId: live?.id ?? input.existing.publishedVersionId,
            publishedVersionId: live?.id ?? input.existing.publishedVersionId,
            versionCount: input.existing._count.versions,
            publishedItemCount: live?.items.length ?? 0,
            currentItemCount: live?.items.length ?? 0,
          }
        : null,
      impact: input.impact,
      expiresAt: input.expiresAt,
    };
  }

  private fingerprint(
    menu: {
      id: string;
      updatedAt: Date;
      versions?: { id: string; items: unknown[] }[];
    } | null,
  ) {
    if (!menu) {
      return 'new';
    }
    const live = menu.versions?.[0];
    return `${menu.id}:${live?.id ?? 'none'}:${menu.updatedAt.toISOString()}:${live?.items.length ?? 0}`;
  }

  async buildImpact(
    publishedItems: ItemRef[],
    importedItems: ItemRef[],
  ): Promise<ImportImpact> {
    const plan = planLiveImport(
      publishedItems.map((item) => ({
        id: item.id,
        mealDate: item.mealDate,
        mealType: item.mealType,
        title: item.title,
        displayOrder: item.displayOrder ?? 0,
      })),
      importedItems.map((item) => ({
        mealDate: item.mealDate,
        mealType: item.mealType,
        title: item.title,
        displayOrder: item.displayOrder ?? 0,
      })),
    );
    const existingById = new Map(
      publishedItems
        .filter((item): item is ItemRef & { id: string } => !!item.id)
        .map((item) => [item.id, item]),
    );
    const matches: ImportImpact['matches'] = plan.updates.map((item) => ({
      publishedItemId: item.id,
      title: item.title,
      mealType: item.mealType,
      mealDate: formatDateOnly(item.mealDate),
    }));
    const unmatchedPublished: ImportImpact['unmatchedPublished'] = plan.deletes
      .map((id) => existingById.get(id))
      .filter((item): item is ItemRef & { id: string } => !!item?.id)
      .map((item) => ({
        publishedItemId: item.id,
        title: item.title,
        mealType: item.mealType,
        mealDate: formatDateOnly(item.mealDate),
      }));
    const unmatchedImported: ImportImpact['unmatchedImported'] = plan.creates.map(
      (item) => ({
        title: item.title,
        mealType: item.mealType,
        mealDate: formatDateOnly(item.mealDate),
      }),
    );
    const ambiguous: ImportImpact['ambiguous'] = [];

    const publishedIds = publishedItems
      .map((item) => item.id)
      .filter((id): id is string => !!id);
    const unmatchedIds = new Set(
      unmatchedPublished.map((item) => item.publishedItemId),
    );
    const cycles =
      publishedIds.length === 0
        ? []
        : await this.prisma.orderCycle.findMany({
            where: {
              menuItemId: { in: publishedIds },
              status: 'ACTIVE',
            },
            select: {
              id: true,
              menuItemId: true,
              mealTitleSnapshot: true,
            },
          });

    const atRiskOrders = cycles.flatMap((cycle) => {
      if (!cycle.menuItemId || !unmatchedIds.has(cycle.menuItemId)) {
        return [];
      }
      return [
        {
          orderCycleId: cycle.id,
          menuItemId: cycle.menuItemId,
          title: cycle.mealTitleSnapshot,
        },
      ];
    });

    return {
      matches,
      unmatchedPublished,
      unmatchedImported,
      ambiguous,
      activeOrderCount: cycles.length,
      atRiskOrderCount: atRiskOrders.length,
      atRiskOrders,
    };
  }

}
