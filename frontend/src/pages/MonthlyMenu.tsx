import { useEffect, useRef, useState } from 'react'
import { Check, Lock, Minus, Search, X } from 'lucide-react'
import { MealBlock } from '../shared/ui/MealBlock'
import { MealPicker } from '../shared/ui/MealPicker'
import { AppNavLink } from '../layouts/AppNavLink'
import { Button, Empty, MonthBar, Segmented } from '../shared/ui/primitives'
import { WEEKDAYS } from '../shared/fixtures/seed-data'
import { formatGregorianDate } from '../features/menus/lib/menu-mapper'
import { usePublishedMenu } from '../features/menus/hooks/usePublishedMenu'
import { useApp } from '../app/providers/app-store'
import { addDays, isSameDate, JALALI_MONTHS } from '../shared/lib/jalali'
import { findOrder, isMealOpen, mealChoices, rowMatches } from '../shared/lib/order-rules'
import { can } from '../shared/config/permissions'
import { cn, fa } from '../shared/lib/persian-text'
import type { DayMenu, MealKind } from '../shared/types/domain'

export function MonthlyMenuPage() {
  const app = useApp()
  const published = usePublishedMenu(app.selectedMonth.jy, app.selectedMonth.jm)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const id = app.role === 'admin' ? null : app.selfId

  if (!id) {
    return (
      <div className="space-y-3">
        <Empty
          title="سفارش شخصی برای ادمین تعریف نشده"
          body="ادمین به ساختمانی وصل نیست. سفارش کارکنان، منو و مهلت‌ها از مدیریت منو انجام می‌شود."
        />
        <AppNavLink page="menuMgmt" className="inline-flex h-11 min-h-11 items-center justify-center rounded-md bg-primary px-3 text-sm text-onprimary">رفتن به مدیریت منو</AppNavLink>
      </div>
    )
  }

  const days = published.pickerDays
  const mealDates = (meal: MealKind) => days.filter((day) => day[meal]).map((day) => day.gregorianDate ?? formatGregorianDate(day.jy, day.jm, day.jd))
  const visible = days.filter((day) => rowMatches(day, app.myOrders, id, app.menuQuery, app.deadlines, app.now, app.mealDeadlineAt))
  const active = app.menuQuery.meal !== 'all' || app.menuQuery.status !== 'all' || app.menuQuery.q.trim()

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <MonthBar icons />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">ناهار و شام جدا انتخاب می‌شوند. ناهار: {app.mealDeadlineSummary('lunch', mealDates('lunch'))}. شام: {app.mealDeadlineSummary('dinner', mealDates('dinner'))}.</p>
          <Segmented
            label="نمای منو"
            size="touch"
            value={app.menuView}
            onChange={app.setMenuView}
            options={[{ id: 'list', label: 'فهرست' }, { id: 'calendar', label: 'تقویم' }]}
          />
        </div>
      </div>

      <div className="rounded-md border border-line bg-surface p-3">
        <div className="mb-2 flex items-center justify-between gap-2 md:hidden">
          <button type="button" className="min-h-11 rounded-md border border-line px-3 text-sm" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}>{filtersOpen ? 'بستن فیلترها' : 'فیلترها'}</button>
          <span className="text-xs text-muted">{fa(visible.length)} روز</span>
        </div>
        <div className={cn('gap-3', filtersOpen ? 'grid' : 'hidden md:grid')}>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="وعده"
              size="touch"
              value={app.menuQuery.meal}
              onChange={(meal) => app.setMenuQuery({ meal })}
              options={[{ id: 'all', label: 'همه' }, { id: 'lunch', label: 'ناهار' }, { id: 'dinner', label: 'شام' }]}
            />
            <Segmented
              label="وضعیت انتخاب"
              size="touch"
              value={app.menuQuery.status}
              onChange={(status) => app.setMenuQuery({ status })}
              options={[
                { id: 'all', label: 'همه' },
                { id: 'selected', label: 'انتخاب شده' },
                { id: 'unselected', label: 'انتخاب نشده' },
                { id: 'open', label: 'باز برای انتخاب' },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[12rem] flex-1">
              <Search size={14} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={app.menuQuery.q}
                onChange={(event) => app.setMenuQuery({ q: event.target.value })}
                placeholder="جستجوی غذا یا تاریخ"
                aria-label="جستجوی غذا یا تاریخ"
                className="h-11 w-full rounded-md border border-line bg-bg pe-9 ps-3 text-base"
              />
            </label>
            {active && <Button variant="ghost" className="h-11 min-h-11" onClick={app.clearMenuQuery}><X size={14} /> پاک کردن فیلتر</Button>}
            <span className="hidden text-xs text-muted md:inline">{fa(visible.length)} روز</span>
          </div>
        </div>
        {active && (
          <div className="mt-2 flex flex-wrap gap-1 text-xs">
            {app.menuQuery.meal !== 'all' && <span className="rounded bg-surface2 px-2 py-1">{app.menuQuery.meal === 'lunch' ? 'ناهار' : 'شام'}</span>}
            {app.menuQuery.status !== 'all' && <span className="rounded bg-surface2 px-2 py-1">{app.menuQuery.status === 'selected' ? 'انتخاب شده' : app.menuQuery.status === 'unselected' ? 'انتخاب نشده' : 'باز برای انتخاب'}</span>}
            {app.menuQuery.q.trim() && <span className="rounded bg-surface2 px-2 py-1">جستجو: {app.menuQuery.q}</span>}
          </div>
        )}
      </div>

      {app.myOrdersStatus === 'unavailable' && (
        <Empty title="سفارش‌ها از سامانه خوانده نشد" body={app.myOrdersMessage || 'این به‌معنای حذف سفارش نیست. دوباره تلاش کنید.'} />
      )}
      {app.deadlineStatus === 'unavailable' && (
        <Empty title="مهلت سفارش از سامانه خوانده نشد" body={app.deadlineMessage || 'تا خواندن مهلت، سفارش عادی باز نیست. دوباره تلاش کنید.'} />
      )}
      {app.deadlineStatus === 'error' && (
        <Empty title="بارگذاری مهلت سفارش انجام نشد" body={app.deadlineMessage || 'تا خواندن مهلت، سفارش عادی باز نیست.'} />
      )}
      {published.status === 'loading' ? (
        <Empty title="در حال بارگذاری منو" body="منوی منتشرشده این ماه از سامانه خوانده می‌شود." />
      ) : published.status === 'unavailable' ? (
        <Empty title="سامانه در دسترس نیست" body={published.message || 'ارتباط با سرور برقرار نشد. منوی نمایشی جایگزین نمی‌شود.'} />
      ) : published.status === 'forbidden' ? (
        <Empty title="دسترسی ندارید" body={published.message} />
      ) : published.status === 'error' ? (
        <Empty title="بارگذاری منو انجام نشد" body={published.message} />
      ) : published.status === 'empty' ? (
        <Empty title="منوی منتشرشده‌ای برای این ماه نیست" body="تا وقتی نسخه‌ای منتشر نشود، گزینه‌ای نمایش داده نمی‌شود." />
      ) : visible.length === 0 ? (
        <Empty title="روزی با این فیلتر پیدا نشد" body="فیلترها را پاک کنید یا ترکیب دیگری انتخاب کنید." />
      ) : app.menuView === 'list' ? (
        <DayList days={visible} employeeId={id} />
      ) : (
        <Calendar days={days} visible={new Set(visible.map((item) => item.jd))} employeeId={id} />
      )}
      {(published.status === 'unavailable' || published.status === 'error' || published.status === 'forbidden') && (
        <Button variant="secondary" onClick={published.retry}>تلاش دوباره</Button>
      )}
      {(app.myOrdersStatus === 'unavailable' || app.myOrdersStatus === 'error' || app.deadlineStatus === 'unavailable' || app.deadlineStatus === 'error') && (
        <Button variant="secondary" onClick={app.retryMyOrders}>تلاش دوباره</Button>
      )}
    </div>
  )
}

