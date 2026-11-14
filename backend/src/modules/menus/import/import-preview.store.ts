import { randomUUID } from 'crypto';
import type { ConfiguredMeal, ImportPolicy } from '../menu.types';
import type { ParsedWorkbook } from './menu-excel.parser';

export type ImportImpact = {
  matches: {
    publishedItemId: string;
    title: string;
    mealType: string;
    mealDate: string;
  }[];
  unmatchedPublished: {
    publishedItemId: string;
    title: string;
    mealType: string;
    mealDate: string;
  }[];
  unmatchedImported: { title: string; mealType: string; mealDate: string }[];
  ambiguous: {
    title: string;
    mealType: string;
    mealDate: string;
    reason: string;
  }[];
  activeOrderCount: number;
  atRiskOrderCount: number;
  atRiskOrders: { orderCycleId: string; menuItemId: string; title: string }[];
};

export type StoredImportPreview = {
  id: string;
  actorId: string;
  fingerprint: string;
  parsed: ParsedWorkbook;
  meals: ConfiguredMeal[];
  impact: ImportImpact;
  existingMenuId: string | null;
  expiresAt: number;
};

const TTL_MS = 15 * 60 * 1000;

export class ImportPreviewStore {
  private readonly items = new Map<string, StoredImportPreview>();

  create(
    input: Omit<StoredImportPreview, 'id' | 'expiresAt'> & { id?: string },
  ) {
    this.purge();
    const id = input.id ?? randomUUID();
    const stored: StoredImportPreview = {
      ...input,
      id,
      expiresAt: Date.now() + TTL_MS,
    };
    this.items.set(id, stored);
    return stored;
  }

  take(id: string, actorId: string) {
    this.purge();
    const stored = this.items.get(id);
    if (!stored || stored.actorId !== actorId) {
      return null;
    }
    this.items.delete(id);
    if (stored.expiresAt < Date.now()) {
      return null;
    }
    return stored;
  }

  peek(id: string) {
    this.purge();
    return this.items.get(id) ?? null;
  }

  private purge() {
    const now = Date.now();
    for (const [id, item] of this.items) {
      if (item.expiresAt < now) {
        this.items.delete(id);
      }
    }
  }
}

export function assertPolicy(policy: ImportPolicy, impact: ImportImpact) {
  if (policy === 'EXACT_MATCH_ONLY') {
    if (
      impact.unmatchedImported.length ||
      impact.unmatchedPublished.length ||
      impact.ambiguous.length
    ) {
      return 'سیاست تطبیق دقیق برقرار نیست؛ گزینه‌های بدون تطبیق یکتا وجود دارد.';
    }
  }
  if (policy === 'RESET' && impact.atRiskOrderCount > 0) {
    return 'سیاست بازنشانی به‌خاطر سفارش‌های موجود که به گزینه‌های حذف‌شونده ارجاع دارند رد شد.';
  }
  return '';
}
