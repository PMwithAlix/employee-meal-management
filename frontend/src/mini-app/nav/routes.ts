import { can, canAccess, type Capability } from '../../shared/config/permissions'
import type { Role } from '../../shared/types/domain'

export type MiniTab = 'home' | 'menu' | 'orders' | 'staff' | 'org-orders' | 'reports' | 'activity' | 'account'

export type MiniTabItem = {
  id: MiniTab
  label: string
}

const ROLE_TABS: Record<Role, MiniTabItem[]> = {
  employee: [
    { id: 'home', label: 'خانه' },
    { id: 'menu', label: 'منو' },
    { id: 'orders', label: 'سفارش‌ها' },
    { id: 'account', label: 'حساب' },
  ],
  hr: [
    { id: 'home', label: 'خانه' },
    { id: 'staff', label: 'کارکنان' },
    { id: 'orders', label: 'سفارش‌ها' },
    { id: 'account', label: 'حساب' },
  ],
  support: [
    { id: 'home', label: 'خانه' },
    { id: 'org-orders', label: 'پیگیری' },
    { id: 'orders', label: 'سفارش‌ها' },
    { id: 'account', label: 'حساب' },
  ],
  management: [
    { id: 'home', label: 'خانه' },
    { id: 'reports', label: 'گزارش' },
    { id: 'activity', label: 'فعالیت' },
    { id: 'account', label: 'حساب' },
  ],
  admin: [
    { id: 'home', label: 'خانه' },
    { id: 'org-orders', label: 'سفارش‌ها' },
    { id: 'reports', label: 'گزارش' },
    { id: 'account', label: 'حساب' },
  ],
}

const TAB_PAGE = {
  home: 'overview',
  menu: 'menu',
  orders: 'orders',
  staff: 'employees',
  'org-orders': 'orders',
  reports: 'reports',
  activity: 'activity',
  account: 'settings',
} as const

export function tabsForRole(role: Role) {
  return ROLE_TABS[role].filter((tab) => {
    if (tab.id === 'home' || tab.id === 'account') return true
    if (tab.id === 'org-orders') return can(role, 'order.ops')
    if (tab.id === 'staff') return canAccess(role, 'employees')
    if (tab.id === 'menu') return canAccess(role, 'menu')
    if (tab.id === 'orders') return canAccess(role, 'orders') && can(role, 'order.self')
    if (tab.id === 'reports') return canAccess(role, 'reports')
    if (tab.id === 'activity') return canAccess(role, 'activity')
    return false
  })
}

export function canUse(role: Role, capability: Capability) {
  return can(role, capability)
}

export function tabPage(tab: MiniTab) {
  return TAB_PAGE[tab]
}
