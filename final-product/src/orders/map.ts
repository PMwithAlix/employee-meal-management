import { jalaliFromMealDate, toBackendMeal, toFrontendMeal } from '../menus/map'
import type { MealKind, Order } from '../types'
import type { BackendDeadline, BackendOrder, OrderCycleStatus } from './types'

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

export function parseDeadline(value: unknown): BackendDeadline | null {
  const body = asRecord(value)
  if (!body || typeof body.id !== 'string' || typeof body.mealDate !== 'string') return null
  if (body.mealType !== 'LUNCH' && body.mealType !== 'DINNER') return null
  if (typeof body.deadlineAt !== 'string') return null
  return {
    id: body.id,
    mealDate: body.mealDate,
    jalaliDate: typeof body.jalaliDate === 'string' ? body.jalaliDate : null,
    mealType: body.mealType,
    deadlineAt: body.deadlineAt,
    createdBy: typeof body.createdBy === 'string' ? body.createdBy : '',
  }
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
