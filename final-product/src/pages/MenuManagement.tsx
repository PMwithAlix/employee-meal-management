import { useRef, useState } from 'react'
import { MealBlock } from '../components/MealBlock'
import { SelectMealDialog } from '../components/SelectMealDialog'
import { Badge, Button, Dialog, Empty, Field, controlClass } from '../components/ui'
import { fullName } from '../data'
import { AuthRequestError } from '../auth/errors'
import { menuApi } from '../menus/client'
import { localOption } from '../menus/map'
import type { ImportPreview, MenuOption } from '../menus/types'
import { useManagedMenu } from '../menus/useManagedMenu'
import { useApp } from '../store'
import { findOrder, isMealOpen } from '../lib/orders'
import { formatDeadline, type DeadlineRelation } from '../lib/deadlines'
import { isPastDate, JALALI_MONTHS } from '../lib/jalali'
import { fa, faBytes } from '../lib/text'
import type { MealKind, ReplacePolicy } from '../types'

const POLICIES: Array<{ id: ReplacePolicy; title: string; body: string }> = [
  { id: 'keep', title: 'حفظ سفارش‌های قبلی', body: 'غذای ثبت‌شده سر جایش می‌ماند، حتی اگر در منوی جدید نباشد.' },
  { id: 'match', title: 'تطبیق سفارش‌های قبلی با منوی جدید', body: 'اگر غذای ثبت‌شده در منوی جدید نباشد، همان سفارش خالی می‌شود.' },
  { id: 'reset', title: 'بازنشانی سفارش‌های قبلی', body: 'همه انتخاب‌های این ماه پاک می‌شوند. این کار پرریسک است.' },
]

