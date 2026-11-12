import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { MealBlock } from '../components/MealBlock'
import { SelectMealDialog } from '../components/SelectMealDialog'
import { Button, Empty, MonthBar, Segmented } from '../components/ui'
import { WEEKDAYS } from '../data'
import { useApp } from '../store'
import { isSameDate, JALALI_MONTHS } from '../lib/jalali'
import { findOrder, isMealOpen, rowMatches } from '../lib/orders'
import { formatDeadline } from '../lib/deadlines'
import { can } from '../permissions'
import { cn, fa } from '../lib/text'
import type { DayMenu, MealKind } from '../types'

export function MonthlyMenuPage() {
  const app = useApp()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const id = app.personaId

  if (!id) {
    return (
      <div className="space-y-3">
        <Empty
          title="سفارش شخصی برای ادمین تعریف نشده"
          body="ادمین به ساختمانی وصل نیست. سفارش کارکنان، منو و مهلت‌ها از مدیریت منو انجام می‌شود."
        />
        <Button onClick={() => app.setPage('menuMgmt')}>رفتن به مدیریت منو</Button>
      </div>
    )
  }

  const visible = app.days.filter((day) => rowMatches(day, app.orders, id, app.menuQuery, app.deadlines, app.now))
  const active = app.menuQuery.meal !== 'all' || app.menuQuery.status !== 'all' || app.menuQuery.q.trim()

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <MonthBar />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">ناهار و شام جدا انتخاب می‌شوند. ناهار: {formatDeadline(app.deadlines.lunch)}. شام: {formatDeadline(app.deadlines.dinner)}.</p>
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

      {visible.length === 0 ? (
        <Empty title="روزی با این فیلتر پیدا نشد" body="فیلترها را پاک کنید یا ترکیب دیگری انتخاب کنید." />
      ) : app.menuView === 'list' ? (
        <DayList days={visible} />
      ) : (
        <Calendar days={app.days} visible={new Set(visible.map((item) => item.jd))} />
      )}
    </div>
  )
}

function DayList({ days }: { days: DayMenu[] }) {
  const app = useApp()
  const id = app.personaId!
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
              const lunch = findOrder(app.orders, id, day, day.jd, 'lunch')
              const dinner = findOrder(app.orders, id, day, day.jd, 'dinner')
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
          const lunch = findOrder(app.orders, id, day, day.jd, 'lunch')
          const dinner = findOrder(app.orders, id, day, day.jd, 'dinner')
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

function Calendar({ days, visible }: { days: DayMenu[]; visible: Set<number> }) {
  const app = useApp()
  const id = app.personaId!
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
                <Cell day={day} meal="lunch" choice={findOrder(app.orders, id, day, day.jd, 'lunch')?.choice ?? null} dense />
                <Cell day={day} meal="dinner" choice={findOrder(app.orders, id, day, day.jd, 'dinner')?.choice ?? null} dense />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2 lg:hidden">
        {days.filter((day) => visible.has(day.jd)).map((day) => (
          <article key={day.jd} className="rounded-md border border-line bg-surface p-3">
            <p className="mb-2 text-sm font-medium">{fa(day.jd)} {JALALI_MONTHS[day.jm - 1]} · {day.weekday}</p>
            <div className="space-y-2">
              <Cell day={day} meal="lunch" choice={findOrder(app.orders, id, day, day.jd, 'lunch')?.choice ?? null} />
              <Cell day={day} meal="dinner" choice={findOrder(app.orders, id, day, day.jd, 'dinner')?.choice ?? null} />
            </div>
          </article>
        ))}
      </div>
    </>
  )
}

function Cell({ day, meal, choice, dense }: { day: DayMenu; meal: MealKind; choice: string | null; dense?: boolean }) {
  const app = useApp()
  const id = app.personaId
  const options = day[meal]
  const [open, setOpen] = useState(false)
  const orphan = Boolean(choice && options && !options.includes(choice))
  const orderingOpen = isMealOpen(day, meal, app.deadlines, app.now)
  const canEdit = Boolean(id && options) && (orderingOpen ? can(app.role, 'order.self') : can(app.role, 'order.ops'))
  return (
    <>
      <MealBlock
        kind={meal}
        choice={choice}
        locked={!orderingOpen}
        defined={Boolean(options)}
        orphan={orphan}
        dense={dense}
        onSelect={canEdit ? () => setOpen(true) : undefined}
      />
      {open && canEdit && options && id && (
        <SelectMealDialog
          kind={meal}
          jd={day.jd}
          weekday={day.weekday}
          monthName={JALALI_MONTHS[day.jm - 1]}
          options={options}
          current={choice}
          locked={!orderingOpen}
          ops={can(app.role, 'order.ops')}
          onClose={() => setOpen(false)}
          onSave={(next) => app.selectMeal(id, day.jd, meal, next, 'self')}
        />
      )}
    </>
  )
}

function summary(day: DayMenu, lunch: string | null, dinner: string | null, app: ReturnType<typeof useApp>) {
  if (!day.lunch && !day.dinner) return 'منو تعریف نشده'
  const parts: string[] = []
  if (day.lunch) parts.push(`ناهار ${lunch ? 'انتخاب شده' : 'انتخاب نشده'}، ${isMealOpen(day, 'lunch', app.deadlines, app.now) ? 'باز' : 'مهلت تمام'}`)
  if (day.dinner) parts.push(`شام ${dinner ? 'انتخاب شده' : 'انتخاب نشده'}، ${isMealOpen(day, 'dinner', app.deadlines, app.now) ? 'باز' : 'مهلت تمام'}`)
  return parts.join(' · ')
}
