export function orderPageOrderBy(sortOrder: 'asc' | 'desc') {
  return [{ createdAt: sortOrder }, { id: 'asc' as const }];
}
