import { describe, expect, it } from 'vitest'
import { formatJalaliInput, isoDateFromJalali, jalaliFromIsoDate } from './jalali-picker'

describe('jalali picker conversion', () => {
  it('maps Gregorian ISO dates onto Jalali civil dates and back', () => {
    expect(jalaliFromIsoDate('2026-11-15')).toEqual({ jy: 1405, jm: 8, jd: 24 })
    expect(isoDateFromJalali({ jy: 1405, jm: 8, jd: 24 })).toBe('2026-11-15')
    expect(formatJalaliInput('2026-11-15')).toBe('1405/08/24')
  })

  it('rejects incomplete values', () => {
    expect(jalaliFromIsoDate('')).toBeNull()
    expect(jalaliFromIsoDate('2026-13-01')).toBeNull()
    expect(isoDateFromJalali({ jy: 1404, jm: 13, jd: 1 })).toBeNull()
  })
})
