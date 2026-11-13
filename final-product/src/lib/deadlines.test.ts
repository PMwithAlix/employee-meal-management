import { describe, expect, it } from 'vitest'
import { formatDeadlineFromInstant, summarizeBackendDeadlines } from './deadlines'

const noon = '2026-08-22T06:30:00.000Z'
const later = '2026-08-22T07:00:00.000Z'

describe('formatDeadlineFromInstant', () => {
  it('formats a backend ISO deadline in Asia/Tehran without using the local default clock', () => {
    expect(formatDeadlineFromInstant(noon, '2026-08-22')).toBe('همان روز، ساعت ۱۰:۰۰')
    expect(formatDeadlineFromInstant('2026-08-21T06:30:00.000Z', '2026-08-22')).toBe('روز قبل، ساعت ۱۰:۰۰')
  })
})

describe('summarizeBackendDeadlines', () => {
  it('shows one clock when every meal day shares the same backend deadline', () => {
    expect(summarizeBackendDeadlines(
      { '2026-08-22:LUNCH': noon, '2026-08-23:LUNCH': '2026-08-23T06:30:00.000Z' },
      'lunch',
      ['2026-08-22', '2026-08-23'],
    )).toBe('همان روز، ساعت ۱۰:۰۰')
  })

  it('shows mixed clocks when meal days have different backend times', () => {
    expect(summarizeBackendDeadlines(
      { '2026-08-22:LUNCH': noon, '2026-08-23:LUNCH': later },
      'lunch',
      ['2026-08-22', '2026-08-23'],
    )).toBe('ساعت‌های متفاوت')
  })

  it('does not invent a default clock when no meal day has a backend deadline', () => {
    expect(summarizeBackendDeadlines({ '2026-08-22:DINNER': noon }, 'lunch', ['2026-08-22'])).toBe('مهلت تعریف نشده')
    expect(summarizeBackendDeadlines({}, 'lunch', [])).toBe('مهلت تعریف نشده')
  })

  it('does not generalize a single clock when some meal days have no deadline', () => {
    expect(summarizeBackendDeadlines(
      { '2026-08-22:LUNCH': noon },
      'lunch',
      ['2026-08-22', '2026-08-23'],
    )).toBe('بعضی روزها مهلت ندارند')
  })

  it('shows the clock when the month has only one meal day with a deadline', () => {
    expect(summarizeBackendDeadlines({ '2026-08-22:LUNCH': noon }, 'lunch', ['2026-08-22'])).toBe('همان روز، ساعت ۱۰:۰۰')
  })
})
