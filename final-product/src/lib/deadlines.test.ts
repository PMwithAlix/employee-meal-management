import { describe, expect, it } from 'vitest'
import { formatDeadlineFromInstant, summarizeBackendDeadlines } from './deadlines'

describe('formatDeadlineFromInstant', () => {
  it('formats a backend ISO deadline in Asia/Tehran without using the local default clock', () => {
    expect(formatDeadlineFromInstant('2026-08-22T06:30:00.000Z', '2026-08-22')).toBe('همان روز، ساعت ۱۰:۰۰')
    expect(formatDeadlineFromInstant('2026-08-21T06:30:00.000Z', '2026-08-22')).toBe('روز قبل، ساعت ۱۰:۰۰')
  })
})

describe('summarizeBackendDeadlines', () => {
  it('does not invent a default clock when a meal has no backend deadline', () => {
    expect(summarizeBackendDeadlines({ '2026-08-22:DINNER': '2026-08-22T06:30:00.000Z' }, 'lunch')).toBe('مهلت تعریف نشده')
    expect(summarizeBackendDeadlines({ '2026-08-22:LUNCH': '2026-08-22T06:30:00.000Z' }, 'lunch')).toBe('همان روز، ساعت ۱۰:۰۰')
  })
})
