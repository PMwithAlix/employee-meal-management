import type { BackendGuestOrder, GuestMealType, GuestOrderHistoryItem, GuestOrderStatus } from '../model/guest-types'

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function asIso(value: unknown) {
  if (typeof value === 'string') return value
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  return ''
}

function parseStatus(value: unknown): GuestOrderStatus | null {
  if (value === 'ACTIVE' || value === 'CANCELLED') return value
  return null
}

function parseMealType(value: unknown): GuestMealType | null {
  if (value === 'LUNCH' || value === 'DINNER') return value
  return null
}

function parseHistory(value: unknown): GuestOrderHistoryItem[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  const items: GuestOrderHistoryItem[] = []
  for (const entry of value) {
    const row = asRecord(entry)
    if (!row || typeof row.id !== 'string' || typeof row.actorId !== 'string') return null
    items.push({
      id: row.id,
      actorId: row.actorId,
      action: typeof row.action === 'string' ? row.action : '',
      createdAt: asIso(row.createdAt),
    })
  }
  return items
}

export function parseGuestOrder(value: unknown): BackendGuestOrder | null {
  const body = asRecord(value)
  if (!body || typeof body.id !== 'string' || typeof body.buildingId !== 'string') return null
  if (typeof body.mealDate !== 'string') return null
  const mealType = parseMealType(body.mealType)
  const status = parseStatus(body.status)
  if (!mealType || !status) return null
  if (typeof body.quantity !== 'number') return null
  if (typeof body.createdBy !== 'string') return null
  const history = parseHistory(body.history)
  if (!history) return null
  return {
    id: body.id,
    buildingId: body.buildingId,
    menuItemId: typeof body.menuItemId === 'string' ? body.menuItemId : null,
    menuVersionId: typeof body.menuVersionId === 'string' ? body.menuVersionId : null,
    mealDate: body.mealDate,
    jalaliDate: typeof body.jalaliDate === 'string' ? body.jalaliDate : null,
    mealType,
    quantity: body.quantity,
    note: typeof body.note === 'string' ? body.note : null,
    status,
    buildingNameSnapshot: typeof body.buildingNameSnapshot === 'string' ? body.buildingNameSnapshot : null,
    mealTitleSnapshot: typeof body.mealTitleSnapshot === 'string' ? body.mealTitleSnapshot : null,
    createdBy: body.createdBy,
    createdAt: asIso(body.createdAt),
    updatedAt: asIso(body.updatedAt),
    history,
  }
}
