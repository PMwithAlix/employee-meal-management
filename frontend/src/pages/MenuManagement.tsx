import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { GuestsPanel } from '../features/guests/ui/GuestsPanel'
import { StaffOrdersPanel } from '../features/orders/ui/StaffOrdersPanel'
import { Badge, Button, Dialog, Empty, controlClass } from '../shared/ui/primitives'
import { AuthRequestError } from '../features/auth/lib/auth-errors'
import { menuApi } from '../features/menus/api/menus-api'
import { defaultMenuAnnouncementCopy } from '../features/menus/lib/menu-announcement'
import { localOption, patchOptions, toBackendMeal } from '../features/menus/lib/menu-mapper'
import type { ImportPreview, MenuOption } from '../features/menus/model/menu-types'
import { ImportPreviewBoard } from '../features/menus/ui/ImportPreviewBoard'
import { useManagedMenu } from '../features/menus/hooks/useManagedMenu'
import { useApp } from '../app/providers/app-store'
import { isPastDate, JALALI_MONTHS } from '../shared/lib/jalali'
import { fa, faBytes } from '../shared/lib/persian-text'
import type { MealKind, ReplacePolicy } from '../shared/types/domain'

const POLICIES: Array<{ id: ReplacePolicy; title: string; body: string }> = [
  { id: 'keep', title: 'حفظ سفارش‌های قبلی', body: 'غذای ثبت‌شده سر جایش می‌ماند، حتی اگر در منوی جدید نباشد.' },
  { id: 'match', title: 'تطبیق سفارش‌های قبلی با منوی جدید', body: 'اگر غذای ثبت‌شده در منوی جدید نباشد، همان سفارش خالی می‌شود.' },
  { id: 'reset', title: 'بازنشانی سفارش‌های قبلی', body: 'همه انتخاب‌های این ماه پاک می‌شوند. این کار پرریسک است.' },
]

