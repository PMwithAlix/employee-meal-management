export type BaleThemeParams = {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
}

type BaleBackButton = {
  isVisible: boolean
  show: () => void
  hide: () => void
  onClick: (fn: () => void) => void
  offClick: (fn: () => void) => void
}

export type BaleWebApp = {
  initData: string
  initDataUnsafe: { user?: { id: number; first_name?: string }; auth_date?: number }
  ready: () => void
  expand: () => void
  close: () => void
  colorScheme?: 'light' | 'dark'
  themeParams?: BaleThemeParams
  isMiniAppSupported?: boolean
  isIframe?: boolean
  BackButton: BaleBackButton
}

declare global {
  interface Window {
    Bale?: { WebApp?: BaleWebApp }
  }
}

export function getBaleWebApp(): BaleWebApp | null {
  return window.Bale?.WebApp ?? null
}

export function bootBaleWebApp() {
  const app = getBaleWebApp()
  if (!app) return null
  try {
    app.ready()
    app.expand()
  } catch {
    return app
  }
  return app
}
