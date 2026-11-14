export type DeadlinePanelView =
  | { kind: 'loading' }
  | { kind: 'empty-menu'; message: string }
  | { kind: 'empty-open'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'ready' }

const EMPTY_MENU = 'برای این ماه منوی منتشرشده‌ای وجود ندارد.'
const EMPTY_OPEN = 'روز بازی با مهلت ذخیره‌شده نیست.'
const FALLBACK_ERROR = 'مهلت‌ها از سامانه خوانده نشد.'

export function opsDeadlinePanel(input: {
  publishedStatus: string
  publishedMessage: string
  deadlineStatus: string
  deadlineMessage: string
  openCount: number
}): DeadlinePanelView {
  if (input.publishedStatus === 'loading' || input.deadlineStatus === 'loading') {
    return { kind: 'loading' }
  }
  if (input.publishedStatus === 'empty' && input.deadlineStatus === 'ready') {
    return { kind: 'empty-menu', message: EMPTY_MENU }
  }
  if (input.publishedStatus === 'ready' && input.deadlineStatus === 'ready') {
    return input.openCount === 0
      ? { kind: 'empty-open', message: EMPTY_OPEN }
      : { kind: 'ready' }
  }
  return {
    kind: 'error',
    message: input.publishedMessage || input.deadlineMessage || FALLBACK_ERROR,
  }
}

export function opsDeadlineFailed(publishedStatus: string, deadlineStatus: string) {
  return opsDeadlinePanel({
    publishedStatus,
    publishedMessage: '',
    deadlineStatus,
    deadlineMessage: '',
    openCount: 0,
  }).kind === 'error'
}

export function overviewBannerMessage(input: {
  countsMessage: string
  guestsMessage?: string
  publishedMessage: string
  deadlineMessage: string
  recentMessage: string
}) {
  return (
    input.countsMessage ||
    input.guestsMessage ||
    input.publishedMessage ||
    input.deadlineMessage ||
    input.recentMessage ||
    'داده‌های نمای کلی از سامانه خوانده نشد.'
  )
}
