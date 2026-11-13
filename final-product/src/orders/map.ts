import { jalaliFromMealDate, toBackendMeal, toFrontendMeal } from '../menus/map'
import type { MealDeadlineState } from '../lib/orders'
import type { MealKind, Order } from '../types'
import type { BackendDeadline, BackendMealSetting, BackendOrder, BackendStaffRating, OrderCycleStatus } from './types'

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export function parseCycleStatus(value: unknown): OrderCycleStatus | null {
  if (value === 'ACTIVE' || value === 'CANCELLED') return value
  return null
}

export function parseBackendOrder(value: unknown): BackendOrder | null {
  const body = asRecord(value)
  if (!body || typeof body.id !== 'string' || typeof body.userId !== 'string') return null
  if (typeof body.mealDate !== 'string') return null
  if (body.mealType !== 'LUNCH' && body.mealType !== 'DINNER') return null
  const cycle = asRecord(body.currentCycle)
  const rating = asRecord(body.rating)
  return {
    id: body.id,
    userId: body.userId,
    mealDate: body.mealDate,
    jalaliDate: typeof body.jalaliDate === 'string' ? body.jalaliDate : null,
    mealType: body.mealType,
    quantity: typeof body.quantity === 'number' ? body.quantity : 1,
    createdAt: typeof body.createdAt === 'string' ? body.createdAt : '',
    updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : '',
    status: parseCycleStatus(body.status),
    currentCycle: cycle && typeof cycle.id === 'string' && typeof cycle.menuItemId === 'string' && typeof cycle.optionTitle === 'string'
      ? {
          id: cycle.id,
          cycleNumber: typeof cycle.cycleNumber === 'number' ? cycle.cycleNumber : 1,
          menuItemId: cycle.menuItemId,
          menuVersionId: typeof cycle.menuVersionId === 'string' ? cycle.menuVersionId : '',
          optionTitle: cycle.optionTitle,
          usernameSnapshot: typeof cycle.usernameSnapshot === 'string' ? cycle.usernameSnapshot : '',
          buildingIdSnapshot: typeof cycle.buildingIdSnapshot === 'string' ? cycle.buildingIdSnapshot : null,
          buildingNameSnapshot: typeof cycle.buildingNameSnapshot === 'string' ? cycle.buildingNameSnapshot : null,
          mealDateSnapshot: typeof cycle.mealDateSnapshot === 'string' ? cycle.mealDateSnapshot : body.mealDate,
          mealTypeSnapshot: cycle.mealTypeSnapshot === 'DINNER' ? 'DINNER' : 'LUNCH',
          status: parseCycleStatus(cycle.status) ?? 'ACTIVE',
          createdAt: typeof cycle.createdAt === 'string' ? cycle.createdAt : '',
          groups: Array.isArray(cycle.groups)
            ? cycle.groups.flatMap((item) => {
                const group = asRecord(item)
                if (!group || typeof group.groupId !== 'string') return []
                return [{ groupId: group.groupId, groupNameSnapshot: typeof group.groupNameSnapshot === 'string' ? group.groupNameSnapshot : '' }]
              })
            : [],
        }
      : null,
    rating: rating && typeof rating.id === 'string' && typeof rating.score === 'number'
      ? {
          id: rating.id,
          score: rating.score,
          comment: typeof rating.comment === 'string' ? rating.comment : null,
          createdAt: typeof rating.createdAt === 'string' ? rating.createdAt : '',
          updatedAt: typeof rating.updatedAt === 'string' ? rating.updatedAt : '',
        }
      : null,
  }
}

export function toUiOrder(payload: BackendOrder): Order | null {
  const date = jalaliFromMealDate(payload.mealDate)
  const meal = toFrontendMeal(payload.mealType)
  if (!date || !meal) return null
  const active = payload.status === 'ACTIVE' && payload.currentCycle
  return {
    id: payload.id,
    employeeId: payload.userId,
    buildingId: payload.currentCycle?.buildingIdSnapshot ?? '',
    jy: date.jy,
    jm: date.jm,
    jd: date.jd,
    meal,
    choice: active ? payload.currentCycle!.optionTitle : null,
    snapshotTitle: payload.currentCycle?.optionTitle ?? null,
    menuItemId: active ? payload.currentCycle!.menuItemId : null,
    cycleStatus: payload.status,
    rating: payload.rating
      ? { score: payload.rating.score, comment: payload.rating.comment ?? '' }
      : null,
  }
}

