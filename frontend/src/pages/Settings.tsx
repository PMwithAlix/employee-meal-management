import { useEffect, useRef, useState } from 'react'
import { authApi } from '../features/auth/api/auth-api'
import { AuthRequestError } from '../features/auth/lib/auth-errors'
import { passwordIssue } from '../shared/lib/credentials'
import { useApp } from '../app/providers/app-store'
import { ROLE_LABEL } from '../shared/fixtures/seed-data'
import { Button, Segmented } from '../shared/ui/primitives'
import { SecretField } from '../shared/ui/SecretField'

const LOGOUT_AFTER_MS = 2000

export function SettingsPage() {
  const app = useApp()
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <section className="rounded-md border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">اطلاعات حساب</h2>
        <p className="mt-1 text-xs text-muted">شناسه قابل مشاهده حساب، نام کاربری است. سامانه شماره موبایل و ایمیل جمع نمی‌کند.</p>
        <dl className="mt-3 grid gap-2 text-sm">
          <Info label="نام کاربری" value={app.personaUsername} ltr />
          <Info label="نقش" value={ROLE_LABEL[app.role]} />
        </dl>
      </section>

      <PasswordForm onSignedOut={app.logout} />

      <section className="rounded-md border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">تنظیمات ظاهری</h2>
        <p className="mb-3 mt-1 text-xs text-muted">زمینه روشن و تیره هر دو برای همین رابط تنظیم شده‌اند.</p>
        <Segmented
          label="زمینه"
          size="touch"
          value={app.theme}
          onChange={app.setTheme}
          options={[{ id: 'light', label: 'روشن' }, { id: 'dark', label: 'تیره' }]}
        />
      </section>
    </div>
  )
}

function PasswordForm({ onSignedOut }: { onSignedOut: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [touched, setTouched] = useState({ current: false, next: false, repeat: false })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState('')
  const [currentError, setCurrentError] = useState('')
  const logoutTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (logoutTimer.current) window.clearTimeout(logoutTimer.current)
  }, [])

  const nextIssue = passwordIssue(next)
  const repeatIssue = repeat !== next ? 'تکرار رمز با رمز جدید یکسان نیست.' : ''
  const emptyCurrent = current ? '' : 'رمز فعلی را وارد کنید.'
  const errors = {
    current: currentError || ((touched.current || saving) ? emptyCurrent : ''),
    next: touched.next || next.length > 0 ? nextIssue : '',
    repeat: touched.repeat || repeat.length > 0 ? repeatIssue : '',
  }
  const blocked = Boolean(emptyCurrent || nextIssue || repeatIssue)
  const locked = saving || done

  return (
    <section className="rounded-md border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold">امنیت حساب</h2>
      <p className="mt-1 text-xs text-muted">پس از تغییر رمز، همه نشست‌های این حساب بسته می‌شوند و باید دوباره وارد شوید.</p>
      <form
        className="mt-3 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          setTouched({ current: true, next: true, repeat: true })
          setMessage('')
          setCurrentError('')
          if (blocked || locked) return
          setSaving(true)
          void authApi.changePassword(current, next, repeat).then(() => {
            setDone(true)
            setCurrent('')
            setNext('')
            setRepeat('')
            logoutTimer.current = window.setTimeout(() => {
              onSignedOut()
            }, LOGOUT_AFTER_MS)
          }).catch((error: unknown) => {
            if (error instanceof AuthRequestError && (error.status === 401 || error.kind === 'credentials')) {
              setCurrentError(error.message)
              return
            }
            setMessage(error instanceof AuthRequestError ? error.message : 'تغییر رمز عبور انجام نشد.')
          }).finally(() => {
            setSaving(false)
          })
        }}
      >
        <SecretField
          label="رمز فعلی"
          value={current}
          onChange={(value) => {
            setCurrent(value)
            setCurrentError('')
          }}
          onBlur={() => setTouched((currentTouched) => ({ ...currentTouched, current: true }))}
          autoComplete="current-password"
          error={errors.current}
        />
        <SecretField
          label="رمز جدید"
          value={next}
          onChange={setNext}
          onBlur={() => setTouched((currentTouched) => ({ ...currentTouched, next: true }))}
          autoComplete="new-password"
          error={errors.next}
        />
        <SecretField
          label="تکرار رمز جدید"
          value={repeat}
          onChange={setRepeat}
          onBlur={() => setTouched((currentTouched) => ({ ...currentTouched, repeat: true }))}
          autoComplete="new-password"
          error={errors.repeat}
        />
        {message ? <p className="text-sm text-danger" role="alert">{message}</p> : null}
        {done ? <p className="text-sm text-ok" role="status">رمز عبور تغییر کرد. برای ادامه دوباره وارد شوید.</p> : null}
        <div>
          <Button type="submit" disabled={locked}>{saving ? 'در حال ذخیره' : done ? 'رمز تغییر کرد' : 'تغییر رمز عبور'}</Button>
        </div>
      </form>
    </section>
  )
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md bg-surface2 px-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd dir={ltr ? 'ltr' : undefined} className="text-end font-medium">{value}</dd>
    </div>
  )
}
