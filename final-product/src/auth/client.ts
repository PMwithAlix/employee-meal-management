import { errorFromResponse, networkError } from './errors'

// Session cookie `khaan.sid` is HttpOnly (Path=/api/v1). Never persist tokens in web storage.
// Not wired in this stage: POST /api/v1/auth/logout-all, POST /api/v1/auth/change-password.

export function apiBaseUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL
  if (typeof raw !== 'string' || raw.trim() === '' || raw === '/') return ''
  return raw.replace(/\/$/, '')
}

type RequestOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
  signal?: AbortSignal
  treatUnauthorizedAsSessionEnd?: boolean
}

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

export async function authRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${apiBaseUrl()}/api/v1${path}`
  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: options.body
        ? { Accept: 'application/json', 'Content-Type': 'application/json' }
        : { Accept: 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw networkError()
  }

  let body: unknown = null
  const text = await response.text()
  if (text) {
    try {
      body = JSON.parse(text) as unknown
    } catch {
      body = { message: text }
    }
  }

  if (response.status === 401 && options.treatUnauthorizedAsSessionEnd) {
    unauthorizedHandler?.()
  }

  if (!response.ok) {
    throw errorFromResponse(response.status, body)
  }

  return body as T
}

export const authApi = {
  login(username: string, password: string) {
    return authRequest<unknown>('/auth/login', {
      method: 'POST',
      body: { username, password },
    })
  },
  me(signal?: AbortSignal) {
    return authRequest<unknown>('/auth/me', { signal })
  },
  logout() {
    return authRequest<{ ok: true }>('/auth/logout', {
      method: 'POST',
      treatUnauthorizedAsSessionEnd: true,
    })
  },
}
