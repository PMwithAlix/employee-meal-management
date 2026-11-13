import { fa } from '../lib/text'

export function metricValue(status: string, count: number | null) {
  if (status === 'loading') return '…'
  if (status === 'ready' && count !== null) return fa(count)
  return '—'
}

export function combinedActiveCount(status: string, lunch: number | null, dinner: number | null) {
  if (status !== 'ready' || lunch === null || dinner === null) return null
  return lunch + dinner
}

export function openDaysMetric(publishedStatus: string, deadlineStatus: string, openCount: number) {
  if (publishedStatus === 'loading' || deadlineStatus === 'loading') return '…'
  if (publishedStatus === 'ready' && deadlineStatus === 'ready') return fa(openCount)
  return '—'
}

export function managementOpenDaysMetric(publishedStatus: string, deadlineStatus: string, openCount: number) {
  if (publishedStatus === 'loading' || deadlineStatus === 'loading') return '…'
  if (deadlineStatus !== 'ready') return '—'
  if (publishedStatus === 'empty') return fa(0)
  if (publishedStatus === 'ready') return fa(openCount)
  return '—'
}

export function retryManagementOverview(actions: {
  counts: () => void
  published: () => void
  recent: () => void
  deadlines: () => void
}) {
  actions.counts()
  actions.published()
  actions.recent()
  actions.deadlines()
}
