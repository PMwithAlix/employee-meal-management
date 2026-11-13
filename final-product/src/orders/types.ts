import type { MealKind } from '../types'

export type BackendMealType = 'LUNCH' | 'DINNER'
export type OrderCycleStatus = 'ACTIVE' | 'CANCELLED'

export const ORDER_ENDPOINTS = {
  create: '/orders',
  list: '/orders',
  me: '/orders/me',
  one: (id: string) => `/orders/me/${id}`,
  cancel: (id: string) => `/orders/me/${id}/cancel`,
  managed: (id: string) => `/orders/${id}`,
  managedCancel: (id: string) => `/orders/${id}/cancel`,
  rating: (id: string) => `/orders/me/${id}/rating`,
  ratings: '/ratings',
  mealSettings: '/meal-settings',
  deadlines: (year: number, month: number) => `/order-deadlines/${year}/${month}`,
} as const

export type BackendOrderCycle = {
  id: string
  cycleNumber: number
  menuItemId: string
  menuVersionId: string
  optionTitle: string
  usernameSnapshot: string
  buildingIdSnapshot: string | null
  buildingNameSnapshot: string | null
  mealDateSnapshot: string
  mealTypeSnapshot: BackendMealType
  status: OrderCycleStatus
  createdAt: string
  groups: Array<{ groupId: string; groupNameSnapshot: string }>
  statusHistory: Array<{
    id: string
    oldStatus: OrderCycleStatus | null
    newStatus: OrderCycleStatus
    actorId: string | null
    reason: string | null
    createdAt: string
  }>
}

export type BackendOrderRating = {
  id: string
  score: number
  comment: string | null
  createdAt: string
  updatedAt: string
}

export type BackendOrder = {
  id: string
  userId: string
  mealDate: string
  jalaliDate: string | null
  mealType: BackendMealType
  quantity: number
  createdAt: string
  updatedAt: string
  status: OrderCycleStatus | null
  currentCycle: BackendOrderCycle | null
  rating: BackendOrderRating | null
}

export type OrderListResponse = {
  items: BackendOrder[]
  total: number
  page: number
  pageSize: number
}

export type BackendDeadline = {
  id: string
  mealDate: string
  jalaliDate: string | null
  mealType: BackendMealType
  deadlineAt: string | null
  createdBy: string
}

export type CreateOrderBody = {
  userId?: string
  mealDate: string
  mealType: BackendMealType
  menuItemId: string
}

export type ManagedOrderQuery = {
  page?: number
  pageSize?: number
  mealDate?: string
  from?: string
  to?: string
  mealType?: BackendMealType
  userId?: string
  buildingId?: string
  groupId?: string
  username?: string
  status?: OrderCycleStatus
}

export type UpsertRatingBody = {
  score: number
  comment?: string
}

export type BackendMealSetting = {
  id: string
  mealType: BackendMealType
  servingTime: string
  updatedBy: string
  updatedAt: string
}

export type BackendStaffRating = {
  id: string
  orderId: string
  orderCycleId: string
  score: number
  comment: string | null
  createdAt: string
  updatedAt: string
  userId: string | null
  mealDate: string | null
  jalaliDate: string | null
  mealType: BackendMealType | null
  usernameSnapshot: string | null
  mealTitleSnapshot: string | null
  buildingNameSnapshot: string | null
  cycleStatus: OrderCycleStatus | null
}

export type { MealKind }
