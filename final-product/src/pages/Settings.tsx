import { useState } from 'react'
import { DEMO_PASSWORD, passwordIssue } from '../lib/credentials'
import { useApp } from '../store'
import { Button, Segmented } from '../components/ui'
import { SecretField } from '../components/SecretField'

export function SettingsPage() {
  const app = useApp()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [ok, setOk] = useState(false)
  const errors = {
    current: current ? '' : 'رمز فعلی را وارد کنید.',
    next: passwordIssue(next),
    repeat: repeat !== next ? 'تکرار رمز با رمز جدید یکسان نیست.' : '',
  }
  const blocked = Boolean(errors.current || errors.next || errors.repeat)

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
      <div className="space-y-3">
        <section className="rounded-md border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold">اطلاعات حساب</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <Info label="نام کاربری" value={app.personaUsername} ltr />
          </dl>
          <p className="mt-3 text-xs text-muted">شناسه قابل مشاهده حساب، نام کاربری است. سامانه شماره موبایل و ایمیل جمع نمی‌کند.</p>
        </section>

        <section className="rounded-md border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold">امنیت حساب</h2>
          <p className="mt-1 text-xs text-muted">تغییر رمز فقط در همین نشست نمایشی اعمال می‌شود و ورود واقعی را کنترل نمی‌کند. رمز فعلی حساب‌های نمایشی در شروع نشست «{DEMO_PASSWORD}» است.</p>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              setTried(true)
              setMessage('')
              setOk(false)
              if (blocked || saving) return
              setSaving(true)
              const result = app.changePassword(current, next)
              setSaving(false)
              if (result) {
                setMessage(result)
                return
              }
              setOk(true)
              setCurrent('')
              setNext('')
              setRepeat('')
              setTried(false)
            }}
          >
            <div className="sm:col-span-2">
              <SecretField label="رمز فعلی" value={current} onChange={setCurrent} autoComplete="current-password" error={tried ? errors.current : ''} />
            </div>
            <SecretField label="رمز جدید" value={next} onChange={setNext} autoComplete="new-password" error={tried ? errors.next : ''} />
            <SecretField label="تکرار رمز جدید" value={repeat} onChange={setRepeat} autoComplete="new-password" error={tried ? errors.repeat : ''} />
            {message ? <p className="text-sm text-danger sm:col-span-2">{message}</p> : null}
            {ok ? <p className="text-sm text-ok sm:col-span-2">رمز عبور در این نشست به‌روز شد.</p> : null}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>{saving ? 'در حال ذخیره' : 'تغییر رمز عبور'}</Button>
            </div>
          </form>
        </section>
      </div>

      <section className="h-fit rounded-md border border-line bg-surface p-4">
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

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md bg-surface2 px-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd dir={ltr ? 'ltr' : undefined} className="text-end font-medium">{value}</dd>
    </div>
  )
}
