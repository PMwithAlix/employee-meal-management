import { describe, expect, it } from 'vitest'
import { clockMinutes, formatClock, parseClock } from './clock-time'

describe('clock time', () => {
  it('parses and formats 24-hour HH:mm values', () => {
    expect(parseClock('09:05')).toEqual({ hour: 9, minute: 5 })
    expect(parseClock('23:59')).toEqual({ hour: 23, minute: 59 })
    expect(formatClock(9, 5)).toBe('09:05')
    expect(parseClock('24:00')).toBeNull()
    expect(formatClock(24, 0)).toBeNull()
  })

  it('keeps an off-step current minute in the wheel options', () => {
    expect(clockMinutes(5)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
    expect(clockMinutes(5, 12)).toContain(12)
  })
})