export function MenuManagementPage() {
  const app = useApp()
  const managed = useManagedMenu(app.selectedMonth.jy, app.selectedMonth.jm)
  const [tab, setTab] = useState<'daily' | 'guests' | 'staff'>('daily')
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{app.monthTitle}</p>
          <p className="text-xs text-muted">ویرایش منو، سفارش‌های قبلی را خودبه‌خود عوض نمی‌کند.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {([['daily', 'منوی روزانه'], ['guests', 'سفارش مهمان'], ['staff', 'سفارش کارکنان']] as const).map(([id, label]) => (
          <button key={id} className={`min-h-11 rounded-md px-3 text-sm ${tab === id ? 'bg-primary text-onprimary' : 'border border-line bg-surface'}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'daily' && <DailyMenu managed={managed} />}
      {/* ورود از اکسل برای نسخه‌های بعدی از تب‌ها برداشته شده است. */}
      {false && <ImportPanel managed={managed} />}
      {tab === 'guests' && <GuestsPanel />}
      {tab === 'staff' && <StaffOrdersPanel />}
    </div>
  )
}

function DailyMenu({ managed }: { managed: ReturnType<typeof useManagedMenu> }) {
  const app = useApp()
  const [announceOpen, setAnnounceOpen] = useState(false)
  const [announceTitle, setAnnounceTitle] = useState('')
  const [announceBody, setAnnounceBody] = useState('')
  const [announceNotice, setAnnounceNotice] = useState('')
  const copy = defaultMenuAnnouncementCopy(app.selectedMonth.jm)

  useEffect(() => {
    setAnnounceOpen(false)
    setAnnounceNotice('')
  }, [app.selectedMonth.jy, app.selectedMonth.jm])

  if (managed.status === 'loading') {
    return <Empty title="در حال آماده‌سازی منو" body="منوی این ماه از سامانه خوانده می‌شود. در صورت نبود منو، منوی خالی ساخته می‌شود." />
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
        <Empty title="بارگذاری منو انجام نشد" body={managed.message} />
        <Button variant="secondary" onClick={managed.retry}>تلاش دوباره</Button>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface p-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm">تغییرات منو به‌صورت خودکار ذخیره می‌شوند و بلافاصله برای کاربران قابل مشاهده‌اند.</p>
          <p className="text-xs text-muted" aria-live="polite">
            {managed.saveStatus === 'saving' && 'در حال ذخیره‌سازی'}
            {managed.saveStatus === 'saved' && 'ذخیره شد'}
            {managed.saveStatus === 'idle' && 'اعلام منو به کاربران جدا از ذخیره است و فقط با تأیید شما ارسال می‌شود.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {managed.saveStatus === 'error' && (
            <Button variant="secondary" onClick={() => void managed.retrySave()}>تلاش دوباره ذخیره</Button>
          )}
          <Button
            disabled={managed.announceBusy || !managed.menu}
            onClick={() => {
              setAnnounceTitle(copy.title)
              setAnnounceBody(copy.body)
              setAnnounceNotice('')
              setAnnounceOpen(true)
            }}
          >
            اعلام منو به کاربران
          </Button>
        </div>
      </div>
      {managed.saveStatus === 'error' && (
        <p className="rounded-md bg-dangerbg px-3 py-2 text-sm text-danger" role="alert">
          {managed.saveMessage || 'ذخیره وعده انجام نشد.'}
        </p>
      )}
      {managed.message && <p className="rounded-md bg-dangerbg px-3 py-2 text-sm text-danger" role="alert">{managed.message}</p>}
      {announceNotice && <p className="rounded-md bg-okbg px-3 py-2 text-sm text-ok" role="status">{announceNotice}</p>}
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
      <Dialog
        open={announceOpen}
        title={`اعلام منوی ${app.monthTitle}`}
        locked={managed.announceBusy}
        onClose={() => {
          if (!managed.announceBusy) setAnnounceOpen(false)
        }}
      >
        <p className="text-sm text-muted">متن پیش‌فرض را در صورت نیاز ویرایش کنید. ارسال فقط پس از تأیید انجام می‌شود.</p>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-muted">عنوان</span>
          <input
            value={announceTitle}
            maxLength={120}
            disabled={managed.announceBusy}
            onChange={(event) => setAnnounceTitle(event.target.value)}
            className="h-11 w-full rounded-md border border-line bg-bg px-3 text-base"
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-muted">متن پیام</span>
          <textarea
            value={announceBody}
            maxLength={280}
            rows={3}
            disabled={managed.announceBusy}
            onChange={(event) => setAnnounceBody(event.target.value)}
            className="w-full rounded-md border border-line bg-bg px-3 py-2 text-base"
          />
        </label>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={managed.announceBusy} onClick={() => setAnnounceOpen(false)}>انصراف</Button>
          <Button
            disabled={managed.announceBusy || !announceTitle.trim() || !announceBody.trim()}
            onClick={() => {
              void managed.announce({ title: announceTitle.trim(), body: announceBody.trim() }).then((result) => {
                if (!result) return
                setAnnounceOpen(false)
                setAnnounceNotice(`اعلام منو برای ${fa(result.recipientCount)} کاربر فعال ارسال شد.`)
              }).catch(() => undefined)
            }}
          >
            {managed.announceBusy ? 'در حال ارسال…' : 'تأیید و ارسال'}
          </Button>
        </div>
      </Dialog>
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
  const [items, setItems] = useState(options)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [removing, setRemoving] = useState<MenuOption | null>(null)
  const debounce = useRef<number | null>(null)
  const label = meal === 'lunch' ? 'ناهار' : 'شام'

  useEffect(() => {
    setItems(options)
  }, [options])

  useEffect(() => () => {
    if (debounce.current) window.clearTimeout(debounce.current)
  }, [])

  function persist(next: MenuOption[], delay = 0) {
    setItems(next)
    if (debounce.current) window.clearTimeout(debounce.current)
    const run = () => {
      void onSave(next.map((item, index) => ({ ...item, displayOrder: index + 1 }))).catch(() => setItems(options))
    }
    if (delay <= 0) {
      run()
      return
    }
    debounce.current = window.setTimeout(run, delay)
  }

  return (
    <div>
      <p className={`mb-1 text-xs ${meal === 'lunch' ? 'text-lunch' : 'text-dinner'}`}>{label}</p>
      {items.length === 0 && <p className="text-xs text-muted">گزینه‌ای ثبت نشده</p>}
      <div className="space-y-1">
        {items.map((option, index) => (
          <div key={option.id} className="flex min-h-11 items-center gap-1 rounded border border-line px-1">
            <div className="flex flex-col">
              <button
                type="button"
                className="grid h-5 w-7 place-items-center text-muted disabled:opacity-30"
                disabled={disabled || index === 0}
                aria-label={`بالا بردن ${option.title}`}
                onClick={() => {
                  const next = [...items]
                  const current = next[index]
                  const previous = next[index - 1]
                  if (!current || !previous) return
                  next[index - 1] = current
                  next[index] = previous
                  persist(next)
                }}
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                className="grid h-5 w-7 place-items-center text-muted disabled:opacity-30"
                disabled={disabled || index === items.length - 1}
                aria-label={`پایین آوردن ${option.title}`}
                onClick={() => {
                  const next = [...items]
                  const current = next[index]
                  const following = next[index + 1]
                  if (!current || !following) return
                  next[index + 1] = current
                  next[index] = following
                  persist(next)
                }}
              >
                <ChevronDown size={14} />
              </button>
            </div>
            {editingId === option.id ? (
              <input
                autoFocus
                value={option.title}
                disabled={disabled}
                aria-label={`ویرایش ${label}`}
                className="h-9 min-w-0 flex-1 rounded-md border border-line bg-bg px-2 text-sm"
                onChange={(event) => persist(items.map((item) => item.id === option.id ? { ...item, title: event.target.value } : item), 400)}
                onBlur={() => {
                  const title = option.title.trim()
                  if (!title) {
                    setItems(options)
                    setEditingId(null)
                    return
                  }
                  persist(items.map((item) => item.id === option.id ? { ...item, title } : item))
                  setEditingId(null)
                }}
              />
            ) : (
              <button type="button" className="min-w-0 flex-1 truncate px-2 text-start text-sm" disabled={disabled} onClick={() => setEditingId(option.id)}>
                {option.title}
              </button>
            )}
            <button type="button" className="grid h-9 w-9 place-items-center text-sm text-danger" disabled={disabled} aria-label={`حذف ${option.title}`} onClick={() => setRemoving(option)}>×</button>
          </div>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const name = value.trim()
          if (!name || disabled || items.some((item) => item.title === name) || items.length >= 3) return
          persist([...items, localOption(name, items.length + 1)])
          setValue('')
        }}
      >
        <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="غذای جدید" aria-label={`غذای جدید ${label}`} disabled={disabled} className="h-11 min-w-0 flex-1 rounded-md border border-line bg-bg px-2 text-base" />
        <Button type="submit" variant="secondary" disabled={disabled || items.length >= 3}>افزودن</Button>
      </form>
      <Dialog open={Boolean(removing)} title={`حذف از ${label}`} onClose={() => setRemoving(null)}>
        <p className="text-sm">«{removing?.title}» از {label} این روز حذف شود؟ اگر سفارش فعال روی این غذا باشد حذف انجام نمی‌شود. سفارش‌های لغوشده با نام ثبت‌شدهٔ قبلی می‌مانند.</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>انصراف</Button>
          <Button
            variant="danger"
            disabled={disabled}
            onClick={() => {
              if (!removing) return
              persist(items.filter((item) => item.id !== removing.id))
              setRemoving(null)
            }}
          >
            حذف
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

// ورود از اکسل در این نسخه از رابط کاربری پنهان است؛ کد برای نسخه‌های بعدی مانده است.
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
                <Button className="mt-3" onClick={() => setWizard(true)}>تأیید و اعمال پیش‌نمایش</Button>
              ) : (
                <p className="mt-3 text-sm text-danger">این فایل برای {fileMonth} است و ماه انتخاب‌شده {app.monthTitle} است. تا یکی شدن ماه، چیزی اعمال نمی‌شود.</p>
              )}
            </>
          )}
        </div>
      )}
      {preview?.valid && preview.importId && (
        <ImportPreviewBoard
          preview={preview}
          disabled={reading}
          onSaveMeal={async (mealDate, meal, options) => {
            setError('')
            setReading(true)
            try {
              const next = await menuApi.patchImportMeal(preview.importId!, {
                mealDate,
                mealType: toBackendMeal(meal),
                options: patchOptions(options),
              })
              setPreview(next)
            } catch (failure: unknown) {
              setError(failure instanceof AuthRequestError ? failure.message : 'ذخیره ویرایش پیش‌نمایش انجام نشد.')
              throw failure
            } finally {
              setReading(false)
            }
          }}
        />
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
