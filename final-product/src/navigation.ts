import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  History,
  Layers,
  LayoutDashboard,
  Settings,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { canAccess } from './permissions'
import type { Page, Role } from './types'

export const PAGE_TITLES: Record<Page, string> = {
  overview: 'نمای کلی',
  menu: 'منوی ماهانه',
  orders: 'سفارش‌های من',
  menuMgmt: 'مدیریت منو',
  employees: 'مدیریت کارکنان',
  buildings: 'مدیریت ساختمان‌ها',
  groups: 'گروه‌های کارکنان',
  reports: 'گزارش‌ها',
  activity: 'تاریخچه فعالیت‌ها',
  settings: 'حساب کاربری',
}

export const NAV_ITEMS: Array<{ id: Page; label: string; group: string; icon: LucideIcon }> = [
  { id: 'overview', label: PAGE_TITLES.overview, group: 'کار روزانه', icon: LayoutDashboard },
  { id: 'menu', label: PAGE_TITLES.menu, group: 'کار روزانه', icon: CalendarDays },
  { id: 'orders', label: PAGE_TITLES.orders, group: 'کار روزانه', icon: ClipboardList },
  { id: 'menuMgmt', label: PAGE_TITLES.menuMgmt, group: 'عملیات', icon: UtensilsCrossed },
  { id: 'employees', label: PAGE_TITLES.employees, group: 'سازمان', icon: Users },
  { id: 'buildings', label: PAGE_TITLES.buildings, group: 'سازمان', icon: Building2 },
  { id: 'groups', label: PAGE_TITLES.groups, group: 'سازمان', icon: Layers },
  { id: 'reports', label: PAGE_TITLES.reports, group: 'نظارت', icon: BarChart3 },
  { id: 'activity', label: PAGE_TITLES.activity, group: 'نظارت', icon: History },
  { id: 'settings', label: PAGE_TITLES.settings, group: 'سیستم', icon: Settings },
]

export const PRIMARY_NAV: Record<Role, readonly Page[]> = {
  employee: ['menu', 'orders', 'overview'],
  support: ['overview', 'orders', 'menuMgmt', 'reports'],
  hr: ['overview', 'employees', 'buildings', 'groups'],
  management: ['overview', 'reports', 'activity'],
  admin: ['overview', 'employees', 'menuMgmt', 'reports'],
}

export function pageTitle(page: Page, role: Role) {
  if (page === 'orders' && role === 'support') return 'مدیریت سفارش‌ها'
  return PAGE_TITLES[page]
}

export function navIcon(page: Page) {
  return NAV_ITEMS.find((item) => item.id === page)?.icon ?? LayoutDashboard
}

export function primaryNavPages(role: Role) {
  return PRIMARY_NAV[role].filter((page) => canAccess(role, page))
}

export function moreNavPages(role: Role) {
  const primary = new Set(primaryNavPages(role))
  return NAV_ITEMS.map((item) => item.id).filter((page) => canAccess(role, page) && !primary.has(page))
}
