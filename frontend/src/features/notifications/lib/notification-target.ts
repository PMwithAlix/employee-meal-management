const STORAGE_KEY = 'khaan.menu-notification-target'

export type MenuNotificationTarget = {
  page: 'menu'
  jalaliYear: number
  jalaliMonth: number
  menuId: string
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export function parseMenuNotificationTarget(data: unknown): MenuNotificationTarget | null {
  const record = asRecord(data)
  if (!record || record.page !== 'menu') return null
  if (typeof record.jalaliYear !== 'number' || !Number.isInteger(record.jalaliYear)) return null
  if (typeof record.jalaliMonth !== 'number' || !Number.isInteger(record.jalaliMonth)) return null
  if (record.jalaliMonth < 1 || record.jalaliMonth > 12) return null
  if (typeof record.menuId !== 'string' || !record.menuId) return null
  return {
    page: 'menu',
    jalaliYear: record.jalaliYear,
    jalaliMonth: record.jalaliMonth,
    menuId: record.menuId,
  }
}

export function persistMenuDeepLink(target: MenuNotificationTarget) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(target))
  } catch {
    // Private mode or quota; navigation still proceeds in the current session.
  }
}

export function consumeMenuDeepLink(): MenuNotificationTarget | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(STORAGE_KEY)
    return parseMenuNotificationTarget(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}
