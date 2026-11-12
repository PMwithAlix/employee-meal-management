import { useState } from 'react'
import { MealBlock } from '../components/MealBlock'
import { SelectMealDialog } from '../components/SelectMealDialog'
import { Badge, Button, Dialog, Empty, Field, controlClass } from '../components/ui'
import { PREVIEW_MENU, fullName } from '../data'
import { useApp } from '../store'
import { findOrder, isLocked } from '../lib/orders'
import { fa, faBytes } from '../lib/text'
import type { MealKind, ReplacePolicy } from '../types'

const POLICIES: Array<{ id: ReplacePolicy; title: string; body: string }> = [
  { id: 'keep', title: 'حفظ سفارش‌های قبلی', body: 'غذای ثبت‌شده سر جایش می‌ماند، حتی اگر در منوی جدید نباشد.' },
  { id: 'match', title: 'تطبیق سفارش‌های قبلی با منوی جدید', body: 'اگر غذای ثبت‌شده در منوی جدید نباشد، همان سفارش خالی می‌شود.' },
  { id: 'reset', title: 'بازنشانی سفارش‌های قبلی', body: 'همه انتخاب‌های این ماه پاک می‌شوند. این کار پرریسک است.' },
]

export function MenuManagementPage() {
  const app = useApp()
  const [tab, setTab] = useState<'daily' | 'import' | 'guests' | 'staff'>('daily')
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{app.monthTitle}</p>
          <p className="text-xs text-muted">ویرایش منو، سفارش‌های قبلی را خودبه‌خود عوض نمی‌کند.</p>
        </div>
        <Field label="مهلت ثبت هر وعده">
          <select className={controlClass} value={app.deadlineHour} onChange={(event) => app.setDeadlineHour(Number(event.target.value))}>
            {[8, 9, 10, 12].map((hour) => <option key={hour} value={hour}>ساعت {fa(hour)} همان روز</option>)}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-1">
        {([['daily', 'منوی روزانه'], ['import', 'ورود از اکسل'], ['guests', 'سفارش مهمان'], ['staff', 'سفارش کارکنان']] as const).map(([id, label]) => (
          <button key={id} className={`h-9 rounded-md px-3 text-sm ${tab === id ? 'bg-primary text-onprimary' : 'border border-line bg-surface'}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'daily' && <DailyMenu />}
      {tab === 'import' && <ImportPanel />}
      {tab === 'guests' && <Guests />}
      {tab === 'staff' && <StaffOrders />}
    </div>
  )
}

function DailyMenu() {
  const app = useApp()
  return (
    <div className="space-y-2">
      {app.days.map((day) => (
        <article key={day.jd} className="rounded-md border border-line bg-surface p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <strong>{fa(day.jd)} آبان · {day.weekday}</strong>
            {day.jd < app.today && <span className="text-xs text-muted">سفارش‌های ثبت‌شده با این ویرایش عوض نمی‌شوند</span>}
          </div>
          {!day.lunch && !day.dinner ? <p className="text-sm text-muted">منو تعریف نشده</p> : (
            <div className="grid gap-3 md:grid-cols-2">
              <OptionEditor jd={day.jd} meal="lunch" options={day.lunch ?? []} />
              <OptionEditor jd={day.jd} meal="dinner" options={day.dinner ?? []} />
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

function OptionEditor({ jd, meal, options }: { jd: number; meal: MealKind; options: string[] }) {
  const app = useApp()
  const [value, setValue] = useState('')
  return (
    <div>
      <p className={`mb-1 text-xs ${meal === 'lunch' ? 'text-lunch' : 'text-dinner'}`}>{meal === 'lunch' ? 'ناهار' : 'شام'}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button key={option} className="rounded border border-line px-2 py-1 text-xs" onClick={() => app.updateDayOptions(jd, meal, options.filter((item) => item !== option))}>
            {option} ×
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const name = value.trim()
          if (!name || options.includes(name)) return
          app.updateDayOptions(jd, meal, [...options, name])
          setValue('')
        }}
      >
        <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="غذای جدید" className="h-8 flex-1 rounded-md border border-line bg-bg px-2 text-sm" />
        <Button type="submit" variant="secondary">افزودن</Button>
      </form>
    </div>
  )
}

function ImportPanel() {
  const app = useApp()
  const [wizard, setWizard] = useState(false)
  return (
    <div className="space-y-3">
      <label className="block rounded-md border border-dashed border-line bg-surface px-4 py-8 text-center text-sm">
        <span className="block">فایل اکسل منو را انتخاب کنید</span>
        <span className="mt-1 block text-xs text-muted">xlsx یا xls</span>
        <input
          type="file"
          accept=".xlsx,.xls"
          className="mt-3 text-xs"
          onChange={(event) => {
            const file = event.target.files?.[0]
            app.setImportedFile(file ? { name: file.name, size: file.size } : null)
          }}
        />
      </label>
      {app.importedFile && (
        <div className="rounded-md border border-line bg-surface p-3 text-sm">
          <p className="font-medium">{app.importedFile.name}</p>
          <p className="text-xs text-muted">{faBytes(app.importedFile.size)}</p>
          <p className="mt-3 text-xs text-muted">پیش‌نمایش نمونه برای بررسی جریان کار. محتوای واقعی فایل در این نمونه خوانده نمی‌شود.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Preview title="ناهار" items={PREVIEW_MENU.lunch} />
            <Preview title="شام" items={PREVIEW_MENU.dinner} />
          </div>
          <Button className="mt-3" onClick={() => setWizard(true)}>بررسی جایگزینی منو</Button>
        </div>
      )}
      {wizard && <ReplaceWizard onClose={() => setWizard(false)} />}
    </div>
  )
}

function Preview({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-line p-2">
      <p className="text-xs text-muted">{title}</p>
      <ul className="mt-1 text-sm">{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>
  )
}

function ReplaceWizard({ onClose }: { onClose: () => void }) {
  const app = useApp()
  const [policy, setPolicy] = useState<ReplacePolicy | null>(null)
  const [step, setStep] = useState<'pick' | 'summary' | 'typed' | 'done'>('pick')
  const [phrase, setPhrase] = useState('')
  const [ack, setAck] = useState(false)
  const impact = policy ? app.previewImpact(policy) : { affected: 0, keptOutside: 0 }
  const selectedOrders = app.orders.filter((order) => order.choice).length

  function apply() {
    if (!policy) return
    app.applyImport(policy)
    setStep('done')
  }

  return (
    <Dialog open wide title="جایگزینی منوی موجود" onClose={onClose}>
      <p className="text-sm text-muted">تغییر منو سفارش‌های قبلی را خودکار عوض نمی‌کند. اثر کار را خودتان با یکی از سه سیاست انتخاب می‌کنید.</p>
      {step === 'pick' && (
        <div className="mt-3 space-y-2">
          {POLICIES.map((item) => (
            <button key={item.id} className={`block w-full rounded-md border px-3 py-2 text-start ${policy === item.id ? 'border-primary bg-surface2' : 'border-line'}`} onClick={() => setPolicy(item.id)}>
              <span className="block text-sm font-medium">{item.title}</span>
              <span className="block text-xs text-muted">{item.body}</span>
            </button>
          ))}
          <div className="flex justify-end"><Button disabled={!policy} onClick={() => setStep('summary')}>ادامه</Button></div>
        </div>
      )}
      {step === 'summary' && policy && (
        <div className="mt-3 space-y-3 text-sm">
          <p>سیاست: {POLICIES.find((item) => item.id === policy)?.title}</p>
          <p>سفارش دارای انتخاب: {fa(selectedOrders)}</p>
          <p>{policy === 'keep' ? `${fa(impact.keptOutside)} سفارش به غذایی اشاره دارد که در منوی جدید نیست و عمداً حفظ می‌شود.` : `${fa(impact.affected)} سفارش تحت اثر این سیاست قرار می‌گیرد.`}</p>
          <p className="text-xs text-muted">جمعه‌ها منو ندارند و در این جایگزینی خالی می‌مانند.</p>
          {policy === 'match' && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} className="mt-1" />
              اثر این تطبیق را بر سفارش‌های ناسازگار دیدم.
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep('pick')}>بازگشت</Button>
            {policy === 'reset' ? (
              <Button variant="danger" onClick={() => setStep('typed')}>ادامه به تأیید نهایی</Button>
            ) : (
              <Button disabled={policy === 'match' && !ack} onClick={apply}>اعمال منوی جدید</Button>
            )}
          </div>
        </div>
      )}
      {step === 'typed' && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="rounded-md bg-dangerbg px-3 py-2 text-danger">بازنشانی، انتخاب ناهار و شام این ماه را پاک می‌کند. برای ادامه، کلمه «بازنشانی» را بنویسید.</p>
          <input value={phrase} onChange={(event) => setPhrase(event.target.value)} className={controlClass} placeholder="بازنشانی" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep('summary')}>بازگشت</Button>
            <Button variant="danger" disabled={phrase.trim() !== 'بازنشانی'} onClick={apply}>بازنشانی و اعمال</Button>
          </div>
        </div>
      )}
      {step === 'done' && (
        <div className="mt-3 space-y-3">
          <Badge tone="ok">منوی جدید اعمال شد</Badge>
          <p className="text-sm">وضعیت ذخیره: انجام شد. سفارش‌ها فقط طبق سیاست انتخاب‌شده تغییر کردند.</p>
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
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="overflow-hidden rounded-md border border-line bg-surface">
        {app.guests.length === 0 ? <div className="p-4"><Empty title="سفارش مهمانی نیست" body="از فرم کنار صفحه یک مورد اضافه کنید." /></div> : (
          <table className="w-full text-sm">
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
              {app.guests.map((guest) => (
                <tr key={guest.id} className="border-t border-line">
                  <td className="px-3 py-2">{fa(guest.jd)} آبان</td>
                  <td className="px-3 py-2">{app.buildings.find((item) => item.id === guest.buildingId)?.name}</td>
                  <td className="px-3 py-2">{guest.meal === 'lunch' ? 'ناهار' : 'شام'}</td>
                  <td className="px-3 py-2">{fa(guest.count)}</td>
                  <td className="px-3 py-2">{guest.note || '—'}</td>
                  <td className="px-3 py-2"><button className="text-xs text-danger" onClick={() => setRemoving(guest.id)}>حذف</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <form
        className="space-y-3 rounded-md border border-line bg-surface p-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!buildingId || count < 1) return
          app.addGuest({ buildingId, jd, meal, count, note: note.trim() })
          setNote('')
        }}
      >
        <Field label="ساختمان"><select className={controlClass} value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>{app.buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="روز"><select className={controlClass} value={jd} onChange={(event) => setJd(Number(event.target.value))}>{app.days.filter((day) => day.lunch || day.dinner).map((day) => <option key={day.jd} value={day.jd}>{fa(day.jd)} {day.weekday}</option>)}</select></Field>
        <Field label="وعده"><select className={controlClass} value={meal} onChange={(event) => setMeal(event.target.value as MealKind)}><option value="lunch">ناهار</option><option value="dinner">شام</option></select></Field>
        <Field label="تعداد"><input className={controlClass} type="number" min={1} value={count} onChange={(event) => setCount(Number(event.target.value))} /></Field>
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
  const current = target ? findOrder(app.orders, employeeId, target.jd, target.meal) : undefined
  return (
    <div className="space-y-3">
      <Field label="کارمند">
        <select className={controlClass} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
          {app.employees.map((employee) => <option key={employee.id} value={employee.id}>{fullName(employee)}</option>)}
        </select>
      </Field>
      <p className="text-xs text-muted">پشتیبان و ادمین می‌توانند سفارش را بعد از مهلت هم تغییر دهند. ناهار و شام جدا ذخیره می‌شوند.</p>
      <div className="space-y-2">
        {app.days.filter((item) => item.lunch || item.dinner).map((item) => (
          <div key={item.jd} className="grid gap-2 rounded-md border border-line bg-surface p-3 md:grid-cols-[7rem_1fr_1fr]">
            <p className="text-sm">{fa(item.jd)} {item.weekday}</p>
            <MealBlock kind="lunch" defined={Boolean(item.lunch)} locked={isLocked(item.jd, app.today)} choice={findOrder(app.orders, employeeId, item.jd, 'lunch')?.choice ?? null} onSelect={item.lunch ? () => setTarget({ jd: item.jd, meal: 'lunch' }) : undefined} />
            <MealBlock kind="dinner" defined={Boolean(item.dinner)} locked={isLocked(item.jd, app.today)} choice={findOrder(app.orders, employeeId, item.jd, 'dinner')?.choice ?? null} onSelect={item.dinner ? () => setTarget({ jd: item.jd, meal: 'dinner' }) : undefined} />
          </div>
        ))}
      </div>
      {target && day && options && (
        <SelectMealDialog
          key={`${employeeId}-${target.jd}-${target.meal}`}
          kind={target.meal}
          jd={target.jd}
          weekday={day.weekday}
          options={options}
          current={current?.choice ?? null}
          locked={isLocked(target.jd, app.today)}
          ops
          onClose={() => setTarget(null)}
          onSave={(choice) => {
            app.selectMeal(employeeId, target.jd, target.meal, choice, 'ops')
            setTarget(null)
          }}
        />
      )}
    </div>
  )
}
