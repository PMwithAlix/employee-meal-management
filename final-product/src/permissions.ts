import type { Page, Role } from './types'

export const ROLES: readonly Role[] = ['employee', 'hr', 'support', 'management', 'admin']

export const PAGE_ACCESS: Record<Role, readonly Page[]> = {
  employee: ['overview', 'menu', 'orders', 'settings'],
  hr: ['overview', 'menu', 'orders', 'employees', 'buildings', 'groups', 'settings'],
  support: ['overview', 'menu', 'orders', 'menuMgmt', 'reports', 'activity', 'settings'],
  management: ['overview', 'reports', 'activity', 'settings'],
  admin: ['overview', 'menuMgmt', 'reports', 'activity', 'employees', 'buildings', 'groups', 'settings'],
}

export type Capability =
  | 'order.self'
  | 'order.ops'
  | 'order.rate'
  | 'menu.edit'
  | 'guest.edit'
  | 'employee.edit'
  | 'building.edit'
  | 'group.edit'
  | 'settings.meals'

const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  employee: ['order.self', 'order.rate'],
  hr: ['order.self', 'order.rate', 'employee.edit', 'building.edit', 'group.edit'],
  support: ['order.self', 'order.ops', 'order.rate', 'menu.edit', 'guest.edit', 'settings.meals'],
  management: [],
  admin: ['order.ops', 'menu.edit', 'guest.edit', 'employee.edit', 'building.edit', 'group.edit', 'settings.meals'],
}

export function canAccess(role: Role, page: Page) {
  return PAGE_ACCESS[role].includes(page)
}

export function usesLiveOrganizationData(role: Role) {
  return role === 'support' || role === 'admin' || role === 'management'
}

export function can(role: Role, capability: Capability) {
  return ROLE_CAPABILITIES[role].includes(capability)
}

export const LANDING_PAGE: Page = 'overview'
