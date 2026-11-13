export interface BuildingSummary {
  id: string
  name: string
}

export interface BuildingDetail extends BuildingSummary {
  usersCount: number | null
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export function parseBuilding(value: unknown): BuildingSummary | null {
  const body = asRecord(value)
  if (!body || typeof body.id !== 'string' || typeof body.name !== 'string') return null
  return { id: body.id, name: body.name }
}

export function parseBuildingDetail(value: unknown): BuildingDetail | null {
  const building = parseBuilding(value)
  if (!building) return null
  const body = asRecord(value)
  const count = asRecord(body?._count)
  return {
    ...building,
    usersCount: typeof count?.users === 'number' && Number.isInteger(count.users) ? count.users : null,
  }
}

export function activeMemberCount(members: Array<{ buildingId: string | null; isActive: boolean }>, buildingId: string) {
  return members.filter((item) => item.buildingId === buildingId && item.isActive).length
}
