import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, setUnauthorizedHandler } from '../../features/auth/api/auth-api'
import { AuthRequestError } from '../../features/auth/lib/auth-errors'
import { parseSessionUser, type SessionUser } from '../../features/auth/lib/session-roles'
import { baleApi } from '../api/bale-api'
import { getBaleWebApp } from '../sdk/bale-webapp'

type MiniAuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'unavailable' | 'invalid-role'

type MiniAuthValue = {
  status: MiniAuthStatus
  user: SessionUser | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  retry: () => void
}

const MiniAuthContext = createContext<MiniAuthValue | null>(null)

export function MiniAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MiniAuthStatus>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [boot, setBoot] = useState(0)

  const apply = useCallback((payload: unknown): MiniAuthStatus => {
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
        if (!controller.signal.aborted) setStatus(apply(payload))
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof AuthRequestError && error.status === 401) {
          setUser(null)
          setStatus('unauthenticated')
          return
        }
        setUser(null)
        setStatus(error instanceof AuthRequestError && error.kind === 'network' ? 'unavailable' : 'unavailable')
      })
    return () => controller.abort()
  }, [apply, boot])

  const login = useCallback(
    async (username: string, password: string) => {
      const initData = getBaleWebApp()?.initData ?? ''
      try {
        const payload = await baleApi.login({ initData, username, password })
        setStatus(apply(payload))
      } catch (error) {
        const canFallback =
          error instanceof AuthRequestError &&
          (error.status === 404 || (error.status === 401 && !initData))
        if (canFallback) {
          const payload = await authApi.login(username, password)
          setStatus(apply(payload))
          return
        }
        throw error
      }
    },
    [apply],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  const value = useMemo(
    () => ({
      status,
      user,
      login,
      logout,
      retry: () => setBoot((value) => value + 1),
    }),
    [status, user, login, logout],
  )

  return <MiniAuthContext.Provider value={value}>{children}</MiniAuthContext.Provider>
}

export function useMiniAuth() {
  const value = useContext(MiniAuthContext)
  if (!value) throw new Error('MiniAuthProvider missing')
  return value
}
