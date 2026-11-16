export type ReportMealType = 'LUNCH' | 'DINNER'

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
  lunch: DailyReportMealSummary
  dinner: DailyReportMealSummary
  buildings: DailyReportBuilding[]
  unassignedGuests: DailyReportGuestRow[]
}

export const REPORT_ENDPOINTS = {
  daily: '/reports/daily',
} as const
