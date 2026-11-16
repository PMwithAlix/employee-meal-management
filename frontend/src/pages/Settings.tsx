import { useState } from 'react'
import { authApi } from '../features/auth/api/auth-api'
import { AuthRequestError } from '../features/auth/lib/auth-errors'
import { passwordIssue } from '../shared/lib/credentials'
import { useApp } from '../app/providers/app-store'
import { Button, Segmented } from '../shared/ui/primitives'
import { TimePicker } from '../shared/ui/TimePicker'
import { SecretField } from '../shared/ui/SecretField'
import { can } from '../shared/config/permissions'

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
          <p className="mt-1 text-xs text-muted">پس از تغییر رمز، همه نشست‌های این حساب بسته می‌شوند و باید دوباره وارد شوید.</p>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              setTried(true)
              setMessage('')
              setOk(false)
              if (blocked || saving) return
              setSaving(true)
              void authApi.changePassword(current, next, repeat).then(() => {
                setOk(true)
                setCurrent('')
                setNext('')
                setRepeat('')
                setTried(false)
                app.logout()
              }).catch((error: unknown) => {
                setMessage(error instanceof AuthRequestError ? error.message : 'تغییر رمز عبور انجام نشد.')
              }).finally(() => {
                setSaving(false)
              })
            }}
          >
            <div className="sm:col-span-2">
              <SecretField label="رمز فعلی" value={current} onChange={setCurrent} autoComplete="current-password" error={tried ? errors.current : ''} />
            </div>
            <SecretField label="رمز جدید" value={next} onChange={setNext} autoComplete="new-password" error={tried ? errors.next : ''} />
            <SecretField label="تکرار رمز جدید" value={repeat} onChange={setRepeat} autoComplete="new-password" error={tried ? errors.repeat : ''} />
            {message ? <p className="text-sm text-danger sm:col-span-2">{message}</p> : null}
            {ok ? <p className="text-sm text-ok sm:col-span-2">رمز عبور تغییر کرد. برای ادامه دوباره وارد شوید.</p> : null}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>{saving ? 'در حال ذخیره' : 'تغییر رمز عبور'}</Button>
            </div>
          </form>
        </section>
      </div>

      <div className="space-y-3">
      {can(app.role, 'settings.meals') && (
        <section className="h-fit rounded-md border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold">ساعت وعده‌های غذایی</h2>
          <p className="mt-1 text-xs text-muted">نظرسنجی فقط پس از این ساعت در همان روز شمسی ثبت می‌شود. تغییر ساعت، دیدگاه‌های قبلی را عوض نمی‌کند.</p>
          {app.mealServingsStatus === 'loading' ? <p className="mt-3 text-sm text-muted">در حال خواندن ساعت وعده از سامانه…</p> : null}
          {app.mealServingsStatus === 'unavailable' || app.mealServingsStatus === 'error' ? (
            <div className="mt-3">
              <p className="text-sm text-danger">{app.mealServingsMessage || 'ساعت وعده از سامانه خوانده نشد.'}</p>
              <Button className="mt-2" variant="secondary" onClick={app.retryMealServings}>تلاش دوباره</Button>
            </div>
          ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <TimePicker label="ناهار" value={app.mealServings.lunch} ariaLabel="ساعت سرو ناهار" onChange={(clock) => void app.setMealServing('lunch', clock)} />
            <TimePicker label="شام" value={app.mealServings.dinner} ariaLabel="ساعت سرو شام" onChange={(clock) => void app.setMealServing('dinner', clock)} />
          </div>
          )}
        </section>
      )}
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
