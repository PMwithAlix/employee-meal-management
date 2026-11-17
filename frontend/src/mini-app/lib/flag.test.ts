import { describe, expect, it, vi } from 'vitest'
import { isBaleMiniAppEnabled, isMiniAppPath, normalizePathname } from './flag'

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

describe('mini-app feature flag', () => {
  it('enables the Mini App when the production build flag is true', () => {
    vi.stubEnv('VITE_BALE_MINI_APP_ENABLED', 'true')
    expect(isBaleMiniAppEnabled()).toBe(true)
    vi.unstubAllEnvs()
  })

  it('disables the Mini App when the production build flag is false', () => {
    vi.stubEnv('VITE_BALE_MINI_APP_ENABLED', 'false')
    expect(isBaleMiniAppEnabled()).toBe(false)
    vi.unstubAllEnvs()
  })
})
