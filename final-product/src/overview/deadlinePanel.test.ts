import { describe, expect, it, vi } from 'vitest'
import { retryManagementOverview } from './metrics'
import {
  opsDeadlineFailed,
  opsDeadlinePanel,
  overviewBannerMessage,
} from './deadlinePanel'

describe('ADMIN overview deadline panel', () => {
  it('shows upcoming deadlines when the published menu and deadlines are ready', () => {
    expect(opsDeadlinePanel({
      publishedStatus: 'ready',
      publishedMessage: '',
      deadlineStatus: 'ready',
      deadlineMessage: '',
      openCount: 3,
    })).toEqual({ kind: 'ready' })
    expect(opsDeadlineFailed('ready', 'ready')).toBe(false)
  })

  it('uses a neutral empty state when the month has no published menu', () => {
    const view = opsDeadlinePanel({
      publishedStatus: 'empty',
      publishedMessage: 'منو پیدا نشد.',
      deadlineStatus: 'ready',
      deadlineMessage: '',
      openCount: 6,
    })
    expect(view).toEqual({
      kind: 'empty-menu',
      message: 'برای این ماه منوی منتشرشده‌ای وجود ندارد.',
    })
    expect(opsDeadlineFailed('empty', 'ready')).toBe(false)
  })

  it('treats published-menu unavailable and error as real failures', () => {
    expect(opsDeadlinePanel({
      publishedStatus: 'unavailable',
      publishedMessage: 'ارتباط قطع است.',
      deadlineStatus: 'ready',
      deadlineMessage: '',
      openCount: 0,
    })).toEqual({ kind: 'error', message: 'ارتباط قطع است.' })
    expect(opsDeadlinePanel({
      publishedStatus: 'error',
      publishedMessage: 'بارگذاری منو انجام نشد.',
      deadlineStatus: 'ready',
      deadlineMessage: '',
      openCount: 0,
    }).kind).toBe('error')
    expect(opsDeadlineFailed('error', 'ready')).toBe(true)
  })

  it('shows the deadline API error and includes it in retry', () => {
    expect(opsDeadlinePanel({
      publishedStatus: 'ready',
      publishedMessage: '',
      deadlineStatus: 'error',
      deadlineMessage: 'مهلت‌ها خوانده نشد.',
      openCount: 2,
    })).toEqual({ kind: 'error', message: 'مهلت‌ها خوانده نشد.' })
    expect(opsDeadlineFailed('ready', 'error')).toBe(true)
    expect(overviewBannerMessage({
      countsMessage: '',
      publishedMessage: '',
      deadlineMessage: 'مهلت‌ها خوانده نشد.',
      recentMessage: '',
    })).toBe('مهلت‌ها خوانده نشد.')

    const counts = vi.fn()
    const published = vi.fn()
    const recent = vi.fn()
    const deadlines = vi.fn()
    retryManagementOverview({ counts, published, recent, deadlines })
    expect(deadlines).toHaveBeenCalledOnce()
    expect(published).toHaveBeenCalledOnce()
  })

  it('does not raise a red banner for a legitimate empty published menu', () => {
    expect(opsDeadlineFailed('empty', 'ready')).toBe(false)
    expect(opsDeadlinePanel({
      publishedStatus: 'empty',
      publishedMessage: '',
      deadlineStatus: 'ready',
      deadlineMessage: '',
      openCount: 0,
    }).kind).toBe('empty-menu')
  })
})
