import { ROLE_LABEL } from '../data'
import { useApp } from '../store'
import { Segmented } from '../components/ui'

export function SettingsPage() {
  const app = useApp()
  return (
    <div className="max-w-xl space-y-4">
      <section className="rounded-md border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">ظاهر</h2>
        <p className="mb-3 mt-1 text-xs text-muted">زمینه روشن و تیره هر دو برای همین رابط تنظیم شده‌اند.</p>
        <Segmented
          label="زمینه"
          value={app.theme}
          onChange={app.setTheme}
          options={[{ id: 'light', label: 'روشن' }, { id: 'dark', label: 'تیره' }]}
        />
      </section>
      <section className="rounded-md border border-line bg-surface p-4 text-sm">
        <h2 className="text-sm font-semibold">حساب</h2>
        <dl className="mt-3 space-y-2">
          <div className="flex justify-between gap-3"><dt className="text-muted">نام</dt><dd>{app.personaName}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">نقش</dt><dd>{ROLE_LABEL[app.role]}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">ساختمان</dt><dd>{app.buildingName}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted">سامانه شماره موبایل و ایمیل جمع نمی‌کند. حساب‌ها را ادمین یا منابع انسانی می‌سازند.</p>
      </section>
    </div>
  )
}
