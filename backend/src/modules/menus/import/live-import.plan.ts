import { formatDateOnly } from '../../../common/calendar/jalali';
import { normalizeOptionTitle } from '../menu.validation';

export type LiveImportItem = {
  id?: string;
  mealDate: Date;
  mealType: string;
  title: string;
  displayOrder: number;
};

export type LiveImportPlan = {
  updates: Array<Required<Pick<LiveImportItem, 'id'>> & LiveImportItem>;
  creates: LiveImportItem[];
  deletes: string[];
};

function mealKey(item: Pick<LiveImportItem, 'mealDate' | 'mealType'>) {
  return `${formatDateOnly(item.mealDate)}:${item.mealType}`;
}

function titleKey(item: Pick<LiveImportItem, 'mealDate' | 'mealType' | 'title'>) {
  return `${mealKey(item)}:${normalizeOptionTitle(item.title)}`;
}

function slotKey(item: Pick<LiveImportItem, 'mealDate' | 'mealType' | 'displayOrder'>) {
  return `${mealKey(item)}:${item.displayOrder}`;
}

export function planLiveImport(
  existing: LiveImportItem[],
  imported: LiveImportItem[],
): LiveImportPlan {
  const updates: LiveImportPlan['updates'] = [];
  const usedExisting = new Set<string>();
  const usedImported = new Set<number>();

  const existingByTitle = new Map<string, LiveImportItem[]>();
  for (const item of existing) {
    if (!item.id) continue;
    const key = titleKey(item);
    const list = existingByTitle.get(key) ?? [];
    list.push(item);
    existingByTitle.set(key, list);
  }

  imported.forEach((item, index) => {
    const candidates = (existingByTitle.get(titleKey(item)) ?? []).filter(
      (candidate) => candidate.id && !usedExisting.has(candidate.id),
    );
    if (candidates.length !== 1 || !candidates[0].id) {
      return;
    }
    updates.push({
      id: candidates[0].id,
      mealDate: item.mealDate,
      mealType: item.mealType,
      title: item.title,
      displayOrder: item.displayOrder,
    });
    usedExisting.add(candidates[0].id);
    usedImported.add(index);
  });

  const existingBySlot = new Map<string, LiveImportItem[]>();
  for (const item of existing) {
    if (!item.id || usedExisting.has(item.id)) continue;
    const key = slotKey(item);
    const list = existingBySlot.get(key) ?? [];
    list.push(item);
    existingBySlot.set(key, list);
  }

  imported.forEach((item, index) => {
    if (usedImported.has(index)) return;
    const candidates = (existingBySlot.get(slotKey(item)) ?? []).filter(
      (candidate) => candidate.id && !usedExisting.has(candidate.id),
    );
    if (candidates.length !== 1 || !candidates[0].id) {
      return;
    }
    updates.push({
      id: candidates[0].id,
      mealDate: item.mealDate,
      mealType: item.mealType,
      title: item.title,
      displayOrder: item.displayOrder,
    });
    usedExisting.add(candidates[0].id);
    usedImported.add(index);
  });

  const creates = imported.filter((_, index) => !usedImported.has(index));
  const deletes = existing
    .map((item) => item.id)
    .filter((id): id is string => !!id && !usedExisting.has(id));

  return { updates, creates, deletes };
}
