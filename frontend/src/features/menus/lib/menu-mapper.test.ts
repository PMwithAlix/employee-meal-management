import { describe, expect, it } from 'vitest'
import { daysFromVersion, formatGregorianDate, overlayMeals, patchOptions, toBackendMeal, toFrontendMeal, toPickerDay } from './menu-mapper'
import { IMPORT_POLICY, MENU_ENDPOINTS } from '../model/menu-types'

describe('meal type mapping', () => {
  it('maps backend meal types onto frontend kinds and back', () => {
    expect(toFrontendMeal('LUNCH')).toBe('lunch')
    expect(toFrontendMeal('DINNER')).toBe('dinner')
    expect(toBackendMeal('lunch')).toBe('LUNCH')
    expect(toBackendMeal('dinner')).toBe('DINNER')
  })
})

describe('overlayMeals', () => {
  it('keeps option ids and fills only the matching Jalali day', () => {
    const mealDate = formatGregorianDate(1405, 8, 3)
    const days = overlayMeals(1405, 8, [
      {
        mealDate,
        jalaliDate: null,
        mealType: 'LUNCH',
        options: [{ id: 'opt-1', title: 'چلوکباب', displayOrder: 1 }],
      },
    ])
    expect(days[2]?.lunch).toEqual([{ id: 'opt-1', title: 'چلوکباب', displayOrder: 1 }])
    expect(days[2]?.dinner).toBeNull()
    expect(days[0]?.lunch).toBeNull()
    expect(toPickerDay(days[2]!).lunch).toEqual(['چلوکباب'])
    expect(toPickerDay(days[2]!).lunchChoices).toEqual([{ id: 'opt-1', title: 'چلوکباب', displayOrder: 1 }])
  })

  it('does not invent seed titles when there are no meals', () => {
    const days = daysFromVersion(1405, 8, { meals: [] })
    expect(days.every((day) => day.lunch === null && day.dinner === null)).toBe(true)
  })

  it('ignores meals from another month so a stale payload cannot overwrite the selection', () => {
    const days = overlayMeals(1405, 8, [
      {
        mealDate: formatGregorianDate(1405, 9, 1),
        jalaliDate: null,
        mealType: 'LUNCH',
        options: [{ id: 'x', title: 'نباید', displayOrder: 1 }],
      },
    ])
    expect(days.some((day) => day.lunch?.some((option) => option.title === 'نباید'))).toBe(false)
  })
})

describe('patchOptions', () => {
  it('keeps stable ids and omits local new: ids', () => {
    expect(
      patchOptions([
        { id: '11111111-1111-1111-1111-111111111111', title: 'اول', displayOrder: 9 },
        { id: 'new:2:دوم', title: 'دوم', displayOrder: 2 },
      ]),
    ).toEqual([
      { id: '11111111-1111-1111-1111-111111111111', title: 'اول', displayOrder: 1 },
      { title: 'دوم', displayOrder: 2 },
    ])
  })
})

describe('contracts', () => {
  it('maps frontend import policies onto backend enums', () => {
    expect(IMPORT_POLICY.keep).toBe('KEEP_EXISTING_ORDERS')
    expect(IMPORT_POLICY.match).toBe('EXACT_MATCH_ONLY')
    expect(IMPORT_POLICY.reset).toBe('RESET')
  })

  it('uses published-menus for readers and /menus for management', () => {
    expect(MENU_ENDPOINTS.published(1405, 8)).toBe('/published-menus/1405/8')
    expect(MENU_ENDPOINTS.list).toBe('/menus')
    expect(MENU_ENDPOINTS.preview).toBe('/menus/imports/preview')
  })
})
