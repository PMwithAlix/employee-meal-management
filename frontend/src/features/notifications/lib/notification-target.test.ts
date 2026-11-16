import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { consumeMenuDeepLink, parseMenuNotificationTarget, persistMenuDeepLink } from './notification-target'

const memory = new Map<string, string>()
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value)
  },
  removeItem: (key: string) => {
    memory.delete(key)
  },
  clear: () => memory.clear(),
}

beforeEach(() => {
  memory.clear()
  Object.defineProperty(globalThis, 'sessionStorage', { value: storage, configurable: true })
})

afterEach(() => {
  memory.clear()
})

describe('parseMenuNotificationTarget', () => {
  it('reads a stable month destination from notification data', () => {
    expect(
      parseMenuNotificationTarget({
        page: 'menu',
        jalaliYear: 1405,
        jalaliMonth: 8,
        menuId: 'menu-aban',
      }),
    ).toEqual({
      page: 'menu',
      jalaliYear: 1405,
      jalaliMonth: 8,
      menuId: 'menu-aban',
    })
  })

  it('rejects payloads that would send the user to the home page', () => {
    expect(parseMenuNotificationTarget({ page: 'overview', jalaliYear: 1405, jalaliMonth: 8, menuId: 'x' })).toBeNull()
    expect(parseMenuNotificationTarget({ jalaliYear: 1405, jalaliMonth: 8, menuId: 'x' })).toBeNull()
  })
})

describe('menu deep-link storage', () => {
  it('keeps an older notification month after persist and consume', () => {
    persistMenuDeepLink({
      page: 'menu',
      jalaliYear: 1404,
      jalaliMonth: 11,
      menuId: 'old-menu',
    })
    expect(consumeMenuDeepLink()).toMatchObject({ jalaliYear: 1404, jalaliMonth: 11, menuId: 'old-menu' })
    expect(consumeMenuDeepLink()).toBeNull()
  })
})
