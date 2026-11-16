export function itemsFromLiveMenu<T>(menu: {
  versions?: Array<{ items?: T[] }>;
} | null): T[] {
  return menu?.versions?.[0]?.items ?? [];
}

export function liveVersionInclude(itemWhere?: Record<string, unknown>) {
  return {
    orderBy: { versionNumber: 'desc' as const },
    take: 1,
    include: {
      items: {
        ...(itemWhere ? { where: itemWhere } : {}),
        orderBy: [
          { mealDate: 'asc' as const },
          { mealType: 'asc' as const },
          { displayOrder: 'asc' as const },
        ],
      },
    },
  };
}
