import { describe, expect, it } from 'vitest'
import { can, canAccess, usesLiveOrganizationData, type Capability } from './permissions'
import type { Page, Role } from './types'

const mutating: Capability[] = [
  'order.self',
  'order.ops',
  'order.rate',
  'menu.edit',
  'guest.edit',
  'employee.edit',
  'building.edit',
  'group.edit',
  'settings.meals',
]

describe('usesLiveOrganizationData', () => {
  it('connects management, support and admin reports/activity to live APIs', () => {
    expect(usesLiveOrganizationData('management')).toBe(true)
    expect(usesLiveOrganizationData('support')).toBe(true)
    expect(usesLiveOrganizationData('admin')).toBe(true)
  })

  it('keeps employee and HR on seed store pages', () => {
    expect(usesLiveOrganizationData('employee')).toBe(false)
    expect(usesLiveOrganizationData('hr')).toBe(false)
  })
})

describe('management observer access', () => {
  it('can open reports and activity without mutating capabilities', () => {
    expect(canAccess('management', 'reports')).toBe(true)
    expect(canAccess('management', 'activity')).toBe(true)
    for (const capability of mutating) {
      expect(can('management', capability)).toBe(false)
    }
  })

  it('does not change other roles’ page or capability maps', () => {
    const pages: Record<Role, Page[]> = {
      employee: ['overview', 'menu', 'orders', 'settings'],
      hr: ['overview', 'menu', 'orders', 'employees', 'buildings', 'groups', 'settings'],
      support: ['overview', 'menu', 'orders', 'menuMgmt', 'reports', 'activity', 'settings'],
      management: ['overview', 'reports', 'activity', 'settings'],
      admin: ['overview', 'menuMgmt', 'reports', 'activity', 'employees', 'buildings', 'groups', 'settings'],
    }
    for (const role of Object.keys(pages) as Role[]) {
      for (const page of pages[role]) {
        expect(canAccess(role, page)).toBe(true)
      }
    }
    expect(can('employee', 'order.self')).toBe(true)
    expect(can('hr', 'employee.edit')).toBe(true)
    expect(can('support', 'order.ops')).toBe(true)
    expect(can('admin', 'menu.edit')).toBe(true)
  })
})