export function MenuManagementPage() {
  const app = useApp()
  const managed = useManagedMenu(app.selectedMonth.jy, app.selectedMonth.jm)
  const [tab, setTab] = useState<'daily' | 'import' | 'guests' | 'staff'>('daily')
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{app.monthTitle}</p>
          <p className="text-xs text-muted">ویرایش منو، سفارش‌های قبلی را خودبه‌خود عوض نمی‌کند.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <DeadlineFields meal="lunch" />
          <DeadlineFields meal="dinner" />
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {([['daily', 'منوی روزانه'], ['import', 'ورود از اکسل'], ['guests', 'سفارش مهمان'], ['staff', 'سفارش کارکنان']] as const).map(([id, label]) => (
          <button key={id} className={`min-h-11 rounded-md px-3 text-sm ${tab === id ? 'bg-primary text-onprimary' : 'border border-line bg-surface'}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'daily' && <DailyMenu managed={managed} />}
      {tab === 'import' && <ImportPanel managed={managed} />}
      {tab === 'guests' && <Guests />}
      {tab === 'staff' && <StaffOrders />}
    </div>
  )
}

function DeadlineFields({ meal }: { meal: MealKind }) {
  const app = useApp()
  const deadline = app.deadlines[meal]
  const time = `${String(deadline.hour).padStart(2, '0')}:${String(deadline.minute).padStart(2, '0')}`
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={meal === 'lunch' ? 'مهلت ناهار' : 'مهلت شام'}>
        <select className={controlClass} value={deadline.relation} onChange={(event) => app.setMealDeadline(meal, { relation: event.target.value as DeadlineRelation })}>
          <option value="same_day">همان روز</option>
          <option value="previous_day">روز قبل</option>
        </select>
      </Field>
      <Field label="ساعت">
        <input
          className={controlClass}
          type="time"
          aria-label={meal === 'lunch' ? 'ساعت مهلت ناهار' : 'ساعت مهلت شام'}
          value={time}
          onChange={(event) => {
            const [hour, minute] = event.target.value.split(':').map(Number)
            if (Number.isNaN(hour) || Number.isNaN(minute)) return
            app.setMealDeadline(meal, { hour, minute })
          }}
        />
      </Field>
      <p className="pb-2 text-xs text-muted">{formatDeadline(deadline)}</p>
    </div>
  )
}

function DailyMenu({ managed }: { managed: ReturnType<typeof useManagedMenu> }) {
  const app = useApp()
  if (managed.status === 'loading') {
    return <Empty title="در حال آماده‌سازی پیش‌نویس" body="منوی این ماه از سامانه خوانده می‌شود. در صورت نبود منو، پیش‌نویس خالی ساخته می‌شود." />
  }
  if (managed.status === 'unavailable') {
    return (
      <div className="space-y-2">
        <Empty title="سامانه در دسترس نیست" body={managed.message || 'ارتباط برقرار نشد. منوی نمایشی جایگزین نمی‌شود.'} />
        <Button variant="secondary" onClick={managed.retry}>تلاش دوباره</Button>
      </div>
    )
  }
  if (managed.status === 'forbidden') {
    return <Empty title="دسترسی ندارید" body={managed.message} />
  }
  if (managed.status === 'error') {
    return (
      <div className="space-y-2">
        <Empty title="بارگذاری پیش‌نویس انجام نشد" body={managed.message} />
        <Button variant="secondary" onClick={managed.retry}>تلاش دوباره</Button>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface p-3">
        <p className="text-sm">
          پیش‌نویس نسخه {managed.draft ? fa(managed.draft.versionNumber) : '—'}
          {managed.menu?.publishedVersionId ? ' · نسخه منتشرشده فعلی حفظ می‌شود تا انتشار جدید' : ' · هنوز نسخه‌ای منتشر نشده'}
        </p>
        <Button disabled={managed.busy || !managed.draft} onClick={() => void managed.publish()}>انتشار پیش‌نویس</Button>
      </div>
      {managed.message && <p className="rounded-md bg-dangerbg px-3 py-2 text-sm text-danger" role="alert">{managed.message}</p>}
      {managed.issues.length > 0 && (
        <ul className="list-disc pe-5 text-sm text-danger">{managed.issues.map((item) => <li key={item}>{item}</li>)}</ul>
      )}
      {managed.days.map((day) => (
        <article key={day.jd} className="rounded-md border border-line bg-surface p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <strong>{fa(day.jd)} {JALALI_MONTHS[day.jm - 1]} · {day.weekday}</strong>
            {isPastDate(day, app.now) && <span className="text-xs text-muted">سفارش‌های ثبت‌شده با این ویرایش عوض نمی‌شوند</span>}
          </div>
          {!day.lunch && !day.dinner && <p className="mb-2 text-sm text-muted">برای این روز هنوز گزینه‌ای نیست. جمعه و تعطیل مانع تعریف منو نیست.</p>}
          <div className="grid gap-3 md:grid-cols-2">
            <OptionEditor meal="lunch" options={day.lunch ?? []} disabled={managed.busy} onSave={(next) => managed.saveMeal(day, 'lunch', next)} />
            <OptionEditor meal="dinner" options={day.dinner ?? []} disabled={managed.busy} onSave={(next) => managed.saveMeal(day, 'dinner', next)} />
          </div>
        </article>
      ))}
    </div>
  )
}

function OptionEditor({
  meal,
  options,
  disabled,
  onSave,
}: {
  meal: MealKind
  options: MenuOption[]
  disabled: boolean
  onSave: (options: MenuOption[]) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [removing, setRemoving] = useState<MenuOption | null>(null)
  const label = meal === 'lunch' ? 'ناهار' : 'شام'
  return (
    <div>
      <p className={`mb-1 text-xs ${meal === 'lunch' ? 'text-lunch' : 'text-dinner'}`}>{label}</p>
      {options.length === 0 && <p className="text-xs text-muted">گزینه‌ای ثبت نشده</p>}
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button key={option.id} className="min-h-11 rounded border border-line px-3 text-sm" disabled={disabled} onClick={() => setRemoving(option)}>
            {option.title} ×
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const name = value.trim()
          if (!name || disabled || options.some((item) => item.title === name) || options.length >= 3) return
          void onSave([...options, localOption(name, options.length + 1)]).then(() => setValue('')).catch(() => undefined)
        }}
      >
        <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="غذای جدید" aria-label={`غذای جدید ${label}`} disabled={disabled} className="h-11 min-w-0 flex-1 rounded-md border border-line bg-bg px-2 text-base" />
        <Button type="submit" variant="secondary" disabled={disabled}>افزودن</Button>
      </form>
      <Dialog open={Boolean(removing)} title={`حذف از ${label}`} onClose={() => setRemoving(null)}>
        <p className="text-sm">«{removing?.title}» از {label} این روز حذف شود؟ سفارش‌هایی که قبلاً این نام را ثبت کرده‌اند عوض نمی‌شوند.</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>انصراف</Button>
          <Button
            variant="danger"
            disabled={disabled}
            onClick={() => {
              if (!removing) return
              void onSave(options.filter((item) => item.id !== removing.id)).then(() => setRemoving(null)).catch(() => undefined)
            }}
          >
            حذف
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function ImportPanel({ managed }: { managed: ReturnType<typeof useManagedMenu> }) {
  const app = useApp()
  const [wizard, setWizard] = useState(false)
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const selection = useRef(0)
  const sameMonth = Boolean(preview && preview.jalaliYear === app.selectedMonth.jy && preview.jalaliMonth === app.selectedMonth.jm)
  const fileMonth = preview ? `${JALALI_MONTHS[preview.jalaliMonth - 1]} ${fa(preview.jalaliYear)}` : ''
  return (
    <div className="space-y-3">
      <label className="block rounded-md border border-dashed border-line bg-surface px-4 py-8 text-center text-sm">
        <span className="block">فایل اکسل منو را انتخاب کنید</span>
        <span className="mt-1 block text-xs text-muted">xlsx با شیت‌های ناهار و شام · اعتبارسنجی در سرور انجام می‌شود</span>
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="mt-3 max-w-full text-sm"
          onChange={(event) => {
            const request = ++selection.current
            const file = event.target.files?.[0]
            setWizard(false)
            setError('')
            setPreview(null)
            if (!file) {
              setFileMeta(null)
              setReading(false)
              return
            }
            setFileMeta({ name: file.name, size: file.size })
            setReading(true)
            if (!file.name.toLowerCase().endsWith('.xlsx')) {
              setError('فقط فایل xlsx پذیرفته می‌شود.')
              setReading(false)
              return
            }
            void menuApi.previewImport(file).then((result) => {
              if (request !== selection.current) return
              setPreview(result)
              if (!result.valid) {
                setError(result.errors.map((item) => item.message).filter(Boolean).join(' ') || 'فایل معتبر نیست.')
              }
            }).catch((failure: unknown) => {
              if (request !== selection.current) return
              setPreview(null)
              setError(failure instanceof AuthRequestError ? failure.message : 'ارسال فایل به سامانه ممکن نشد.')
            }).finally(() => {
              if (request === selection.current) setReading(false)
            })
          }}
        />
      </label>
      {reading && <p className="text-sm text-muted">در حال بررسی فایل در سامانه…</p>}
      {fileMeta && (
        <div className="rounded-md border border-line bg-surface p-3 text-sm">
          <p className="font-medium break-all">{fileMeta.name}</p>
          <p className="text-xs text-muted">{faBytes(fileMeta.size)}{preview ? ` · ${fileMonth} · ${fa(preview.dateCount)} روز · ${fa(preview.optionCount)} گزینه` : ''}</p>
          {preview?.warnings.length ? (
            <ul className="mt-2 list-disc pe-5 text-xs text-muted">
              {preview.warnings.map((item, index) => <li key={`${item.message}-${index}`}>{item.message}</li>)}
            </ul>
          ) : null}
          {error && <p className="mt-3 rounded-md bg-dangerbg px-3 py-2 text-sm text-danger" role="alert">{error} منو و سفارش‌های موجود تغییر نکرده‌اند.</p>}
          {preview?.valid && preview.importId && (
            <>
              <p className="mt-3 text-xs text-muted">
                سفارش فعال در معرض تغییر: {fa(preview.impact?.atRiskOrderCount ?? 0)} از {fa(preview.impact?.activeOrderCount ?? 0)}
              </p>
              {sameMonth ? (
                <Button className="mt-3" onClick={() => setWizard(true)}>بررسی جایگزینی منو</Button>
              ) : (
                <p className="mt-3 text-sm text-danger">این فایل برای {fileMonth} است و ماه انتخاب‌شده {app.monthTitle} است. تا یکی شدن ماه، چیزی اعمال نمی‌شود.</p>
              )}
            </>
          )}
        </div>
      )}
      {wizard && sameMonth && preview?.importId && (
        <ReplaceWizard
          preview={preview}
          onClose={() => setWizard(false)}
          onConfirmed={async () => {
            await managed.reload()
          }}
        />
      )}
    </div>
  )
}

function ReplaceWizard({
  preview,
  onClose,
  onConfirmed,
}: {
  preview: ImportPreview
  onClose: () => void
  onConfirmed: () => Promise<void>
}) {
  const [policy, setPolicy] = useState<ReplacePolicy | null>(null)
  const [step, setStep] = useState<'pick' | 'summary' | 'typed' | 'done'>('pick')
  const [phrase, setPhrase] = useState('')
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [applyError, setApplyError] = useState('')
  const atRisk = preview.impact?.atRiskOrderCount ?? 0
  const active = preview.impact?.activeOrderCount ?? 0

  function apply() {
    if (!policy || !preview.importId || busy) return
    setBusy(true)
    setApplyError('')
    void menuApi.confirmImport(preview.importId, policy)
      .then(async () => {
        await onConfirmed()
        setStep('done')
      })
      .catch((failure: unknown) => {
        if (failure instanceof AuthRequestError && (failure.status === 404 || failure.status === 422)) {
          setApplyError(`${failure.message} پیش‌نمایش منقضی یا کهنه است؛ فایل را دوباره بارگذاری و بررسی کنید.`)
          return
        }
        setApplyError(failure instanceof AuthRequestError ? failure.message : 'تأیید واردسازی انجام نشد.')
      })
      .finally(() => setBusy(false))
  }

  return (
    <Dialog open wide title="جایگزینی منوی موجود" onClose={onClose}>
      <p className="text-sm text-muted">تغییر منو سفارش‌های قبلی را خودکار عوض نمی‌کند. اثر کار را خودتان با یکی از سه سیاست انتخاب می‌کنید.</p>
      {step === 'pick' && (
        <div className="mt-3 space-y-2">
          {POLICIES.map((item) => (
            <button key={item.id} className={`block min-h-11 w-full rounded-md border px-3 py-2 text-start ${policy === item.id ? 'border-primary bg-surface2' : 'border-line'}`} onClick={() => setPolicy(item.id)}>
              <span className="block text-sm font-medium">{item.title}</span>
              <span className="block text-xs text-muted">{item.body}</span>
            </button>
          ))}
          <div className="flex justify-end"><Button disabled={!policy} onClick={() => setStep('summary')}>ادامه</Button></div>
        </div>
      )}
      {applyError && <p className="mt-3 rounded-md bg-dangerbg px-3 py-2 text-sm text-danger" role="alert">{applyError}</p>}
      {step === 'summary' && policy && (
        <div className="mt-3 space-y-3 text-sm">
          <p>سیاست: {POLICIES.find((item) => item.id === policy)?.title}</p>
          <p>سفارش فعال این ماه در سامانه: {fa(active)}</p>
          <p>سفارش در معرض ناسازگاری با منوی جدید: {fa(atRisk)}</p>
          <p>
            {policy === 'keep' && 'سفارش‌های قبلی حفظ می‌شوند، حتی اگر گزینه در منوی جدید نباشد.'}
            {policy === 'match' && 'فقط سفارش‌هایی که دقیقاً با گزینه جدید منطبق‌اند می‌مانند؛ بقیه طبق سیاست سرور خالی می‌شوند.'}
            {policy === 'reset' && 'با سیاست بازنشانی، سفارش‌های ناسازگار طبق قوانین سرور رد یا پاک می‌شوند.'}
          </p>
          {policy === 'match' && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} className="mt-1" />
              اثر این تطبیق را بر سفارش‌های ناسازگار دیدم.
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep('pick')} disabled={busy}>بازگشت</Button>
            {policy === 'reset' ? (
              <Button variant="danger" disabled={busy} onClick={() => setStep('typed')}>ادامه به تأیید نهایی</Button>
            ) : (
              <Button disabled={busy || (policy === 'match' && !ack)} onClick={apply}>اعمال منوی جدید</Button>
            )}
          </div>
        </div>
      )}
      {step === 'typed' && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="rounded-md bg-dangerbg px-3 py-2 text-danger">بازنشانی، انتخاب ناهار و شام این ماه را پاک می‌کند. برای ادامه، کلمه «بازنشانی» را بنویسید.</p>
          <input value={phrase} onChange={(event) => setPhrase(event.target.value)} className={controlClass} placeholder="بازنشانی" disabled={busy} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep('summary')} disabled={busy}>بازگشت</Button>
            <Button variant="danger" disabled={busy || phrase.trim() !== 'بازنشانی'} onClick={apply}>بازنشانی و اعمال</Button>
          </div>
        </div>
      )}
      {step === 'done' && (
        <div className="mt-3 space-y-3">
          <Badge tone="ok">منوی جدید در سامانه اعمال شد</Badge>
          <p className="text-sm">پیش‌نویس از سرور تازه‌سازی شد. سفارش‌ها فقط طبق سیاست انتخاب‌شده در بک‌اند تغییر کردند.</p>
          <div className="flex justify-end"><Button onClick={onClose}>بستن</Button></div>
        </div>
      )}
    </Dialog>
  )
}

function Guests() {
  const app = useApp()
  const [buildingId, setBuildingId] = useState(app.buildings[0]?.id ?? '')
  const [jd, setJd] = useState(23)
  const [meal, setMeal] = useState<MealKind>('lunch')
  const [count, setCount] = useState(1)
  const [note, setNote] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const [countError, setCountError] = useState('')
  const guests = app.guests.filter((guest) => guest.jy === app.selectedMonth.jy && guest.jm === app.selectedMonth.jm)
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="overflow-hidden rounded-md border border-line bg-surface">
        {guests.length === 0 ? <div className="p-4"><Empty title="سفارش مهمانی نیست" body="از فرم کنار صفحه یک مورد اضافه کنید." /></div> : (
          <>
          <div className="space-y-2 p-3 lg:hidden">
            {guests.map((guest) => (
              <article key={guest.id} className="rounded-md border border-line p-3 text-sm">
                <p className="font-medium">{fa(guest.jd)} {JALALI_MONTHS[guest.jm - 1]} · {guest.meal === 'lunch' ? 'ناهار' : 'شام'}</p>
                <p className="mt-1">{app.buildings.find((item) => item.id === guest.buildingId)?.name} · {fa(guest.count)} پرس</p>
                <p className="mt-1 text-muted">{guest.note || 'بدون توضیح'}</p>
                <Button variant="danger" className="mt-2" onClick={() => setRemoving(guest.id)}>حذف</Button>
              </article>
            ))}
          </div>
          <table className="hidden w-full text-sm lg:table">
            <thead className="bg-elevated text-xs text-muted">
              <tr>
                <th className="px-3 py-2 text-start font-medium">تاریخ</th>
                <th className="px-3 py-2 text-start font-medium">ساختمان</th>
                <th className="px-3 py-2 text-start font-medium">وعده</th>
                <th className="px-3 py-2 text-start font-medium">تعداد</th>
                <th className="px-3 py-2 text-start font-medium">توضیح</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {app.guests.filter((guest) => guest.jy === app.selectedMonth.jy && guest.jm === app.selectedMonth.jm).map((guest) => (
                <tr key={guest.id} className="border-t border-line">
                  <td className="px-3 py-2">{fa(guest.jd)} {JALALI_MONTHS[guest.jm - 1]}</td>
                  <td className="px-3 py-2">{app.buildings.find((item) => item.id === guest.buildingId)?.name}</td>
                  <td className="px-3 py-2">{guest.meal === 'lunch' ? 'ناهار' : 'شام'}</td>
                  <td className="px-3 py-2">{fa(guest.count)}</td>
                  <td className="px-3 py-2">{guest.note || '—'}</td>
                  <td className="px-3 py-2"><Button variant="danger" onClick={() => setRemoving(guest.id)}>حذف</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </div>
      <form
        className="space-y-3 rounded-md border border-line bg-surface p-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!buildingId) return
          if (!Number.isFinite(count) || count < 1) {
            setCountError('تعداد باید حداقل ۱ باشد.')
            return
          }
          setCountError('')
          app.addGuest({ buildingId, jd, meal, count, note: note.trim() })
          setNote('')
        }}
      >
        <Field label="ساختمان"><select className={controlClass} value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>{app.buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="روز"><select className={controlClass} value={jd} onChange={(event) => setJd(Number(event.target.value))}>{app.days.map((day) => <option key={day.jd} value={day.jd}>{fa(day.jd)} {day.weekday}</option>)}</select></Field>
        <Field label="وعده"><select className={controlClass} value={meal} onChange={(event) => setMeal(event.target.value as MealKind)}><option value="lunch">ناهار</option><option value="dinner">شام</option></select></Field>
        <Field label="تعداد"><input className={controlClass} type="number" min={1} value={count} onChange={(event) => { setCount(Number(event.target.value)); setCountError('') }} /></Field>
        {countError && <p className="text-sm text-danger">{countError}</p>}
        <Field label="توضیح"><input className={controlClass} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
        <Button type="submit" className="w-full">ثبت سفارش مهمان</Button>
      </form>
      <Dialog open={Boolean(removing)} title="حذف سفارش مهمان" onClose={() => setRemoving(null)}>
        <p className="text-sm">این مورد از فهرست مهمان‌ها حذف شود؟</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>انصراف</Button>
          <Button variant="danger" onClick={() => { if (removing) app.removeGuest(removing); setRemoving(null) }}>حذف</Button>
        </div>
      </Dialog>
    </div>
  )
}

function StaffOrders() {
  const app = useApp()
  const [employeeId, setEmployeeId] = useState(app.employees[0]?.id ?? '')
  const [target, setTarget] = useState<{ jd: number; meal: MealKind } | null>(null)
  const day = target ? app.days.find((item) => item.jd === target.jd) : undefined
  const options = day && target ? day[target.meal] : null
  const current = target ? findOrder(app.orders, employeeId, app.selectedMonth, target.jd, target.meal) : undefined
  return (
    <div className="space-y-3">
      <Field label="کارمند">
        <select className={controlClass} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
          {app.employees.map((employee) => <option key={employee.id} value={employee.id}>{fullName(employee)}</option>)}
        </select>
      </Field>
      <p className="text-xs text-muted">پشتیبان و ادمین می‌توانند سفارش را بعد از مهلت هم تغییر دهند. ناهار و شام جدا ذخیره می‌شوند.</p>
      <div className="space-y-2">
        {app.days.map((item) => (
          <div key={item.jd} className="grid gap-2 rounded-md border border-line bg-surface p-3 md:grid-cols-[7rem_1fr_1fr]">
            <p className="text-sm">{fa(item.jd)} {item.weekday}</p>
            <MealBlock kind="lunch" defined={Boolean(item.lunch)} locked={!isMealOpen(item, 'lunch', app.deadlines, app.now)} choice={findOrder(app.orders, employeeId, item, item.jd, 'lunch')?.choice ?? null} onSelect={item.lunch ? () => setTarget({ jd: item.jd, meal: 'lunch' }) : undefined} />
            <MealBlock kind="dinner" defined={Boolean(item.dinner)} locked={!isMealOpen(item, 'dinner', app.deadlines, app.now)} choice={findOrder(app.orders, employeeId, item, item.jd, 'dinner')?.choice ?? null} onSelect={item.dinner ? () => setTarget({ jd: item.jd, meal: 'dinner' }) : undefined} />
          </div>
        ))}
      </div>
      {target && day && options && (
        <SelectMealDialog
          key={`${employeeId}-${target.jd}-${target.meal}`}
          kind={target.meal}
          jd={target.jd}
          weekday={day.weekday}
          monthName={JALALI_MONTHS[day.jm - 1]}
          options={options}
          current={current?.choice ?? null}
          locked={!isMealOpen(day, target.meal, app.deadlines, app.now)}
          ops
          who={fullName(app.employees.find((employee) => employee.id === employeeId) ?? { firstName: 'کارمند', lastName: '' })}
          onClose={() => setTarget(null)}
          onSave={(choice) => app.selectMeal(employeeId, target.jd, target.meal, choice, 'ops')}
        />
      )}
    </div>
  )
}
