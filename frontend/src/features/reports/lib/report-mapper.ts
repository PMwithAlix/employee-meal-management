import type {
  DailyReport,
  DailyReportBuilding,
  DailyReportFoodRow,
  DailyReportGuestRow,
  DailyReportMealSummary,
  DailyReportUserRow,
  MonthlyBuildingFoodRow,
  MonthlyBuildingTotal,
  MonthlyCountRow,
  MonthlyFoodRow,
  MonthlyReport,
  ReportMealFilter,
  ReportMealType,
} from '../model/report-types'

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function asMealType(value: unknown): ReportMealType | null {
  if (value === 'LUNCH' || value === 'DINNER') return value
  return null
}

function asMealFilter(value: unknown): ReportMealFilter {
  if (value === 'LUNCH' || value === 'DINNER' || value === 'ALL') return value
  return 'ALL'
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function parseFood(value: unknown): DailyReportFoodRow | null {
  const body = asRecord(value)
  if (!body || typeof body.title !== 'string') return null
  if (typeof body.staffCount !== 'number' || typeof body.guestCount !== 'number' || typeof body.total !== 'number') return null
  if (typeof body.menuItemId !== 'string') return null
  return {
    menuItemId: body.menuItemId,
    title: body.title,
    staffCount: body.staffCount,
    guestCount: body.guestCount,
    total: body.total,
  }
}

function parseMeal(value: unknown, fallback: ReportMealType): DailyReportMealSummary | null {
  const body = asRecord(value)
  if (!body || !Array.isArray(body.foods)) return null
  const mealType = asMealType(body.mealType) ?? fallback
  const foods = body.foods.map(parseFood).filter((item): item is DailyReportFoodRow => item !== null)
  if (foods.length !== body.foods.length) return null
  if (typeof body.staffTotal !== 'number' || typeof body.guestTotal !== 'number' || typeof body.total !== 'number') return null
  return { mealType, foods, staffTotal: body.staffTotal, guestTotal: body.guestTotal, total: body.total }
}

function parseGuest(value: unknown): DailyReportGuestRow | null {
  const body = asRecord(value)
  if (!body || typeof body.id !== 'string' || typeof body.title !== 'string' || typeof body.quantity !== 'number') return null
  const mealType = asMealType(body.mealType)
  if (!mealType) return null
  return {
    id: body.id,
    mealType,
    title: body.title,
    quantity: body.quantity,
    note: typeof body.note === 'string' ? body.note : null,
  }
}

function parseUser(value: unknown): DailyReportUserRow | null {
  const body = asRecord(value)
  if (!body || typeof body.userId !== 'string' || typeof body.name !== 'string') return null
  return {
    userId: body.userId,
    name: body.name,
    lunch: asStringArray(body.lunch),
    dinner: asStringArray(body.dinner),
  }
}

function parseBuilding(value: unknown): DailyReportBuilding | null {
  const body = asRecord(value)
  if (!body || typeof body.buildingName !== 'string' || !Array.isArray(body.users) || !Array.isArray(body.guests)) return null
  const users = body.users.map(parseUser).filter((item): item is DailyReportUserRow => item !== null)
  const guests = body.guests.map(parseGuest).filter((item): item is DailyReportGuestRow => item !== null)
  if (users.length !== body.users.length || guests.length !== body.guests.length) return null
  return {
    buildingId: typeof body.buildingId === 'string' ? body.buildingId : null,
    buildingName: body.buildingName,
    users,
    guests,
  }
}

export function parseDailyReport(value: unknown): DailyReport | null {
  const body = asRecord(value)
  if (!body || typeof body.mealDate !== 'string') return null
  const lunch = parseMeal(body.lunch, 'LUNCH')
  const dinner = parseMeal(body.dinner, 'DINNER')
  if (!lunch || !dinner || !Array.isArray(body.buildings) || !Array.isArray(body.unassignedGuests)) return null
  const buildings = body.buildings.map(parseBuilding).filter((item): item is DailyReportBuilding => item !== null)
  const unassignedGuests = body.unassignedGuests.map(parseGuest).filter((item): item is DailyReportGuestRow => item !== null)
  if (buildings.length !== body.buildings.length || unassignedGuests.length !== body.unassignedGuests.length) return null
  return {
    mealDate: body.mealDate,
    jalaliDate: typeof body.jalaliDate === 'string' ? body.jalaliDate : null,
    generatedAt: typeof body.generatedAt === 'string' ? body.generatedAt : '',
    meal: asMealFilter(body.meal),
    lunch,
    dinner,
    buildings,
    unassignedGuests,
  }
}

function asCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseMonthlyCount(value: unknown): MonthlyCountRow | null {
  const body = asRecord(value)
  if (!body) return null
  const lunchStaff = asCount(body.lunchStaff)
  const lunchGuest = asCount(body.lunchGuest)
  const dinnerStaff = asCount(body.dinnerStaff)
  const dinnerGuest = asCount(body.dinnerGuest)
  const lunchCount = asCount(body.lunchCount)
  const dinnerCount = asCount(body.dinnerCount)
  const staffCount = asCount(body.staffCount)
  const guestCount = asCount(body.guestCount)
  const total = asCount(body.total)
  if (
    lunchStaff === null || lunchGuest === null || dinnerStaff === null || dinnerGuest === null
    || lunchCount === null || dinnerCount === null || staffCount === null || guestCount === null || total === null
  ) return null
  return { lunchStaff, lunchGuest, dinnerStaff, dinnerGuest, lunchCount, dinnerCount, staffCount, guestCount, total }
}

function parseMonthlyFood(value: unknown): MonthlyFoodRow | null {
  const body = asRecord(value)
  const counts = parseMonthlyCount(value)
  if (!body || !counts || typeof body.title !== 'string') return null
  return {
    ...counts,
    ...(typeof body.key === 'string' ? { key: body.key } : {}),
    ...(typeof body.menuItemId === 'string' ? { menuItemId: body.menuItemId } : {}),
    title: body.title,
  }
}

function parseMonthlyBuildingFood(value: unknown): MonthlyBuildingFoodRow | null {
  const food = parseMonthlyFood(value)
  const body = asRecord(value)
  if (!food || !body || typeof body.buildingName !== 'string') return null
  return {
    ...food,
    buildingId: typeof body.buildingId === 'string' ? body.buildingId : null,
    buildingName: body.buildingName,
  }
}

function parseMonthlyBuildingTotal(value: unknown): MonthlyBuildingTotal | null {
  const counts = parseMonthlyCount(value)
  const body = asRecord(value)
  if (!counts || !body || typeof body.buildingName !== 'string') return null
  return {
    ...counts,
    buildingId: typeof body.buildingId === 'string' ? body.buildingId : null,
    buildingName: body.buildingName,
  }
}

export function parseMonthlyReport(value: unknown): MonthlyReport | null {
  const body = asRecord(value)
  if (!body || typeof body.year !== 'number' || typeof body.month !== 'number') return null
  if (typeof body.monthLabel !== 'string' || typeof body.mealLabel !== 'string') return null
  if (!Array.isArray(body.foods) || !Array.isArray(body.buildingRows) || !Array.isArray(body.buildingTotals) || !Array.isArray(body.supply)) return null
  const foods = body.foods.map(parseMonthlyFood).filter((item): item is MonthlyFoodRow => item !== null)
  const buildingRows = body.buildingRows.map(parseMonthlyBuildingFood).filter((item): item is MonthlyBuildingFoodRow => item !== null)
  const buildingTotals = body.buildingTotals.map(parseMonthlyBuildingTotal).filter((item): item is MonthlyBuildingTotal => item !== null)
  const supply = body.supply.map(parseMonthlyFood).filter((item): item is MonthlyFoodRow => item !== null)
  const foodsTotal = parseMonthlyCount(body.foodsTotal)
  const supplyTotal = parseMonthlyCount(body.supplyTotal)
  const recon = asRecord(body.reconciliation)
  if (foods.length !== body.foods.length || buildingRows.length !== body.buildingRows.length) return null
  if (buildingTotals.length !== body.buildingTotals.length || supply.length !== body.supply.length) return null
  if (!foodsTotal || !supplyTotal || !recon) return null
  if (typeof recon.foodsTotal !== 'number' || typeof recon.buildingsTotal !== 'number' || typeof recon.difference !== 'number') return null
  return {
    year: body.year,
    month: body.month,
    monthLabel: body.monthLabel,
    meal: asMealFilter(body.meal),
    mealLabel: body.mealLabel,
    generatedAt: typeof body.generatedAt === 'string' ? body.generatedAt : '',
    foods,
    foodsTotal,
    buildingRows,
    buildingTotals,
    supply,
    supplyTotal,
    reconciliation: {
      foodsTotal: recon.foodsTotal,
      buildingsTotal: recon.buildingsTotal,
      difference: recon.difference,
      matched: recon.matched === true,
    },
  }
}

export function formatReportInstant(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Tehran',
  }).format(date)
}

export function todayIsoDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date())
}

export function dishes(values: string[]) {
  return values.length ? values.join('، ') : '—'
}

export function foodsWithOrders(foods: DailyReportFoodRow[]) {
  return foods.filter((food) => food.total > 0)
}

export function mealLabel(meal: ReportMealType) {
  return meal === 'DINNER' ? 'شام' : 'ناهار'
}

export function mealFilterLabel(meal: ReportMealFilter) {
  if (meal === 'LUNCH') return 'فقط ناهار'
  if (meal === 'DINNER') return 'فقط شام'
  return 'هر دو وعده'
}

export function showsLunch(meal: ReportMealFilter) {
  return meal !== 'DINNER'
}

export function showsDinner(meal: ReportMealFilter) {
  return meal !== 'LUNCH'
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
