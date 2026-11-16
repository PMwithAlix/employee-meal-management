import type { MealKind, ReplacePolicy } from '../../../shared/types/domain'

export type BackendMealType = 'LUNCH' | 'DINNER'
export type MenuVersionStatus = 'DRAFT' | 'PUBLISHED'

export type MenuOption = {
  id: string
  title: string
  displayOrder: number
}

export type MenuDay = {
  jy: number
  jm: number
  jd: number
  weekday: string
  mealDate: string
  lunch: MenuOption[] | null
  dinner: MenuOption[] | null
}

export type MenuSummary = {
  id: string
  jalaliYear: number
  jalaliMonth: number
  publishedVersionId: string | null
  lastAnnouncedAt?: string | null
  lastAnnouncedBy?: string | null
  versionCount?: number
}

export type MenuAnnouncementResult = MenuSummary & {
  recipientCount: number
}

export type MenuVersionSummary = {
  id: string
  menuId: string
  versionNumber: number
  status: MenuVersionStatus
  publishedAt: string | null
  createdBy: string
  createdAt: string
}

export type MenuVersionDetail = MenuVersionSummary & {
  meals: BackendMeal[]
}

export type BackendMeal = {
  mealDate: string
  jalaliDate: string | null
  mealType: BackendMealType
  options: MenuOption[]
}

export type PublishedMenu = MenuSummary & {
  version: MenuVersionDetail
}

export type MenuListResponse = {
  items: MenuSummary[]
  total: number
  page: number
  pageSize: number
}

export type ImportIssue = {
  sheet?: string
  row?: number
  field?: string
  message: string
}

export type ImportImpact = {
  matches: unknown[]
  unmatchedPublished: unknown[]
  unmatchedImported: unknown[]
  ambiguous: unknown[]
  activeOrderCount: number
  atRiskOrderCount: number
  atRiskOrders: Array<{ orderCycleId: string; menuItemId: string; title: string }>
}

export type ImportPreview = {
  importId: string | null
  valid: boolean
  jalaliYear: number
  jalaliMonth: number
  dateCount: number
  lunchMealCount: number
  dinnerMealCount: number
  optionCount: number
  errors: ImportIssue[]
  warnings: ImportIssue[]
  meals: BackendMeal[]
  existing: {
    menuId: string
    publishedVersionId: string | null
    versionCount: number
    publishedItemCount: number
  } | null
  impact: ImportImpact | null
  expiresAt: string | null
}

export type ImportConfirmResult = {
  menu: MenuSummary
  version: MenuVersionDetail
  policy: string
  impact: ImportImpact
}

export type BackendImportPolicy = 'KEEP_EXISTING_ORDERS' | 'EXACT_MATCH_ONLY' | 'RESET'

export const IMPORT_POLICY: Record<ReplacePolicy, BackendImportPolicy> = {
  keep: 'KEEP_EXISTING_ORDERS',
  match: 'EXACT_MATCH_ONLY',
  reset: 'RESET',
}

export const MENU_ENDPOINTS = {
  published: (year: number, month: number) => `/published-menus/${year}/${month}`,
  list: '/menus',
  create: '/menus',
  get: (id: string) => `/menus/${id}`,
  versions: (id: string) => `/menus/${id}/versions`,
  version: (id: string, versionId: string) => `/menus/${id}/versions/${versionId}`,
  announce: (id: string) => `/menus/${id}/announce`,
  preview: '/menus/imports/preview',
  patchImport: (importId: string) => `/menus/imports/${importId}`,
  confirm: (importId: string) => `/menus/imports/${importId}/confirm`,
} as const

export type MealPatch = {
  mealDate: string
  mealType: BackendMealType
  options: Array<{ id?: string; title: string; displayOrder: number }>
}

export type { MealKind }
