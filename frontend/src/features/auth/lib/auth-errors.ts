export type AuthFailureKind =
  | 'credentials'
  | 'inactive'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate'
  | 'network'
  | 'http'

export class AuthRequestError extends Error {
  readonly kind: AuthFailureKind
  readonly status: number | null
  readonly issues: string[]

  constructor(kind: AuthFailureKind, message: string, status: number | null = null, issues: string[] = []) {
    super(message)
    this.kind = kind
    this.status = status
    this.issues = issues
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
    const message = messageFromBody(body, 'حساب کاربری شما غیرفعال است. برای پیگیری با واحد منابع انسانی تماس بگیرید.')
    return new AuthRequestError(message.includes('غیرفعال') ? 'inactive' : 'forbidden', message, status)
  }
  if (status === 404) {
    return new AuthRequestError('not_found', messageFromBody(body, 'مورد درخواستی پیدا نشد.'), status)
  }
  if (status === 409) {
    return new AuthRequestError('conflict', messageFromBody(body, 'این مورد از قبل وجود دارد.'), status)
  }
  if (status === 422) {
    return new AuthRequestError(
      'validation',
      messageFromBody(body, 'اطلاعات ارسال‌شده معتبر نیست.'),
      status,
      issuesFromBody(body),
    )
  }
  if (status === 429) {
    return new AuthRequestError(
      'rate',
      messageFromBody(body, 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کنید.'),
      status,
    )
  }
  return new AuthRequestError('http', messageFromBody(body, 'درخواست انجام نشد. دوباره تلاش کنید.'), status, issuesFromBody(body))
}

function issuesFromBody(body: unknown) {
  if (!body || typeof body !== 'object') return []
  const raw = (body as { errors?: unknown }).errors
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (typeof item === 'string' && item.trim()) return item
      if (item && typeof item === 'object' && typeof (item as { message?: unknown }).message === 'string') {
        return (item as { message: string }).message
      }
      return ''
    })
    .filter(Boolean)
}

export function networkError() {
  return new AuthRequestError(
    'network',
    'ارتباط با سامانه برقرار نشد. اتصال شبکه یا در دسترس بودن سرور را بررسی کنید.',
  )
}
