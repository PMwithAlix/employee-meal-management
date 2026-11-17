import { describe, expect, it } from 'vitest'
import { canOpenTab, tabsForRole } from './routes'

describe('mini-app role tabs', () => {
  it('keeps employee on ordering, not org admin tools', () => {
    expect(tabsForRole('employee').map((item) => item.id)).toEqual(['home', 'menu', 'orders', 'account'])
    expect(canOpenTab('employee', 'menu')).toBe(true)
    expect(canOpenTab('employee', 'staff')).toBe(false)
    expect(canOpenTab('employee', 'reports')).toBe(false)
  })

  it('gives HR personal menu plus staff, not org-order ops', () => {
    const ids = tabsForRole('hr').map((item) => item.id)
    expect(ids).toEqual(['home', 'menu', 'orders', 'staff', 'account'])
    expect(canOpenTab('hr', 'menu')).toBe(true)
    expect(canOpenTab('hr', 'org-orders')).toBe(false)
    expect(canOpenTab('hr', 'reports')).toBe(false)
  })

  it('gives Support personal menu plus order ops, not reports in Mini App', () => {
    const ids = tabsForRole('support').map((item) => item.id)
    expect(ids).toContain('menu')
    expect(ids).toContain('org-orders')
    expect(ids).toContain('orders')
    expect(ids).not.toContain('reports')
    expect(canOpenTab('support', 'menu')).toBe(true)
  })

  it('keeps management on reports and activity without personal ordering', () => {
    const ids = tabsForRole('management').map((item) => item.id)
    expect(ids).toEqual(['home', 'reports', 'activity', 'account'])
    expect(canOpenTab('management', 'menu')).toBe(false)
    expect(canOpenTab('management', 'orders')).toBe(false)
  })

  it('does not move risky admin tools or personal menu into the Mini App', () => {
    const ids = tabsForRole('admin').map((item) => item.id)
    expect(ids).toContain('org-orders')
    expect(ids).toContain('reports')
    expect(ids).not.toContain('staff')
    expect(ids).not.toContain('menu')
    expect(canOpenTab('admin', 'menu')).toBe(false)
  })
})
