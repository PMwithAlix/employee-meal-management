import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, setUnauthorizedHandler } from '../../features/auth/api/auth-api'
import { AuthRequestError } from '../../features/auth/lib/auth-errors'
import { parseSessionUser, type SessionUser } from '../../features/auth/lib/session-roles'

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'unavailable' | 'invalid-role'

type AuthContextValue = {
  status: AuthStatus
  user: SessionUser | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  retrySession: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [bootKey, setBootKey] = useState(0)

  const applyUser = useCallback((payload: unknown): AuthStatus => {
    const parsed = parseSessionUser(payload)
    if (parsed === 'invalid-role') {
      setUser(null)
      return 'invalid-role'
    }
    if (!parsed) {
      setUser(null)
      return 'unauthenticated'
    }
    setUser(parsed)
    return 'authenticated'
  }, [])

  const clearSession = useCallback(() => {
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      setStatus((current) => (current === 'loading' ? current : 'unauthenticated'))
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    void authApi
      .me(controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return
        setStatus(applyUser(payload))
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof AuthRequestError && error.kind === 'network') {
          setUser(null)
          setStatus('unavailable')
          return
        }
        if (error instanceof AuthRequestError && error.status === 401) {
          clearSession()
          return
        }
        setUser(null)
        setStatus('unavailable')
      })
    return () => controller.abort()
  }, [applyUser, bootKey, clearSession])

  const login = useCallback(
    async (username: string, password: string) => {
      const payload = await authApi.login(username, password)
      const next = applyUser(payload)
      setStatus(next)
      if (next !== 'authenticated') {
        throw new AuthRequestError('http', 'نقش این حساب در سامانه پشتیبانی نمی‌شود.')
      }
    },
    [applyUser],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Cookie may remain if the network failed; local UI still returns to login.
    }
    clearSession()
  }, [clearSession])

  const retrySession = useCallback(() => {
    setBootKey((value) => value + 1)
  }, [])

  const value = useMemo(
    () => ({ status, user, login, logout, retrySession }),
    [status, user, login, logout, retrySession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
