export function normalizeBuildingName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export function isDuplicateBuildingName(
  name: string,
  buildings: Array<{ id: string; name: string }>,
  ignoreId?: string,
) {
  const key = normalizeBuildingName(name).toLocaleLowerCase('fa-IR')
  if (!key) return false
  return buildings.some((item) => (
    item.id !== ignoreId
    && normalizeBuildingName(item.name).toLocaleLowerCase('fa-IR') === key
  ))
}
