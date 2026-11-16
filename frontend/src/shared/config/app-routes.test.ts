import { describe, expect, it } from 'vitest'
import { buildAppUrl, monthFromSearch, pageFromPathname, resolveAppLocation } from './app-routes'

describe('app routes', () => {
  it('maps stable pathnames onto pages', () => {
    expect(pageFromPathname('/')).toBe('overview')
    expect(pageFromPathname('/menu-management')).toBe('menuMgmt')
    expect(pageFromPathname('/menu-management/')).toBe('menuMgmt')
    expect(pageFromPathname('/reports')).toBe('reports')
    expect(pageFromPathname('/settings')).toBe('settings')
    expect(pageFromPathname('/settings/system')).toBe('systemSettings')
    expect(pageFromPathname('/unknown')).toBeNull()
  })

  it('keeps a jalali month from the query string', () => {
    expect(monthFromSearch('?jy=1405&jm=8', { jy: 1404, jm: 1 })).toEqual({ jy: 1405, jm: 8 })
    expect(monthFromSearch('', { jy: 1404, jm: 1 })).toEqual({ jy: 1404, jm: 1 })
  })

  it('marks unknown and forbidden locations without forcing overview as the requested page', () => {
    expect(resolveAppLocation('/nope', '', 'admin', { jy: 1405, jm: 1 }).status).toBe('unknown')
    expect(resolveAppLocation('/employees', '', 'employee', { jy: 1405, jm: 1 })).toMatchObject({
      page: 'employees',
      status: 'forbidden',
    })
    expect(resolveAppLocation('/menu-management', '?jy=1405&jm=8', 'admin', { jy: 1404, jm: 1 })).toMatchObject({
      page: 'menuMgmt',
      status: 'ok',
      month: { jy: 1405, jm: 8 },
    })
    expect(resolveAppLocation('/settings/system', '', 'employee', { jy: 1405, jm: 1 })).toMatchObject({
      page: 'systemSettings',
      status: 'forbidden',
    })
    expect(resolveAppLocation('/settings/system', '', 'admin', { jy: 1405, jm: 1 }).status).toBe('ok')
  })

  it('serializes a shareable URL for a page and month', () => {
    expect(buildAppUrl('menuMgmt', { jy: 1405, jm: 8 })).toBe('/menu-management?jy=1405&jm=8')
  })
})
