import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MenuVersionStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditAction, AuditEntity } from '../../audit/audit.actions';
import { AuditService } from '../../audit/audit.service';
import type { AuthUser } from '../../../common/types/auth-user';
import { PrismaService } from '../../../database/prisma.service';
import { formatDateOnly } from '../../../common/calendar/jalali';
import type { ImportPolicy } from '../menu.types';
import { presentMenu, presentVersion } from '../menu.presenter';
import { normalizeOptionTitle } from '../menu.validation';
import {
  assertPolicy,
  ImportImpact,
  ImportPreviewStore,
} from './import-preview.store';
import { MenuExcelParser } from './menu-excel.parser';

type ItemRef = {
  id?: string;
  mealDate: Date;
  mealType: string;
  title: string;
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
        publishedVersion: { include: { items: true } },
        _count: { select: { versions: true } },
      },
    });

    const importedItems = parsed.meals.flatMap((meal) =>
      meal.options.map((option) => ({
        mealDate: meal.mealDate,
        mealType: meal.mealType,
        title: option.title,
      })),
    );
    const impact = await this.buildImpact(
      existing?.publishedVersion?.items ?? [],
      importedItems,
    );
    const valid = parsed.errors.length === 0 && parsed.jalaliYear > 0;
    let importId: string | null = null;
    if (valid) {
      const stored = this.previews.create({
        actorId: actor.id,
        fingerprint: this.fingerprint(existing, existing?._count.versions ?? 0),
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

    return {
      importId,
      valid,
      jalaliYear: parsed.jalaliYear,
      jalaliMonth: parsed.jalaliMonth,
      dateCount: parsed.dates.length,
      lunchMealCount: parsed.lunchMealCount,
      dinnerMealCount: parsed.dinnerMealCount,
      optionCount: parsed.optionCount,
      errors: parsed.errors,
      warnings: parsed.warnings,
      existing: existing
        ? {
            menuId: existing.id,
            publishedVersionId: existing.publishedVersionId,
            versionCount: existing._count.versions,
            publishedItemCount: existing.publishedVersion?.items.length ?? 0,
          }
        : null,
      impact,
      expiresAt: importId
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null,
    };
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
        publishedVersion: { include: { items: true } },
        _count: { select: { versions: true } },
      },
    });
    if (
      this.fingerprint(existing, existing?._count.versions ?? 0) !==
      stored.fingerprint
    ) {
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
      })),
    );
    const impact = await this.buildImpact(
      existing?.publishedVersion?.items ?? [],
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

        const aggregate = await tx.menuVersion.aggregate({
          where: { menuId: menu.id },
          _max: { versionNumber: true },
        });
        const created = await tx.menuVersion.create({
          data: {
            menuId: menu.id,
            versionNumber: (aggregate._max.versionNumber ?? 0) + 1,
            status: MenuVersionStatus.DRAFT,
            createdBy: actor.id,
          },
        });
        await tx.menuItem.createMany({
          data: stored.meals.flatMap((meal) =>
            meal.options.map((option) => ({
              menuVersionId: created.id,
              mealDate: meal.mealDate,
              mealType: meal.mealType,
              title: option.title,
              displayOrder: option.displayOrder,
            })),
          ),
        });
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.ExcelImportConfirmed,
            entityType: AuditEntity.MenuVersion,
            entityId: created.id,
            afterData: {
              policy,
              importId,
              jalaliYear: stored.parsed.jalaliYear,
              jalaliMonth: stored.parsed.jalaliMonth,
              optionCount: stored.parsed.optionCount,
              matchCount: impact.matches.length,
            },
          },
          tx,
        );
        const full = await tx.menuVersion.findUniqueOrThrow({
          where: { id: created.id },
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

  private fingerprint(
    menu: { id: string; publishedVersionId: string | null } | null,
    versionCount: number,
  ) {
    if (!menu) {
      return 'new';
    }
    return `${menu.id}:${menu.publishedVersionId ?? 'none'}:${versionCount}`;
  }

  async buildImpact(
    publishedItems: ItemRef[],
    importedItems: ItemRef[],
  ): Promise<ImportImpact> {
    const publishedMap = new Map<string, ItemRef[]>();
    for (const item of publishedItems) {
      const key = this.optionKey(item);
      const list = publishedMap.get(key) ?? [];
      list.push(item);
      publishedMap.set(key, list);
    }
    const importedMap = new Map<string, ItemRef[]>();
    for (const item of importedItems) {
      const key = this.optionKey(item);
      const list = importedMap.get(key) ?? [];
      list.push(item);
      importedMap.set(key, list);
    }

    const matches: ImportImpact['matches'] = [];
    const unmatchedPublished: ImportImpact['unmatchedPublished'] = [];
    const unmatchedImported: ImportImpact['unmatchedImported'] = [];
    const ambiguous: ImportImpact['ambiguous'] = [];

    for (const [key, list] of publishedMap) {
      const incoming = importedMap.get(key) ?? [];
      if (list.length === 1 && incoming.length === 1 && list[0].id) {
        matches.push({
          publishedItemId: list[0].id,
          title: list[0].title,
          mealType: list[0].mealType,
          mealDate: formatDateOnly(list[0].mealDate),
        });
      } else if (incoming.length > 1 || list.length > 1) {
        ambiguous.push({
          title: list[0].title,
          mealType: list[0].mealType,
          mealDate: formatDateOnly(list[0].mealDate),
          reason: 'تطبیق غیریکتا',
        });
      } else if (incoming.length === 0) {
        for (const item of list) {
          if (!item.id) {
            continue;
          }
          unmatchedPublished.push({
            publishedItemId: item.id,
            title: item.title,
            mealType: item.mealType,
            mealDate: formatDateOnly(item.mealDate),
          });
        }
      }
    }

    for (const [key, list] of importedMap) {
      if (!publishedMap.has(key)) {
        for (const item of list) {
          unmatchedImported.push({
            title: item.title,
            mealType: item.mealType,
            mealDate: formatDateOnly(item.mealDate),
          });
        }
      }
    }

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

    const atRiskOrders = cycles
      .filter((cycle) => unmatchedIds.has(cycle.menuItemId))
      .map((cycle) => ({
        orderCycleId: cycle.id,
        menuItemId: cycle.menuItemId,
        title: cycle.mealTitleSnapshot,
      }));

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

  private optionKey(item: ItemRef) {
    return `${formatDateOnly(item.mealDate)}:${item.mealType}:${normalizeOptionTitle(item.title)}`;
  }
}
