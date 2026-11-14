import type { NotificationItem } from '../api/notifications-api'

export const NOTIFICATION_PAGE_SIZE = 20

export type NotificationPage = {
  items: NotificationItem[]
  total: number
  unreadCount: number
  page: number
  pageSize: number
}

export type NotificationPanelState = {
  status: 'loading' | 'ready' | 'error'
  message: string
  items: NotificationItem[]
  unreadCount: number
  total: number
  page: number
  pageSize: number
  moreStatus: 'idle' | 'loading' | 'error'
  moreMessage: string
}

export function emptyNotificationPanel(): NotificationPanelState {
  return {
    status: 'loading',
    message: '',
    items: [],
    unreadCount: 0,
    total: 0,
    page: 1,
    pageSize: NOTIFICATION_PAGE_SIZE,
    moreStatus: 'idle',
    moreMessage: '',
  }
}

export function beginNotificationRefresh(
  current: NotificationPanelState,
): NotificationPanelState {
  return {
    ...current,
    status: 'loading',
    message: '',
    moreStatus: 'idle',
    moreMessage: '',
  }
}

export function applyNotificationRefreshSuccess(
  page: NotificationPage,
): NotificationPanelState {
  return {
    status: 'ready',
    message: '',
    items: page.items,
    unreadCount: page.unreadCount,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    moreStatus: 'idle',
    moreMessage: '',
  }
}

export function applyNotificationRefreshError(
  current: NotificationPanelState,
  message: string,
): NotificationPanelState {
  return {
    ...current,
    status: 'error',
    message,
    moreStatus: 'idle',
    moreMessage: '',
  }
}

export function mergeNotificationItems(
  current: NotificationItem[],
  incoming: NotificationItem[],
) {
  const seen = new Set(current.map((item) => item.id))
  const appended = incoming.filter((item) => !seen.has(item.id))
  return [...current, ...appended]
}

export function hasMoreNotifications(state: Pick<NotificationPanelState, 'items' | 'total'>) {
  return state.items.length < state.total
}

export function nextNotificationPage(state: Pick<NotificationPanelState, 'page'>) {
  return state.page + 1
}

export function canRequestMore(
  state: NotificationPanelState,
) {
  return (
    state.status === 'ready' &&
    state.moreStatus !== 'loading' &&
    hasMoreNotifications(state)
  )
}

export function beginLoadMore(state: NotificationPanelState): NotificationPanelState {
  if (!canRequestMore(state)) return state
  return {
    ...state,
    moreStatus: 'loading',
    moreMessage: '',
  }
}

export function applyLoadMoreSuccess(
  state: NotificationPanelState,
  page: NotificationPage,
): NotificationPanelState {
  return {
    ...state,
    status: 'ready',
    items: mergeNotificationItems(state.items, page.items),
    unreadCount: page.unreadCount,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    moreStatus: 'idle',
    moreMessage: '',
  }
}

export function applyLoadMoreError(
  state: NotificationPanelState,
  message: string,
): NotificationPanelState {
  return {
    ...state,
    items: state.items,
    moreStatus: 'error',
    moreMessage: message,
  }
}

export function applyMarkOneRead(
  state: NotificationPanelState,
  updated: NotificationItem,
): NotificationPanelState {
  const previous = state.items.find((item) => item.id === updated.id)
  const becameRead = Boolean(previous && !previous.readAt && updated.readAt)
  return {
    ...state,
    items: state.items.map((item) => (item.id === updated.id ? updated : item)),
    unreadCount: becameRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
  }
}

export function applyMarkAllRead(
  state: NotificationPanelState,
  readAt: string,
): NotificationPanelState {
  return {
    ...state,
    items: state.items.map((item) => ({ ...item, readAt: item.readAt ?? readAt })),
    unreadCount: 0,
  }
}
