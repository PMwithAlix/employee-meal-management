import { describe, expect, it } from 'vitest'
import { errorFromResponse, networkError } from './errors'

describe('errorFromResponse', () => {
  it('uses the backend 401 message for bad credentials', () => {
    const error = errorFromResponse(401, { message: 'نام کاربری یا رمز عبور صحیح نیست.' })
    expect(error.kind).toBe('credentials')
    expect(error.message).toBe('نام کاربری یا رمز عبور صحیح نیست.')
  })

  it('uses the backend 403 message for inactive accounts', () => {
    const error = errorFromResponse(403, {
      message: 'حساب کاربری شما غیرفعال است. برای پیگیری با واحد منابع انسانی تماس بگیرید.',
    })
    expect(error.kind).toBe('inactive')
    expect(error.message).toContain('غیرفعال')
  })

  it('uses the backend 429 message for login throttling', () => {
    const error = errorFromResponse(429, {
      message: 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کنید.',
    })
    expect(error.kind).toBe('rate')
    expect(error.status).toBe(429)
  })

  it('does not treat a network failure as a logout', () => {
    const error = networkError()
    expect(error.kind).toBe('network')
    expect(error.status).toBeNull()
  })
})
