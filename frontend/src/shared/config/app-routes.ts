import { isValidJalaliDate } from '../lib/jalali'
import type { Page, Role } from '../types/domain'
import { canAccess, LANDING_PAGE } from './permissions'

export const PAGE_PATHS: Record<Page, string> = {
  overview: '/',
  menu: '/menu',
  orders: '/orders',
  menuMgmt: '/menu-management',
  employees: '/employees',
  buildings: '/buildings',
  groups: '/groups',
  reports: '/reports',
  activity: '/activity',
  settings: '/settings',
  systemSettings: '/settings/system',
}

const PATH_PAGES = Object.fromEntries(
  Object.entries(PAGE_PATHS).map(([page, path]) => [path, page as Page]),
) as Record<string, Page>

export type RouteStatus = 'ok' | 'unknown' | 'forbidden'

export type AppLocation = {
  page: Page
  status: RouteStatus
  month: { jy: number; jm: number }
}

export function normalizePathname(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

export function pageFromPathname(pathname: string): Page | null {
  return PATH_PAGES[normalizePathname(pathname)] ?? null
}

export function monthFromSearch(search: string, fallback: { jy: number; jm: number }) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const jy = Number(params.get('jy'))
  const jm = Number(params.get('jm'))
  if (!isValidJalaliDate(jy, jm, 1)) return fallback
  return { jy, jm }
}

export function buildAppUrl(page: Page, month: { jy: number; jm: number }) {
  const params = new URLSearchParams()
  params.set('jy', String(month.jy))
  params.set('jm', String(month.jm))
  const path = PAGE_PATHS[page]
  return `${path}?${params.toString()}`
}

export function resolveAppLocation(
  pathname: string,
  search: string,
  role: Role,
  fallbackMonth: { jy: number; jm: number },
): AppLocation {
  const page = pageFromPathname(pathname)
  const month = monthFromSearch(search, fallbackMonth)
  if (!page) {
    return { page: LANDING_PAGE, status: 'unknown', month }
  }
  if (!canAccess(role, page)) {
    return { page, status: 'forbidden', month }
  }
  return { page, status: 'ok', month }
}

export function isPlainLeftClick(event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}
