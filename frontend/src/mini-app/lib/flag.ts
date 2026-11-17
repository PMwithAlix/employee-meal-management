export const MINI_APP_PATH = '/mini-app'

export function normalizePathname(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

export function isMiniAppPath(pathname = window.location.pathname) {
  const path = normalizePathname(pathname)
  return path === MINI_APP_PATH || path.startsWith(`${MINI_APP_PATH}/`)
}

export function isBaleMiniAppEnabled() {
  const raw = import.meta.env.VITE_BALE_MINI_APP_ENABLED
  if (raw === 'false' || raw === '0') return false
  if (raw === 'true' || raw === '1') return true
  return import.meta.env.DEV
}
