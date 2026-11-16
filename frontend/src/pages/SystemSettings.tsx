import { useEffect, useState } from 'react'
import { OrderDeadlinePolicyPanel } from '../features/orders/ui/OrderDeadlinePolicyPanel'
import { useApp } from '../app/providers/app-store'
import { Button } from '../shared/ui/primitives'
import { TimePicker } from '../shared/ui/TimePicker'
import type { MealServings } from '../shared/types/domain'

export function SystemSettingsPage() {
  return (
    <div className="space-y-4">
      <section className="rounded-md border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">تنظیمات عملیاتی</h2>
        <p className="mt-1 text-xs text-muted">ساعت سرو غذا و مهلت ثبت سفارش جداگانه تنظیم می‌شوند.</p>
      </section>
      <MealServingsPanel />
      <OrderDeadlinePolicyPanel />
    </div>
  )
}

function MealServingsPanel() {
  const app = useApp()
  const [draft, setDraft] = useState<MealServings>(app.mealServings)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setDraft(app.mealServings)
  }, [app.mealServings])

  const dirty = draft.lunch !== app.mealServings.lunch || draft.dinner !== app.mealServings.dinner
  const ready = app.mealServingsStatus === 'ready'

  return (
    <section className="rounded-md border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold">زمان سرو وعده‌ها</h3>
      <p className="mt-1 text-xs text-muted">نظرسنجی فقط پس از این ساعت در همان روز شمسی ثبت می‌شود. تغییر ساعت، دیدگاه‌های قبلی را عوض نمی‌کند.</p>
      {app.mealServingsStatus === 'loading' ? <p className="mt-3 text-sm text-muted">در حال خواندن ساعت وعده از سامانه…</p> : null}
      {app.mealServingsStatus === 'unavailable' || app.mealServingsStatus === 'error' ? (
        <div className="mt-3">
          <p className="text-sm text-danger">{app.mealServingsMessage || 'ساعت وعده از سامانه خوانده نشد.'}</p>
          <Button className="mt-2" variant="secondary" onClick={app.retryMealServings}>تلاش دوباره</Button>
        </div>
      ) : null}
      {ready && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <TimePicker label="ناهار" value={draft.lunch} ariaLabel="ساعت سرو ناهار" disabled={busy} onChange={(clock) => setDraft((current) => ({ ...current, lunch: clock }))} />
            <TimePicker label="شام" value={draft.dinner} ariaLabel="ساعت سرو شام" disabled={busy} onChange={(clock) => setDraft((current) => ({ ...current, dinner: clock }))} />
          </div>
          {dirty && <p className="text-xs text-muted">تغییرات ذخیره‌نشده دارند.</p>}
          {app.mealServingsMessage && <p className="text-sm text-danger" role="alert">{app.mealServingsMessage}</p>}
          {notice && <p className="text-sm text-ok" role="status">{notice}</p>}
          <Button
            disabled={busy || !dirty}
            onClick={() => {
              setBusy(true)
              setNotice('')
              void app.saveMealServings(draft).then((ok) => {
                if (ok) setNotice('ساعت سرو وعده‌ها ذخیره شد.')
              }).finally(() => setBusy(false))
            }}
          >
            {busy ? 'در حال ذخیره' : 'ذخیره ساعت سرو'}
          </Button>
        </div>
      )}
    </section>
  )
}
