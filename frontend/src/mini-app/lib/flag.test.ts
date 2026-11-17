import { describe, expect, it } from 'vitest'
import { isMiniAppPath, normalizePathname } from './flag'

describe('mini-app path isolation', () => {
  it('does not claim the operational web routes', () => {
    expect(isMiniAppPath('/')).toBe(false)
    expect(isMiniAppPath('/menu')).toBe(false)
    expect(isMiniAppPath('/orders')).toBe(false)
    expect(isMiniAppPath('/employees')).toBe(false)
  })

  it('matches only /mini-app', () => {
    expect(isMiniAppPath('/mini-app')).toBe(true)
    expect(isMiniAppPath('/mini-app/')).toBe(true)
    expect(isMiniAppPath('/mini-app/orders')).toBe(true)
    expect(normalizePathname('/mini-app/')).toBe('/mini-app')
  })
})
