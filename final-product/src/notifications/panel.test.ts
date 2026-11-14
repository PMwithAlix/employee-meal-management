import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_PAGE_SIZE,
  applyLoadMoreError,
  applyLoadMoreSuccess,
  applyMarkAllRead,
  applyNotificationRefreshError,
  applyNotificationRefreshSuccess,
  beginLoadMore,
  beginNotificationRefresh,
  canRequestMore,
  emptyNotificationPanel,
  hasMoreNotifications,
  mergeNotificationItems,
  nextNotificationPage,
} from './panel'
import type { NotificationItem } from './client'

function item(id: string, unread = true): NotificationItem {
  return {
    id,
    type: 'PASSWORD_RESET',
    title: `اعلان ${id}`,
    body: 'رمز عبور بازنشانی شد.',
    data: null,
    readAt: unread ? null : '2026-11-14T10:00:00.000Z',
    createdAt: '2026-11-14T10:00:00.000Z',
  }
}

function page(ids: string[], extras?: Partial<{ total: number; unreadCount: number; page: number }>) {
  return {
    items: ids.map((id) => item(id)),
    total: extras?.total ?? ids.length,
    unreadCount: extras?.unreadCount ?? ids.length,
    page: extras?.page ?? 1,
    pageSize: NOTIFICATION_PAGE_SIZE,
  }
}

describe('notification panel pagination', () => {
  it('loads page 1 and keeps unread count independent of loaded items', () => {
    const loaded = applyNotificationRefreshSuccess(page(['1', '2'], { total: 25, unreadCount: 25 }))
    expect(loaded.status).toBe('ready')
    expect(loaded.items).toHaveLength(2)
    expect(loaded.unreadCount).toBe(25)
    expect(loaded.total).toBe(25)
    expect(hasMoreNotifications(loaded)).toBe(true)
  })

  it('appends the second page without duplicate ids and hides load-more when complete', () => {
    const first = applyNotificationRefreshSuccess(page(['1', '2'], { total: 4, unreadCount: 4 }))
    const loading = beginLoadMore(first)
    expect(loading.moreStatus).toBe('loading')
    expect(canRequestMore(loading)).toBe(false)

    const merged = applyLoadMoreSuccess(loading, page(['2', '3', '4'], { total: 4, unreadCount: 4, page: 2 }))
    expect(merged.items.map((entry) => entry.id)).toEqual(['1', '2', '3', '4'])
    expect(merged.page).toBe(2)
    expect(hasMoreNotifications(merged)).toBe(false)
    expect(canRequestMore(merged)).toBe(false)
  })

  it('keeps loaded notifications when load-more fails and allows retry', () => {
    const first = applyNotificationRefreshSuccess(page(['1'], { total: 3, unreadCount: 3 }))
    const failed = applyLoadMoreError(beginLoadMore(first), 'بارگذاری اعلان‌های قدیمی‌تر انجام نشد.')
    expect(failed.items.map((entry) => entry.id)).toEqual(['1'])
    expect(failed.moreStatus).toBe('error')
    expect(failed.moreMessage).toContain('قدیمی‌تر')
    expect(canRequestMore(failed)).toBe(true)

    const retried = applyLoadMoreSuccess(beginLoadMore(failed), page(['2', '3'], { total: 3, unreadCount: 3, page: 2 }))
    expect(retried.items.map((entry) => entry.id)).toEqual(['1', '2', '3'])
    expect(retried.moreStatus).toBe('idle')
  })

  it('replaces the list on refresh instead of appending page 1 again', () => {
    const first = applyNotificationRefreshSuccess(page(['1', '2'], { total: 4, unreadCount: 4 }))
    const withMore = applyLoadMoreSuccess(first, page(['3'], { total: 4, unreadCount: 4, page: 2 }))
    const refreshing = beginNotificationRefresh(withMore)
    expect(refreshing.status).toBe('loading')
    const reset = applyNotificationRefreshSuccess(page(['1', '2'], { total: 4, unreadCount: 2 }))
    expect(reset.items.map((entry) => entry.id)).toEqual(['1', '2'])
    expect(reset.page).toBe(1)
    expect(reset.unreadCount).toBe(2)
  })

  it('marks all loaded items read while unread count can still include later pages', () => {
    const first = applyNotificationRefreshSuccess(page(['1', '2'], { total: 25, unreadCount: 25 }))
    const marked = applyMarkAllRead(first, '2026-11-14T12:00:00.000Z')
    expect(marked.unreadCount).toBe(0)
    expect(marked.items.every((entry) => entry.readAt === '2026-11-14T12:00:00.000Z')).toBe(true)
    expect(first.unreadCount).toBe(25)
  })

  it('does not drop previous items on an initial refresh error', () => {
    const ready = applyNotificationRefreshSuccess(page(['1'], { total: 1, unreadCount: 0 }))
    const failed = applyNotificationRefreshError(beginNotificationRefresh(ready), 'بارگذاری اعلان‌ها انجام نشد.')
    expect(failed.status).toBe('error')
    expect(failed.items).toEqual(ready.items)
  })

  it('computes the next page and rejects duplicate ids when merging', () => {
    const current = [item('1'), item('2')]
    expect(nextNotificationPage({ page: 1 })).toBe(2)
    expect(mergeNotificationItems(current, [item('2'), item('3')]).map((entry) => entry.id)).toEqual([
      '1',
      '2',
      '3',
    ])
  })

  it('starts from an empty loading panel', () => {
    expect(emptyNotificationPanel().status).toBe('loading')
    expect(emptyNotificationPanel().pageSize).toBe(20)
  })
})
