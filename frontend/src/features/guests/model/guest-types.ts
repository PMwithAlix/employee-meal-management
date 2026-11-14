export type GuestOrderStatus = 'ACTIVE' | 'CANCELLED'
export type GuestOrderAction = 'CREATED' | 'UPDATED' | 'CANCELLED'
export type GuestMealType = 'LUNCH' | 'DINNER'

export interface GuestOrderHistoryItem {
  id: string
  actorId: string
  action: string
  createdAt: string
}

export interface BackendGuestOrder {
  id: string
  buildingId: string
  menuItemId: string | null
  menuVersionId: string | null
  mealDate: string
  jalaliDate: string | null
  mealType: GuestMealType
  quantity: number
  note: string | null
  status: GuestOrderStatus
  buildingNameSnapshot: string | null
  mealTitleSnapshot: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  history: GuestOrderHistoryItem[]
}

export interface GuestListQuery {
  page?: number
  pageSize?: number
  mealDate?: string
  mealType?: GuestMealType
  buildingId?: string
  status?: GuestOrderStatus
  sortOrder?: 'asc' | 'desc'
}

export interface CreateGuestOrderBody {
  buildingId: string
  mealDate: string
  mealType: GuestMealType
  menuItemId: string
  quantity: number
  note?: string
}

export interface UpdateGuestOrderBody {
  menuItemId?: string
  quantity?: number
  note?: string | null
}

export const GUEST_ENDPOINTS = {
  list: '/guest-orders',
  one: (id: string) => `/guest-orders/${id}`,
  cancel: (id: string) => `/guest-orders/${id}/cancel`,
} as const
