import { describe, expect, it } from 'vitest'
import { combinedActiveCount, managementOpenDaysMetric, metricValue, openDaysMetric } from './metrics'

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
})
