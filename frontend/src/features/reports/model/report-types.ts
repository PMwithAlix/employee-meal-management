export type ReportMealType = 'LUNCH' | 'DINNER'
export type ReportMealFilter = 'ALL' | 'LUNCH' | 'DINNER'
export type ReportPeriod = 'daily' | 'monthly'

export type DailyReportFoodRow = {
  menuItemId: string | null
  title: string
  onMenu: boolean
  staffCount: number
  guestCount: number
  total: number
}

export type DailyReportMealSummary = {
  mealType: ReportMealType
  foods: DailyReportFoodRow[]
  staffTotal: number
  guestTotal: number
  total: number
}

export type DailyReportUserRow = {
  userId: string
  name: string
  lunch: string[]
  dinner: string[]
}

export type DailyReportGuestRow = {
  id: string
  mealType: ReportMealType
  title: string
  quantity: number
  note: string | null
}

export type DailyReportBuilding = {
  buildingId: string | null
  buildingName: string
  users: DailyReportUserRow[]
  guests: DailyReportGuestRow[]
}

export type DailyReport = {
  mealDate: string
  jalaliDate: string | null
  generatedAt: string
  meal: ReportMealFilter
  lunch: DailyReportMealSummary
  dinner: DailyReportMealSummary
  buildings: DailyReportBuilding[]
  unassignedGuests: DailyReportGuestRow[]
}

export type MonthlyCountRow = {
  lunchStaff: number
  lunchGuest: number
  dinnerStaff: number
  dinnerGuest: number
  lunchCount: number
  dinnerCount: number
  staffCount: number
  guestCount: number
  total: number
}

export type MonthlyFoodRow = MonthlyCountRow & {
  key?: string
  menuItemId?: string | null
  title: string
  onMenu: boolean
}

export type MonthlyBuildingFoodRow = MonthlyFoodRow & {
  buildingId: string | null
  buildingName: string
}

export type MonthlyBuildingTotal = MonthlyCountRow & {
  buildingId: string | null
  buildingName: string
}

export type MonthlyReconciliation = {
  foodsTotal: number
  buildingsTotal: number
  difference: number
  matched: boolean
}

export type MonthlyReport = {
  year: number
  month: number
  monthLabel: string
  meal: ReportMealFilter
  mealLabel: string
  generatedAt: string
  foods: MonthlyFoodRow[]
  foodsTotal: MonthlyCountRow
  buildingRows: MonthlyBuildingFoodRow[]
  buildingTotals: MonthlyBuildingTotal[]
  supply: MonthlyFoodRow[]
  supplyTotal: MonthlyCountRow
  reconciliation: MonthlyReconciliation
}

export const REPORT_ENDPOINTS = {
  daily: '/reports/daily',
  monthly: '/reports/monthly',
  monthlyExcel: '/reports/monthly.xlsx',
} as const
