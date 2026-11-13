import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiBaseUrl, authApi, authRequest, setUnauthorizedHandler } from './client'
import { AuthRequestError } from './errors'

describe('apiBaseUrl', () => {
  it('uses same-origin when VITE_API_BASE_URL is empty so the cookie stays on /api/v1', () => {
    expect(apiBaseUrl()).toBe('')
  })
})

describe('authRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setUnauthorizedHandler(null)
  })

  it('sends cookies and never stores a token', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await authRequest('/auth/me')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.credentials).toBe('include')
    expect(JSON.stringify(init)).not.toMatch(/khaan\.sid|accessToken|sessionToken/i)
  })

  it('posts login credentials to the backend contract', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: '1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await authApi.login('e2e.order.employee', 'secret')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auth/login')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ username: 'e2e.order.employee', password: 'secret' }))
  })

  it('maps 401 on login without treating it as a boot-time logout', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'نام کاربری یا رمز عبور صحیح نیست.' }), { status: 401 })),
    )
    await expect(authApi.login('x', 'y')).rejects.toMatchObject({
      kind: 'credentials',
      status: 401,
    } satisfies Partial<AuthRequestError>)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('notifies the session handler only for authenticated 401s', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })))
    await expect(authApi.logout()).rejects.toBeInstanceOf(AuthRequestError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })
})
