import type {
  DailyReport,
  DailyReportBuilding,
  DailyReportFoodRow,
  DailyReportGuestRow,
  DailyReportMealSummary,
  DailyReportUserRow,
  ReportMealType,
} from '../model/report-types'

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function asMealType(value: unknown): ReportMealType | null {
  if (value === 'LUNCH' || value === 'DINNER') return value
  return null
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function parseFood(value: unknown): DailyReportFoodRow | null {
  const body = asRecord(value)
  if (!body || typeof body.title !== 'string') return null
  if (typeof body.staffCount !== 'number' || typeof body.guestCount !== 'number' || typeof body.total !== 'number') return null
  return {
    menuItemId: typeof body.menuItemId === 'string' ? body.menuItemId : null,
    title: body.title,
    onMenu: body.onMenu === true,
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
    lunch,
    dinner,
    buildings,
    unassignedGuests,
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

export function mealLabel(meal: ReportMealType) {
  return meal === 'DINNER' ? 'شام' : 'ناهار'
}
