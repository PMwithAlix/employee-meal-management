import type { MealKind } from '../types'

export type BackendMealType = 'LUNCH' | 'DINNER'
export type OrderCycleStatus = 'ACTIVE' | 'CANCELLED'

export const ORDER_ENDPOINTS = {
  create: '/orders',
  me: '/orders/me',
  one: (id: string) => `/orders/me/${id}`,
  cancel: (id: string) => `/orders/me/${id}/cancel`,
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
  deadlineAt: string
  createdBy: string
}

export type CreateOrderBody = {
  mealDate: string
  mealType: BackendMealType
  menuItemId: string
}

export type { MealKind }
