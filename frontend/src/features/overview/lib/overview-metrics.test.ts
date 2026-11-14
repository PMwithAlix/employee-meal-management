import { describe, expect, it, vi } from 'vitest'
import { combinedActiveCount, managementOpenDaysMetric, metricValue, openDaysMetric, retryManagementOverview } from './overview-metrics'

describe('overview live metrics', () => {
  it('shows live lunch and dinner totals only after both counts are ready', () => {
    expect(combinedActiveCount('loading', null, null)).toBeNull()
    expect(combinedActiveCount('ready', 4, 3)).toBe(7)
    expect(metricValue('ready', 4)).toBe('۴')
    expect(metricValue('ready', 3)).toBe('۳')
  })

  it('does not keep seed or leftover counts when the API failed', () => {
    expect(combinedActiveCount('error', 12, 8)).toBeNull()
    expect(metricValue('error', 12)).toBe('—')
    expect(metricValue('error', null)).toBe('—')
    expect(openDaysMetric('error', 'error', 9)).toBe('—')
    expect(managementOpenDaysMetric('error', 'error', 9)).toBe('—')
  })

  it('treats an empty published menu as zero open days for management, not a seed number', () => {
    expect(managementOpenDaysMetric('empty', 'ready', 6)).toBe('۰')
    expect(openDaysMetric('empty', 'ready', 6)).toBe('—')
  })

  it('retries management overview deadlines together with the other live sources', () => {
    const counts = vi.fn()
    const published = vi.fn()
    const recent = vi.fn()
    const deadlines = vi.fn()
    retryManagementOverview({ counts, published, recent, deadlines })
    expect(counts).toHaveBeenCalledOnce()
    expect(published).toHaveBeenCalledOnce()
    expect(recent).toHaveBeenCalledOnce()
    expect(deadlines).toHaveBeenCalledOnce()
    expect(managementOpenDaysMetric('ready', 'loading', 4)).toBe('…')
    expect(managementOpenDaysMetric('ready', 'error', 4)).toBe('—')
  })
})