function DayList({ days, employeeId: id }: { days: DayMenu[]; employeeId: string }) {
  const app = useApp()
  return (
    <>
      <div className="hidden overflow-hidden rounded-md border border-line md:block">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-elevated text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-start font-medium">تاریخ</th>
              <th className="px-3 py-2 text-start font-medium">روز هفته</th>
              <th className="px-3 py-2 text-start font-medium">ناهار</th>
              <th className="px-3 py-2 text-start font-medium">شام</th>
              <th className="px-3 py-2 text-start font-medium">وضعیت سفارش</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const lunch = findOrder(app.myOrders, id, day, day.jd, 'lunch')
              const dinner = findOrder(app.myOrders, id, day, day.jd, 'dinner')
              return (
                <tr key={day.jd} className={cn('border-t border-divider align-top', isSameDate(day, app.now) && 'bg-brandsubtle')}>
                  <td className="px-3 py-3 font-medium">{fa(day.jd)} {JALALI_MONTHS[day.jm - 1]}</td>
                  <td className="px-3 py-3 text-muted">{day.weekday}</td>
                  <td className="px-3 py-3"><Cell day={day} meal="lunch" choice={lunch?.choice ?? null} /></td>
                  <td className="px-3 py-3"><Cell day={day} meal="dinner" choice={dinner?.choice ?? null} /></td>
                  <td className="px-3 py-3 text-xs leading-5 text-muted">{summary(day, lunch?.choice ?? null, dinner?.choice ?? null, app)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 md:hidden">
        {days.map((day) => {
          const lunch = findOrder(app.myOrders, id, day, day.jd, 'lunch')
          const dinner = findOrder(app.myOrders, id, day, day.jd, 'dinner')
          return (
            <article key={day.jd} className={cn('rounded-md border border-line bg-surface p-3', isSameDate(day, app.now) && 'border-primary')}>
              <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                <strong>{fa(day.jd)} {JALALI_MONTHS[day.jm - 1]}</strong>
                <span className="text-muted">{day.weekday}{isSameDate(day, app.now) ? ' · امروز' : ''}</span>
              </div>
              <div className="space-y-2">
                <Cell day={day} meal="lunch" choice={lunch?.choice ?? null} />
                <Cell day={day} meal="dinner" choice={dinner?.choice ?? null} />
              </div>
              <p className="mt-2 text-xs text-muted">{summary(day, lunch?.choice ?? null, dinner?.choice ?? null, app)}</p>
            </article>
          )
        })}
      </div>
    </>
  )
}

function Calendar({ days, visible, employeeId: id }: { days: DayMenu[]; visible: Set<number>; employeeId: string }) {
  const app = useApp()
  const lead = WEEKDAYS.indexOf(days[0]?.weekday as (typeof WEEKDAYS)[number])
  return (
    <>
      <div className="hidden overflow-hidden rounded-md border border-line lg:block">
        <div className="grid grid-cols-7 bg-surface2 text-center text-xs text-muted">
          {WEEKDAYS.map((name) => <div key={name} className="px-1 py-2">{name}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: lead }, (_, index) => <div key={`b-${index}`} className="min-h-[148px] border-t border-line bg-bg" />)}
          {days.map((day) => (
            <div key={day.jd} className={cn('min-h-[148px] border-t border-line bg-surface p-1.5', isSameDate(day, app.now) && 'ring-1 ring-inset ring-primary', !visible.has(day.jd) && 'opacity-35')}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">{fa(day.jd)}</span>
                {!visible.has(day.jd) && <span className="text-[10px] text-muted">خارج از فیلتر</span>}
              </div>
              <div className="space-y-1">
                <Cell day={day} meal="lunch" choice={findOrder(app.myOrders, id, day, day.jd, 'lunch')?.choice ?? null} dense />
                <Cell day={day} meal="dinner" choice={findOrder(app.myOrders, id, day, day.jd, 'dinner')?.choice ?? null} dense />
              </div>
            </div>
          ))}
        </div>
      </div>
      <MobileCalendar days={days} visible={visible} employeeId={id} />
    </>
  )
}

function pickCalendarDay(days: DayMenu[], now: { jy: number; jm: number; jd: number }, visible: Set<number>) {
  const today = days.find((day) => isSameDate(day, now))
  if (today) return today.jd
  const firstVisible = days.find((day) => visible.has(day.jd))
  return firstVisible?.jd ?? days[0]?.jd ?? 1
}

function mealMark(day: DayMenu, meal: MealKind, choice: string | null, open: boolean) {
  if (!day[meal]) return { defined: false, selected: false, closed: false }
  return { defined: true, selected: Boolean(choice), closed: !open }
}

function MealMark({ kind, defined, selected, closed }: { kind: MealKind; defined: boolean; selected: boolean; closed: boolean }) {
  const lunch = kind === 'lunch'
  const label = lunch ? 'ناهار' : 'شام'
  const state = !defined ? 'تعریف نشده' : selected ? (closed ? 'انتخاب شده، مهلت تمام' : 'انتخاب شده') : closed ? 'مهلت تمام' : 'باز'
  const Icon = !defined ? Minus : closed && !selected ? Lock : selected ? Check : null
  return (
    <span
      className={cn(
        'grid h-4 w-4 place-items-center',
        lunch ? 'rounded-[3px]' : 'rounded-full',
        !defined && 'border border-dashed border-faint text-faint',
        defined && selected && lunch && 'bg-lunch text-onprimary',
        defined && selected && !lunch && 'bg-dinner text-onprimary',
        defined && !selected && lunch && 'border border-lunch text-lunch',
        defined && !selected && !lunch && 'border border-dinner text-dinner',
        defined && closed && selected && 'opacity-80',
      )}
      title={`${label}: ${state}`}
    >
      {Icon ? <Icon size={9} strokeWidth={2.4} aria-hidden /> : null}
      <span className="sr-only">{label} {state}</span>
    </span>
  )
}

function MobileCalendar({ days, visible, employeeId: id }: { days: DayMenu[]; visible: Set<number>; employeeId: string }) {
  const app = useApp()
  const lead = Math.max(0, WEEKDAYS.indexOf(days[0]?.weekday as (typeof WEEKDAYS)[number]))
  const trail = (7 - ((lead + days.length) % 7)) % 7
  const leading = days[0] ? Array.from({ length: lead }, (_, index) => addDays(days[0], index - lead)) : []
  const trailing = days.length ? Array.from({ length: trail }, (_, index) => addDays(days[days.length - 1], index + 1)) : []
  const monthStamp = days[0] ? `${days[0].jy}-${days[0].jm}` : ''
  const [selectedJd, setSelectedJd] = useState(() => pickCalendarDay(days, app.now, visible))

  useEffect(() => {
    setSelectedJd(pickCalendarDay(days, app.now, visible))
  }, [monthStamp])

  const selected = days.find((day) => day.jd === selectedJd) ?? days[0]
  const lunch = selected ? findOrder(app.myOrders, id, selected, selected.jd, 'lunch') : undefined
  const dinner = selected ? findOrder(app.myOrders, id, selected, selected.jd, 'dinner') : undefined

  return (
    <div className="lg:hidden">
      <div className="overflow-hidden rounded-md border border-line bg-surface">
        <div className="flex items-center justify-between gap-2 border-b border-divider px-3 py-2">
          <p className="text-sm font-medium">{days[0] ? `${JALALI_MONTHS[days[0].jm - 1]} ${fa(days[0].jy)}` : app.monthTitle}</p>
          <p className="text-[11px] text-muted">
            <span className="ms-2 inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-[2px] bg-lunch" aria-hidden /> ناهار</span>
            <span className="ms-2 inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-dinner" aria-hidden /> شام</span>
          </p>
        </div>
        <div className="grid grid-cols-7 bg-surface2 text-center text-[11px] text-muted">
          {WEEKDAYS.map((name) => (
            <div key={name} className="px-0.5 py-1.5" title={name}>{name.slice(0, 1)}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {leading.map((date) => (
            <div key={`l-${date.jy}-${date.jm}-${date.jd}`} className="flex min-h-12 min-w-0 flex-col items-center justify-between gap-0.5 border-t border-line px-0.5 py-1 text-faint" aria-hidden>
              <span className="grid h-6 w-6 place-items-center text-xs leading-none">{fa(date.jd)}</span>
              <span className="h-4" />
            </div>
          ))}
          {days.map((day) => {
            const today = isSameDate(day, app.now)
            const active = day.jd === selectedJd
            const lunchChoice = findOrder(app.myOrders, id, day, day.jd, 'lunch')?.choice ?? null
            const dinnerChoice = findOrder(app.myOrders, id, day, day.jd, 'dinner')?.choice ?? null
            const lunchOpen = isMealOpen(day, 'lunch', app.deadlines, app.now, app.mealDeadlineAt(day, 'lunch'))
            const dinnerOpen = isMealOpen(day, 'dinner', app.deadlines, app.now, app.mealDeadlineAt(day, 'dinner'))
            return (
              <button
                key={day.jd}
                type="button"
                onClick={() => setSelectedJd(day.jd)}
                aria-pressed={active}
                aria-current={today ? 'date' : undefined}
                aria-label={`${day.weekday} ${fa(day.jd)} ${JALALI_MONTHS[day.jm - 1]}`}
                className={cn(
                  'flex min-h-12 min-w-0 flex-col items-center justify-between gap-0.5 border-t border-line px-0.5 py-1',
                  active && 'bg-brandsubtle ring-1 ring-inset ring-primary',
                  !visible.has(day.jd) && 'opacity-40',
                )}
              >
                <span className={cn(
                  'grid h-6 w-6 place-items-center rounded-full text-xs leading-none',
                  today && 'bg-primary font-medium text-onprimary',
                  active && !today && 'font-medium text-primary',
                )}>
                  {fa(day.jd)}
                </span>
                <span className="flex h-4 items-center gap-0.5">
                  <MealMark kind="lunch" {...mealMark(day, 'lunch', lunchChoice, lunchOpen)} />
                  <MealMark kind="dinner" {...mealMark(day, 'dinner', dinnerChoice, dinnerOpen)} />
                </span>
              </button>
            )
          })}
          {trailing.map((date) => (
            <div key={`t-${date.jy}-${date.jm}-${date.jd}`} className="flex min-h-12 min-w-0 flex-col items-center justify-between gap-0.5 border-t border-line px-0.5 py-1 text-faint" aria-hidden>
              <span className="grid h-6 w-6 place-items-center text-xs leading-none">{fa(date.jd)}</span>
              <span className="h-4" />
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <section className="mt-2 overflow-hidden rounded-md border border-line" aria-live="polite">
          <div className="flex items-center justify-between gap-2 bg-elevated px-3 py-2">
            <p className="text-sm font-medium">{fa(selected.jd)} {JALALI_MONTHS[selected.jm - 1]} · {selected.weekday}{isSameDate(selected, app.now) ? ' · امروز' : ''}</p>
            {!visible.has(selected.jd) && <span className="text-[11px] text-muted">خارج از فیلتر</span>}
          </div>
          <div className="space-y-2 bg-surface p-3">
            <Cell key={`${selected.jd}-lunch`} day={selected} meal="lunch" choice={lunch?.choice ?? null} />
            <Cell key={`${selected.jd}-dinner`} day={selected} meal="dinner" choice={dinner?.choice ?? null} />
          </div>
        </section>
      )}
    </div>
  )
}

function Cell({ day, meal, choice, dense }: { day: DayMenu; meal: MealKind; choice: string | null; dense?: boolean }) {
  const app = useApp()
  const id = app.role === 'admin' ? null : app.selfId
  const options = mealChoices(day, meal)
  const titles = day[meal]
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const current = id ? findOrder(app.myOrders, id, day, day.jd, meal) : undefined
  const orphan = Boolean(choice && titles && !titles.includes(choice))
  const orderingOpen = isMealOpen(day, meal, app.deadlines, app.now, app.mealDeadlineAt(day, meal))
  const canEdit = Boolean(id && options?.length) && (orderingOpen ? can(app.role, 'order.self') : can(app.role, 'order.ops'))
  const busy = Boolean(app.orderingKey)
  return (
    <div ref={triggerRef}>
      <MealBlock
        kind={meal}
        choice={choice}
        locked={!orderingOpen}
        defined={Boolean(titles)}
        orphan={orphan}
        dense={dense}
        expanded={open}
        onSelect={canEdit && !busy ? () => setOpen((value) => !value) : undefined}
      />
      {canEdit && options && id && (
        <MealPicker
          open={open}
          trigger={triggerRef.current}
          kind={meal}
          options={options}
          currentId={current?.menuItemId ?? null}
          locked={!orderingOpen}
          ops={can(app.role, 'order.ops')}
          onClose={() => setOpen(false)}
          onSave={(next) => app.selectMeal(id, day.jd, meal, null, 'self', next)}
        />
      )}
    </div>
  )
}

function summary(day: DayMenu, lunch: string | null, dinner: string | null, app: ReturnType<typeof useApp>) {
  if (!day.lunch && !day.dinner) return 'منو تعریف نشده'
  const parts: string[] = []
  if (day.lunch) parts.push(`ناهار ${lunch ? 'انتخاب شده' : 'انتخاب نشده'}، ${isMealOpen(day, 'lunch', app.deadlines, app.now, app.mealDeadlineAt(day, 'lunch')) ? 'باز' : 'مهلت تمام'}`)
  if (day.dinner) parts.push(`شام ${dinner ? 'انتخاب شده' : 'انتخاب نشده'}، ${isMealOpen(day, 'dinner', app.deadlines, app.now, app.mealDeadlineAt(day, 'dinner')) ? 'باز' : 'مهلت تمام'}`)
  return parts.join(' · ')
}
