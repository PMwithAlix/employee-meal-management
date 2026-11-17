import { describe, expect, it } from 'vitest'
import { tabsForRole } from './routes'

describe('mini-app role tabs', () => {
  it('keeps employee on ordering, not org admin tools', () => {
    expect(tabsForRole('employee').map((item) => item.id)).toEqual(['home', 'menu', 'orders', 'account'])
  })

  it('does not give HR org-order ops or admin reports', () => {
    const ids = tabsForRole('hr').map((item) => item.id)
    expect(ids).toContain('staff')
    expect(ids).not.toContain('org-orders')
    expect(ids).not.toContain('reports')
  })

  it('does not move risky admin tools into the Mini App', () => {
    const ids = tabsForRole('admin').map((item) => item.id)
    expect(ids).not.toContain('staff')
    expect(ids).not.toContain('menu')
  })
})
