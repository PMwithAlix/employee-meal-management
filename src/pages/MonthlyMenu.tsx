import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, X } from 'lucide-react'
import { MealBlock } from '../components/MealBlock'
import { Button, Empty, Segmented } from '../components/ui'
import { WEEKDAYS } from '../data'
import { useApp } from '../store'
import { findOrder, isLocked, rowMatches } from '../lib/orders'
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

  const visible = app.days.filter((day) => rowMatches(day, app.orders, id, app.menuQuery, app.today))
  const active = app.menuQuery.meal !== 'all' || app.menuQuery.status !== 'all' || app.menuQuery.q.trim()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{app.monthTitle}</p>
          <p className="text-xs text-muted">ناهار و شام جدا انتخاب می‌شوند. مهلت هر وعده: ساعت {fa(app.deadlineHour)} همان روز.</p>
        </div>
        <Segmented
          label="نمای منو"
          value={app.menuView}
          onChange={app.setMenuView}
          options={[{ id: 'list', label: 'فهرست' }, { id: 'calendar', label: 'تقویم' }]}
        />
      </div>

      <div className="rounded-md border border-line bg-surface p-3">
        <div className="mb-2 flex items-center justify-between md:hidden">
          <button className="text-sm" onClick={() => setFiltersOpen((value) => !value)}>{filtersOpen ? 'بستن فیلترها' : 'فیلترها'}</button>
          <span className="text-xs text-muted">{fa(visible.length)} روز</span>
        </div>
        <div className={cn('gap-3', filtersOpen ? 'grid' : 'hidden md:grid')}>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="وعده"
              value={app.menuQuery.meal}
              onChange={(meal) => app.setMenuQuery({ meal })}
              options={[{ id: 'all', label: 'همه' }, { id: 'lunch', label: 'ناهار' }, { id: 'dinner', label: 'شام' }]}
            />
            <Segmented
              label="وضعیت انتخاب"
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
                className="h-9 w-full rounded-md border border-line bg-bg pe-9 ps-3 text-sm"
              />
            </label>
            {active && <Button variant="ghost" onClick={app.clearMenuQuery}><X size={14} /> پاک کردن فیلتر</Button>}
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
          <thead className="bg-surface2 text-xs text-muted">
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
              const lunch = findOrder(app.orders, id, day.jd, 'lunch')
              const dinner = findOrder(app.orders, id, day.jd, 'dinner')
              return (
                <tr key={day.jd} className={cn('border-t border-line align-top', day.jd === app.today && 'bg-infobg/40')}>
                  <td className="px-3 py-3 font-medium">{fa(day.jd)} آبان</td>
                  <td className="px-3 py-3 text-muted">{day.weekday}</td>
                  <td className="px-3 py-3"><Cell day={day} meal="lunch" choice={lunch?.choice ?? null} /></td>
                  <td className="px-3 py-3"><Cell day={day} meal="dinner" choice={dinner?.choice ?? null} /></td>
                  <td className="px-3 py-3 text-xs leading-5 text-muted">{summary(day, lunch?.choice ?? null, dinner?.choice ?? null, app.today)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 md:hidden">
        {days.map((day) => {
          const lunch = findOrder(app.orders, id, day.jd, 'lunch')
          const dinner = findOrder(app.orders, id, day.jd, 'dinner')
          return (
            <article key={day.jd} className="rounded-md border border-line bg-surface p-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <strong>{fa(day.jd)} آبان</strong>
                <span className="text-muted">{day.weekday}</span>
              </div>
              <div className="space-y-2">
                <Cell day={day} meal="lunch" choice={lunch?.choice ?? null} />
                <Cell day={day} meal="dinner" choice={dinner?.choice ?? null} />
              </div>
              <p className="mt-2 text-xs text-muted">{summary(day, lunch?.choice ?? null, dinner?.choice ?? null, app.today)}</p>
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
            <div key={day.jd} className={cn('min-h-[148px] border-t border-line bg-surface p-1.5', day.jd === app.today && 'ring-1 ring-inset ring-primary', !visible.has(day.jd) && 'opacity-35')}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">{fa(day.jd)}</span>
                {!visible.has(day.jd) && <span className="text-[10px] text-muted">خارج از فیلتر</span>}
              </div>
              <div className="space-y-1">
                <Cell day={day} meal="lunch" choice={findOrder(app.orders, id, day.jd, 'lunch')?.choice ?? null} dense />
                <Cell day={day} meal="dinner" choice={findOrder(app.orders, id, day.jd, 'dinner')?.choice ?? null} dense />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2 lg:hidden">
        {days.filter((day) => visible.has(day.jd)).map((day) => (
          <article key={day.jd} className="rounded-md border border-line bg-surface p-3">
            <p className="mb-2 text-sm font-medium">{fa(day.jd)} آبان · {day.weekday}</p>
            <div className="space-y-2">
              <Cell day={day} meal="lunch" choice={findOrder(app.orders, id, day.jd, 'lunch')?.choice ?? null} />
              <Cell day={day} meal="dinner" choice={findOrder(app.orders, id, day.jd, 'dinner')?.choice ?? null} />
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
  const anchor = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const orphan = Boolean(choice && options && !options.includes(choice))
  const can = Boolean(id && options) && (day.jd < app.today ? app.role === 'support' : true)
  return (
    <div ref={anchor} className="relative">
      <MealBlock
        kind={meal}
        choice={choice}
        locked={isLocked(day.jd, app.today)}
        defined={Boolean(options)}
        orphan={orphan}
        dense={dense}
        onSelect={can ? () => setOpen((value) => !value) : undefined}
      />
      {can && <ChevronDown size={14} className="pointer-events-none absolute bottom-2 end-2 text-muted" aria-hidden />}
      {open && options && anchor.current && id && (
        <OptionMenu
          anchor={anchor.current}
          options={options}
          current={choice}
          onClose={() => setOpen(false)}
          onPick={(next) => {
            app.selectMeal(id, day.jd, meal, next, 'self')
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

function OptionMenu({
  anchor,
  options,
  current,
  onPick,
  onClose,
}: {
  anchor: HTMLElement
  options: string[]
  current: string | null
  onPick: (choice: string | null) => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 220 })

  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect()
    const width = Math.max(rect.width, 220)
    let left = rect.left
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8
    if (left < 8) left = 8
    const height = (options.length + (current ? 1 : 0)) * 40 + 8
    let top = rect.bottom + 4
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 4)
    setStyle({ top, left, width })
  }, [anchor, options.length, current])

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      const node = event.target as Node
      if (anchor.contains(node) || menuRef.current?.contains(node)) return
      onClose()
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={menuRef}
      role="listbox"
      style={{ position: 'fixed', top: style.top, left: style.left, width: style.width, zIndex: 70 }}
      className="rounded-md border border-line bg-surface p-1 shadow-card"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="option"
          aria-selected={option === current}
          className={cn('block w-full rounded px-2.5 py-2 text-start text-sm hover:bg-surface2', option === current && 'font-medium')}
          onClick={() => onPick(option)}
        >
          {option}
        </button>
      ))}
      {current && (
        <button type="button" className="block w-full rounded px-2.5 py-2 text-start text-sm text-muted hover:bg-surface2" onClick={() => onPick(null)}>
          حذف انتخاب
        </button>
      )}
    </div>,
    document.body,
  )
}

function summary(day: DayMenu, lunch: string | null, dinner: string | null, today: number) {
  if (!day.lunch && !day.dinner) return 'منو تعریف نشده'
  const parts: string[] = []
  if (day.lunch) parts.push(lunch ? 'ناهار انتخاب شده' : 'ناهار انتخاب نشده')
  if (day.dinner) parts.push(dinner ? 'شام انتخاب شده' : 'شام انتخاب نشده')
  parts.push(day.jd < today ? 'مهلت به پایان رسیده' : 'باز برای انتخاب')
  return parts.join(' · ')
}
