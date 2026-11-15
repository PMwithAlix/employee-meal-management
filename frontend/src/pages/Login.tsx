import { useState } from 'react'
import { Eye, EyeOff, Moon, Sun } from 'lucide-react'
import { useAuth } from '../app/providers/AuthProvider'
import { AuthRequestError } from '../features/auth/lib/auth-errors'
import { BrandWordmark } from '../shared/ui/Brand'
import { Button, Field, controlClass } from '../shared/ui/primitives'

export function Login() {
  const auth = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('meal-theme', next ? 'dark' : 'light')
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 text-ink">
      <button className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-md border border-line bg-surface" aria-label={dark ? 'زمینه روشن' : 'زمینه تیره'} title={dark ? 'زمینه روشن' : 'زمینه تیره'} onClick={toggleTheme}>
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <form
        className="w-full max-w-sm rounded-2xl border border-line bg-surface px-5 py-6 shadow-card"
        onSubmit={(event) => {
          event.preventDefault()
          if (busy) return
          if (!username.trim()) {
            setError('نام کاربری را وارد کنید.')
            return
          }
          if (!password.trim()) {
            setError('رمز عبور را وارد کنید.')
            return
          }
          setError('')
          setBusy(true)
          void auth
            .login(username.trim(), password)
            .catch((failure: unknown) => {
              if (failure instanceof AuthRequestError) {
                setError(failure.message)
                return
              }
              setError('ورود انجام نشد. نام کاربری یا رمز عبور را بررسی کنید.')
            })
            .finally(() => setBusy(false))
        }}
      >
        <div className="mb-6 text-center">
          <BrandWordmark className="mx-auto h-12" />
          <p className="mt-2 text-[11px] text-muted">برای ورود، اطلاعات حساب کاربری خود را وارد کنید.</p>
          <h1 className="mt-3 text-sm font-semibold">ورود به سامانه</h1>
        </div>
        <div className="space-y-3">
          <Field label="نام کاربری">
            <input className={controlClass} autoComplete="username" placeholder="نام کاربری انگلیسی" value={username} onChange={(event) => setUsername(event.target.value)} disabled={busy} />
          </Field>
          <Field label="رمز عبور">
            <div className="relative">
              <input
                className={`${controlClass} pe-11`}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="رمز عبور خود را وارد کنید"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                className="absolute end-0 top-0 grid h-11 w-11 place-items-center text-muted hover:text-ink"
                aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                title={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <Button type="submit" className="mt-4 w-full rounded-full" disabled={busy}>{busy ? 'در حال ورود...' : 'ورود به سامانه'}</Button>
        <p className="mt-4 text-xs leading-5 text-muted">برای دریافت یا بازنشانی رمز عبور، با واحد منابع انسانی تماس بگیرید.</p>
      </form>
    </div>
  )
}
