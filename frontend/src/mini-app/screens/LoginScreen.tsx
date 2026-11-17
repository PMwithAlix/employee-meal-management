import { useState, type FormEvent } from 'react'
import { AuthRequestError } from '../../features/auth/lib/auth-errors'
import { useMiniAuth } from '../auth/MiniAuth'
import { getBaleWebApp } from '../sdk/bale-webapp'
import { KmButton, KmScreen } from '../ui/primitives'

export function LoginScreen() {
  const auth = useMiniAuth()
  const webApp = getBaleWebApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await auth.login(username, password)
    } catch (caught) {
      setError(caught instanceof AuthRequestError ? caught.message : 'ورود انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <KmScreen title="ورود به خوان" subtitle="با همان حساب سامانه وب وارد شوید. نقش شما از سرور خوانده می‌شود.">
      {webApp && webApp.isMiniAppSupported === false ? (
        <div className="km-card">
          <h2>این نسخه بله از مینی‌اپ پشتیبانی نمی‌کند</h2>
          <p>برنامه بله را به‌روز کنید یا از نسخه وب سامانه استفاده کنید.</p>
        </div>
      ) : null}
      <form className="km-stack" onSubmit={onSubmit}>
        <label className="km-field">
          <span>نام کاربری</span>
          <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label className="km-field">
          <span>رمز عبور</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <p className="km-muted" style={{ color: 'var(--km-danger)' }}>{error}</p> : null}
        <KmButton disabled={busy || !username || !password} type="submit">
          {busy ? 'در حال ورود…' : 'ورود'}
        </KmButton>
      </form>
    </KmScreen>
  )
}