export function parseStaffRating(value: unknown): BackendStaffRating | null {
  const body = asRecord(value)
  if (!body || typeof body.id !== 'string' || typeof body.orderId !== 'string') return null
  if (typeof body.score !== 'number' || !Number.isInteger(body.score) || body.score < 1 || body.score > 5) return null
  const mealType = body.mealType === 'LUNCH' || body.mealType === 'DINNER' ? body.mealType : null
  return {
    id: body.id,
    orderId: body.orderId,
    orderCycleId: typeof body.orderCycleId === 'string' ? body.orderCycleId : '',
    score: body.score,
    comment: typeof body.comment === 'string' ? body.comment : null,
    createdAt: typeof body.createdAt === 'string' ? body.createdAt : '',
    updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : '',
    userId: typeof body.userId === 'string' ? body.userId : null,
    mealDate: typeof body.mealDate === 'string' ? body.mealDate : null,
    jalaliDate: typeof body.jalaliDate === 'string' ? body.jalaliDate : null,
    mealType,
    usernameSnapshot: typeof body.usernameSnapshot === 'string' ? body.usernameSnapshot : null,
    mealTitleSnapshot: typeof body.mealTitleSnapshot === 'string' ? body.mealTitleSnapshot : null,
    buildingNameSnapshot: typeof body.buildingNameSnapshot === 'string' ? body.buildingNameSnapshot : null,
    cycleStatus: parseCycleStatus(body.cycleStatus),
  }
}

export function parseMealSetting(value: unknown): BackendMealSetting | null {
  const body = asRecord(value)
  if (!body || typeof body.id !== 'string') return null
  if (body.mealType !== 'LUNCH' && body.mealType !== 'DINNER') return null
  if (typeof body.servingTime !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(body.servingTime)) return null
  return {
    id: body.id,
    mealType: body.mealType,
    servingTime: body.servingTime,
    updatedBy: typeof body.updatedBy === 'string' ? body.updatedBy : '',
    updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : '',
  }
}

export function mealServingsFromSettings(rows: BackendMealSetting[]) {
  const next = { lunch: '', dinner: '' }
  for (const row of rows) {
    if (row.mealType === 'LUNCH') next.lunch = row.servingTime
    if (row.mealType === 'DINNER') next.dinner = row.servingTime
  }
  return next
}

export function uiRatingFromStaff(rating: Pick<BackendStaffRating, 'score' | 'comment'>) {
  return { score: rating.score, comment: rating.comment ?? '' }
}

export function parseDeadline(value: unknown): BackendDeadline | null {
  const body = asRecord(value)
  if (!body || typeof body.mealDate !== 'string') return null
  if (body.mealType !== 'LUNCH' && body.mealType !== 'DINNER') return null
  const id = typeof body.id === 'string' ? body.id : ''
  const jalaliDate = typeof body.jalaliDate === 'string' ? body.jalaliDate : null
  const createdBy = typeof body.createdBy === 'string' ? body.createdBy : ''
  const deadlineAt = typeof body.deadlineAt === 'string' && !Number.isNaN(Date.parse(body.deadlineAt)) ? body.deadlineAt : null
  if (deadlineAt && !id) return null
  return {
    id,
    mealDate: body.mealDate,
    jalaliDate,
    mealType: body.mealType,
    deadlineAt,
    createdBy,
  }
}

export function toDeadlineMap(rows: BackendDeadline[]) {
  const next: Record<string, string | null> = {}
  for (const row of rows) next[deadlineKey(row.mealDate, row.mealType)] = row.deadlineAt
  return next
}

export function mealDeadlineFromMap(
  map: Record<string, string | null>,
  ready: boolean,
  mealDate: string,
  meal: MealKind,
): MealDeadlineState {
  if (!ready) return 'unknown'
  const key = deadlineKey(mealDate, meal)
  if (!Object.prototype.hasOwnProperty.call(map, key)) return 'absent'
  const at = map[key]
  if (at == null || Number.isNaN(Date.parse(at))) return 'unknown'
  return { at }
}

export function deadlineKey(mealDate: string, mealType: 'LUNCH' | 'DINNER' | MealKind) {
  const type = mealType === 'lunch' || mealType === 'LUNCH' ? 'LUNCH' : 'DINNER'
  return `${mealDate}:${type}`
}

export function isDeadlineOpen(deadlineAt: string, now = new Date()) {
  const at = Date.parse(deadlineAt)
  if (Number.isNaN(at)) return false
  return now.getTime() < at
}

export { toBackendMeal, toFrontendMeal }
