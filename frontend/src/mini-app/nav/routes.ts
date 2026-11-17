import { can, canAccess, type Capability } from '../../shared/config/permissions'
import type { Role } from '../../shared/types/domain'

export type MiniTab = 'home' | 'menu' | 'orders' | 'staff' | 'org-orders' | 'reports' | 'activity' | 'account'

export type MiniTabItem = {
  id: MiniTab
  label: string
}

const TAB_ITEMS: MiniTabItem[] = [
  { id: 'home', label: 'خانه' },
  { id: 'menu', label: 'منو' },
  { id: 'orders', label: 'سفارش‌ها' },
  { id: 'staff', label: 'کارکنان' },
  { id: 'org-orders', label: 'پیگیری' },
  { id: 'reports', label: 'گزارش' },
  { id: 'activity', label: 'فعالیت' },
  { id: 'account', label: 'حساب' },
]

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

export function canOpenTab(role: Role, tab: MiniTab) {
  if (tab === 'home' || tab === 'account') return true
  if (tab === 'menu') return can(role, 'order.self') && canAccess(role, 'menu')
  if (tab === 'orders') return can(role, 'order.self') && canAccess(role, 'orders')
  if (tab === 'org-orders') return can(role, 'order.ops')
  if (tab === 'staff') {
    return canAccess(role, 'employees') && can(role, 'employee.edit') && !can(role, 'order.ops')
  }
  if (tab === 'reports') return canAccess(role, 'reports') && !can(role, 'order.self')
  if (tab === 'activity') {
    return canAccess(role, 'activity') && !can(role, 'order.self') && !can(role, 'order.ops')
  }
  return false
}

export function tabsForRole(role: Role) {
  return TAB_ITEMS.filter((tab) => canOpenTab(role, tab.id))
}

export function canUse(role: Role, capability: Capability) {
  return can(role, capability)
}

export function tabPage(tab: MiniTab) {
  return TAB_PAGE[tab]
}
