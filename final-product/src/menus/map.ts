import { gregorianToJalali, jalaliMonthLength, jalaliToGregorian, weekdayName } from '../lib/jalali'
import type { DayMenu, MealKind } from '../types'
import type { BackendMeal, BackendMealType, MenuDay, MenuOption, MenuVersionDetail } from './types'

export function toFrontendMeal(type: unknown): MealKind | null {
  if (type === 'LUNCH') return 'lunch'
  if (type === 'DINNER') return 'dinner'
  return null
}

export function toBackendMeal(kind: MealKind): BackendMealType {
  return kind === 'lunch' ? 'LUNCH' : 'DINNER'
}

export function formatGregorianDate(jy: number, jm: number, jd: number) {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd)
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`
}

export function jalaliFromMealDate(mealDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(mealDate)
  if (!match) return null
  return gregorianToJalali(Number(match[1]), Number(match[2]), Number(match[3]))
}

export function parseOption(value: unknown): MenuOption | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || typeof item.title !== 'string') return null
  const displayOrder = typeof item.displayOrder === 'number' ? item.displayOrder : Number(item.displayOrder)
  if (!Number.isInteger(displayOrder)) return null
  return { id: item.id, title: item.title, displayOrder }
}

export function parseMeals(value: unknown): BackendMeal[] {
  if (!Array.isArray(value)) return []
  const meals: BackendMeal[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Record<string, unknown>
    if (typeof item.mealDate !== 'string') continue
    if (item.mealType !== 'LUNCH' && item.mealType !== 'DINNER') continue
    const options = Array.isArray(item.options)
      ? item.options.map(parseOption).filter((option): option is MenuOption => option !== null)
      : []
    meals.push({
      mealDate: item.mealDate,
      jalaliDate: typeof item.jalaliDate === 'string' ? item.jalaliDate : null,
      mealType: item.mealType,
      options: options.sort((a, b) => a.displayOrder - b.displayOrder),
    })
  }
  return meals
}

export function emptyMonthDays(jy: number, jm: number): MenuDay[] {
  return Array.from({ length: jalaliMonthLength(jy, jm) }, (_, index) => {
    const jd = index + 1
    return {
      jy,
      jm,
      jd,
      weekday: weekdayName({ jy, jm, jd }),
      mealDate: formatGregorianDate(jy, jm, jd),
      lunch: null,
      dinner: null,
    }
  })
}

export function overlayMeals(jy: number, jm: number, meals: BackendMeal[]): MenuDay[] {
  const days = emptyMonthDays(jy, jm)
  for (const meal of meals) {
    const date = jalaliFromMealDate(meal.mealDate)
    if (!date || date.jy !== jy || date.jm !== jm) continue
    const day = days[date.jd - 1]
    if (!day) continue
    const kind = toFrontendMeal(meal.mealType)
    if (!kind) continue
    day.mealDate = meal.mealDate
    day[kind] = meal.options.length ? meal.options : null
  }
  return days
}

export function daysFromVersion(jy: number, jm: number, version: Pick<MenuVersionDetail, 'meals'> | null): MenuDay[] {
  return overlayMeals(jy, jm, version?.meals ?? [])
}

export function toPickerDay(day: MenuDay): DayMenu {
  return {
    jy: day.jy,
    jm: day.jm,
    jd: day.jd,
    weekday: day.weekday,
    lunch: day.lunch?.map((option) => option.title) ?? null,
    dinner: day.dinner?.map((option) => option.title) ?? null,
    lunchChoices: day.lunch,
    dinnerChoices: day.dinner,
    gregorianDate: day.mealDate,
  }
}

export function optionTitles(options: MenuOption[] | null) {
  return options?.map((option) => option.title) ?? []
}

export function patchOptions(options: MenuOption[]) {
  return options.map((option, index) => ({
    ...(option.id.startsWith('new:') ? {} : { id: option.id }),
    title: option.title,
    displayOrder: index + 1,
  }))
}

export function localOption(title: string, displayOrder: number): MenuOption {
  return { id: `new:${displayOrder}:${title}`, title, displayOrder }
}
