export type AuthFailureKind = 'credentials' | 'inactive' | 'rate' | 'network' | 'http'

export class AuthRequestError extends Error {
  readonly kind: AuthFailureKind
  readonly status: number | null

  constructor(kind: AuthFailureKind, message: string, status: number | null = null) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

function messageFromBody(body: unknown, fallback: string) {
  if (!body || typeof body !== 'object') return fallback
  const raw = (body as { message?: unknown }).message
  if (typeof raw === 'string' && raw.trim()) return raw
  if (Array.isArray(raw)) {
    const parts = raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    if (parts.length) return parts.join(' ')
  }
  return fallback
}

export function errorFromResponse(status: number, body: unknown): AuthRequestError {
  if (status === 401) {
    return new AuthRequestError(
      'credentials',
      messageFromBody(body, 'نام کاربری یا رمز عبور صحیح نیست.'),
      status,
    )
  }
  if (status === 403) {
    return new AuthRequestError(
      'inactive',
      messageFromBody(body, 'حساب کاربری شما غیرفعال است. برای پیگیری با واحد منابع انسانی تماس بگیرید.'),
      status,
    )
  }
  if (status === 429) {
    return new AuthRequestError(
      'rate',
      messageFromBody(body, 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کنید.'),
      status,
    )
  }
  return new AuthRequestError('http', messageFromBody(body, 'ورود انجام نشد. دوباره تلاش کنید.'), status)
}

export function networkError() {
  return new AuthRequestError(
    'network',
    'ارتباط با سامانه برقرار نشد. اتصال شبکه یا در دسترس بودن سرور را بررسی کنید.',
  )
}
