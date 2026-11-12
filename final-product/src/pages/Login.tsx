import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button, Field, controlClass } from '../components/ui'

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('meal-theme', next ? 'dark' : 'light')
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 text-ink">
      <button className="absolute left-4 top-4 rounded-md border border-line bg-surface p-2" aria-label={dark ? 'زمینه روشن' : 'زمینه تیره'} title={dark ? 'زمینه روشن' : 'زمینه تیره'} onClick={toggleTheme}>
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <form
        className="w-full max-w-sm rounded-lg border border-line bg-surface p-5 shadow-card"
        onSubmit={(event) => {
          event.preventDefault()
          if (!username.trim() || !password.trim()) {
            setError('نام کاربری و رمز عبور را وارد کنید.')
            return
          }
          setError('')
          setBusy(true)
          window.setTimeout(onSuccess, 500)
        }}
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-primary font-semibold text-onprimary">غ</span>
          <span>
            <span className="block text-base font-semibold">سامانه غذا</span>
            <span className="block text-xs text-muted">ورود کارکنان</span>
          </span>
        </div>
        <div className="space-y-3">
          <Field label="نام کاربری">
            <input className={controlClass} autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
          </Field>
          <Field label="رمز عبور">
            <input className={controlClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <Button type="submit" className="mt-4 w-full" disabled={busy}>{busy ? 'در حال ورود' : 'ورود'}</Button>
        <p className="mt-4 text-xs leading-5 text-muted">حساب کاربری توسط ادمین یا منابع انسانی ساخته می‌شود. ثبت‌نام عمومی در این سامانه وجود ندارد.</p>
      </form>
    </div>
  )
}
