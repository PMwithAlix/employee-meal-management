import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react'
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
  const [showPassword, setShowPassword] = useState(false)
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
      <div className="km-login-intro" aria-hidden="true">
        <div className="km-login-mark"><LockKeyhole size={27} strokeWidth={1.8} /></div>
        <div><strong>ورود امن و یکپارچه</strong><span>دسترسی شما بر اساس نقش ثبت‌شده در سامانه تعیین می‌شود.</span></div>
      </div>
      {webApp && webApp.isMiniAppSupported === false ? (
        <div className="km-card">
          <h2>این نسخه بله از مینی‌اپ پشتیبانی نمی‌کند</h2>
          <p>برنامه بله را به‌روز کنید یا از نسخه وب سامانه استفاده کنید.</p>
        </div>
      ) : null}
      <form className="km-stack" onSubmit={onSubmit}>
        <label className="km-field">
          <span><UserRound size={14} aria-hidden="true" /> نام کاربری</span>
          <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label className="km-field">
          <span><LockKeyhole size={14} aria-hidden="true" /> رمز عبور</span>
          <div className="km-password-control">
            <input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <button className="km-password-toggle" type="button" aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        {error ? <p className="km-form-error" role="alert">{error}</p> : null}
        <KmButton disabled={busy || !username || !password} type="submit">
          {busy ? 'در حال ورود…' : 'ورود'}
        </KmButton>
      </form>
    </KmScreen>
  )
}
