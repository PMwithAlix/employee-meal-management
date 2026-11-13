import type { ReactNode } from 'react'
import { CalendarClock, Moon, Sun, Utensils } from 'lucide-react'
import { useApp } from '../store'
import { deadlineLabel, findOrder, isMealOpen } from '../lib/orders'
import { JALALI_MONTHS } from '../lib/jalali'
import { fa, cn } from '../lib/text'
import type { MealFilter, StatusFilter } from '../types'

function Stats({ items }: { items: Array<{ label: string; value: string; hint: string; icon: typeof Sun }> }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div key={item.label} className="bg-surface p-4">
            <div className="flex items-center justify-between gap-2 text-muted">
              <p className="text-xs">{item.label}</p>
              <Icon size={15} aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-semibold leading-none">{item.value}</p>
            <p className="mt-2 text-xs text-muted">{item.hint}</p>
          </div>
        )
      })}
    </div>
  )
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function OverviewPage() {
  const app = useApp()
  if (app.role === 'admin') return <AdminOverview />
  if (app.role === 'support') return <SupportOverview />
  if (app.role === 'hr') return <HrOverview />
  if (app.role === 'management') return <ManagementOverview />
  return <EmployeeOverview />
}

function EmployeeOverview() {
  const app = useApp()
  const id = app.personaId
  if (!id) return null
  const mine = app.orders.filter((order) => order.employeeId === id && order.jy === app.selectedMonth.jy && order.jm === app.selectedMonth.jm)
  const lunchCount = mine.filter((order) => order.meal === 'lunch' && order.choice).length
  const dinnerCount = mine.filter((order) => order.meal === 'dinner' && order.choice).length
  const openDays = app.days.filter((day) => (day.lunch && isMealOpen(day, 'lunch', app.deadlines, app.now)) || (day.dinner && isMealOpen(day, 'dinner', app.deadlines, app.now)))
  const upcoming = openDays
  const selectedDays = app.days.filter((day) => mine.some((order) => order.jd === day.jd && order.choice))
  const incomplete = app.days.filter((day) => {
    const lunchOpen = Boolean(day.lunch) && isMealOpen(day, 'lunch', app.deadlines, app.now)
    const dinnerOpen = Boolean(day.dinner) && isMealOpen(day, 'dinner', app.deadlines, app.now)
    if (!lunchOpen && !dinnerOpen) return false
    const lunch = findOrder(app.orders, id, day, day.jd, 'lunch')
    const dinner = findOrder(app.orders, id, day, day.jd, 'dinner')
    return (lunchOpen && !lunch?.choice) || (dinnerOpen && !dinner?.choice)
  })
  const passed = app.days.filter((day) => {
    const defined = (['lunch', 'dinner'] as const).filter((meal) => day[meal])
    return defined.length > 0 && defined.every((meal) => !isMealOpen(day, meal, app.deadlines, app.now))
  })
  const deadlines = openDays
    .flatMap((day) =>
      (['lunch', 'dinner'] as const)
        .filter((meal) => day[meal] && isMealOpen(day, meal, app.deadlines, app.now))
        .map((meal) => ({ jd: day.jd, jm: day.jm, meal, text: deadlineLabel(day, meal, app.deadlines) })),
    )
    .slice(0, 4)

  function jump(status: StatusFilter, meal: MealFilter = 'all') {
    app.setMenuQuery({ status, meal, q: '' })
    app.setMenuView('list')
    app.setPage('menu')
  }

  return (
    <div className="space-y-4">
      <Stats
        items={[
          { label: 'سفارش‌های این ماه', value: fa(lunchCount + dinnerCount), hint: 'مجموع ناهار و شام ثبت‌شده', icon: Utensils },
          { label: 'روزهای باز برای انتخاب', value: fa(openDays.length), hint: `از امروز تا پایان ${JALALI_MONTHS[app.selectedMonth.jm - 1]}`, icon: CalendarClock },
          { label: 'ناهارهای ثبت‌شده', value: fa(lunchCount), hint: 'مستقل از شام', icon: Sun },
          { label: 'شام‌های ثبت‌شده', value: fa(dinnerCount), hint: 'مستقل از ناهار', icon: Moon },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="وضعیت سفارش‌ها" action={<button className="min-h-11 px-2 text-xs text-link" onClick={() => jump('all')}>رفتن به منو</button>}>
          <div className="space-y-3">
            <Bucket title="روزهای پیش رو" count={upcoming.length} sample={upcoming.slice(0, 3).map((day) => fa(day.jd))} onClick={() => jump('open')} />
            <Bucket title="روزهای دارای انتخاب" count={selectedDays.length} sample={selectedDays.slice(-3).map((day) => fa(day.jd))} onClick={() => jump('selected')} />
            <Bucket title="انتخاب ناقص" count={incomplete.length} sample={incomplete.slice(0, 3).map((day) => fa(day.jd))} onClick={() => jump('unselected')} />
            <Bucket title="مهلت گذشته" count={passed.length} sample={passed.slice(-3).map((day) => fa(day.jd))} />
          </div>
        </Panel>
        <Panel title="نزدیک‌ترین مهلت‌ها">
          <ul className="divide-y divide-line">
            {deadlines.map((item) => (
              <li key={`${item.jd}-${item.meal}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className={cn('ms-2 text-xs', item.meal === 'lunch' ? 'text-lunch' : 'text-dinner')}>{item.meal === 'lunch' ? 'ناهار' : 'شام'}</span>
                  {fa(item.jd)} {JALALI_MONTHS[item.jm - 1]}
                </span>
                <span className="text-muted">{item.text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel title="سفارش‌های اخیر">
        <ul className="divide-y divide-line">
          {app.feed.filter((item) => item.employeeId === id).slice(0, 5).map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <span>{item.text}</span>
              <span className="shrink-0 text-xs text-muted">{item.at}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

function Bucket({ title, count, sample, onClick }: { title: string; count: number; sample: string[]; onClick?: () => void }) {
  const body = (
    <>
      <span>
        <span className="block text-sm">{title}</span>
        <span className="text-xs text-muted">{sample.length ? sample.join('، ') : 'موردی نیست'}</span>
      </span>
      <span className="text-lg font-semibold">{fa(count)}</span>
    </>
  )
  if (!onClick) return <div className="flex min-h-11 items-center justify-between gap-3">{body}</div>
  return <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md text-start hover:bg-surface2" onClick={onClick}>{body}</button>
}

function SupportOverview() {
  const app = useApp()
  const inMonth = (order: { jy: number; jm: number }) => order.jy === app.selectedMonth.jy && order.jm === app.selectedMonth.jm
  const lunch = app.orders.filter((order) => inMonth(order) && order.meal === 'lunch' && order.choice).length
  const dinner = app.orders.filter((order) => inMonth(order) && order.meal === 'dinner' && order.choice).length
  const openDays = app.days.filter((day) => (day.lunch && isMealOpen(day, 'lunch', app.deadlines, app.now)) || (day.dinner && isMealOpen(day, 'dinner', app.deadlines, app.now)))
  return (
    <div className="space-y-4">
      <Stats
        items={[
          { label: 'ناهارهای ثبت‌شده', value: fa(lunch), hint: 'همه ساختمان‌ها', icon: Sun },
          { label: 'شام‌های ثبت‌شده', value: fa(dinner), hint: 'جدا از ناهار', icon: Moon },
          { label: 'روزهای باز', value: fa(openDays.length), hint: 'هنوز مهلت دارند', icon: CalendarClock },
          { label: 'سفارش مهمان', value: fa(app.guests.filter((guest) => guest.jy === app.selectedMonth.jy && guest.jm === app.selectedMonth.jm).length), hint: 'مورد فعال', icon: Utensils },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="مهلت‌های پیش رو" action={<button className="min-h-11 px-2 text-xs text-link" onClick={() => app.setPage('menuMgmt')}>مدیریت منو</button>}>
          <ul className="space-y-2 text-sm">
            {openDays.slice(0, 4).map((day) => (
              <li key={day.jd} className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
                <span className="min-w-0">{fa(day.jd)} {JALALI_MONTHS[day.jm - 1]}، {day.weekday}</span>
                <span className="break-words text-muted">{day.lunch ? `ناهار ${deadlineLabel(day, 'lunch', app.deadlines)}` : ''}{day.lunch && day.dinner ? ' · ' : ''}{day.dinner ? `شام ${deadlineLabel(day, 'dinner', app.deadlines)}` : ''}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="فعالیت عملیاتی اخیر" action={<button className="min-h-11 px-2 text-xs text-link" onClick={() => app.setPage('activity')}>تاریخچه</button>}>
          <ActivityList />
        </Panel>
      </div>
    </div>
  )
}

function HrOverview() {
  const app = useApp()
  const active = app.employees.filter((employee) => employee.active).length
  return (
    <div className="space-y-4">
      <Stats
        items={[
          { label: 'کارکنان فعال', value: fa(active), hint: `${fa(app.employees.length - active)} حساب غیرفعال`, icon: Utensils },
          { label: 'ساختمان‌های فعال', value: fa(app.buildings.length), hint: 'هر کارمند یک ساختمان', icon: CalendarClock },
          { label: 'گروه‌ها', value: fa(app.groups.length), hint: 'عضویت چندگانه مجاز است', icon: Sun },
          { label: 'حساب جدید این ماه', value: fa(1), hint: 'پارسا کیانی، ۱ آبان', icon: Moon },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="توزیع کارکنان بر اساس ساختمان">
          <ul className="space-y-3">
            {app.buildings.map((building) => {
              const count = app.employees.filter((employee) => employee.active && employee.buildingId === building.id).length
              const max = Math.max(...app.buildings.map((item) => app.employees.filter((employee) => employee.active && employee.buildingId === item.id).length), 1)
              return (
                <li key={building.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{building.name}</span>
                    <span className="text-muted">{fa(count)} نفر</span>
                  </div>
                  <div className="h-1.5 rounded bg-surface2">
                    <div className="h-1.5 rounded bg-primary" style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>
        <Panel title="میانبرها">
          <div className="grid gap-2">
            <button className="min-h-11 rounded-md border border-line px-3 py-2 text-start text-sm hover:bg-surface2" onClick={() => app.setPage('employees')}>مدیریت کارکنان</button>
            <button className="min-h-11 rounded-md border border-line px-3 py-2 text-start text-sm hover:bg-surface2" onClick={() => app.setPage('buildings')}>مدیریت ساختمان‌ها</button>
            <button className="min-h-11 rounded-md border border-line px-3 py-2 text-start text-sm hover:bg-surface2" onClick={() => app.setPage('groups')}>گروه‌های کارکنان</button>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function ManagementOverview() {
  const app = useApp()
  const inMonth = (order: { jy: number; jm: number }) => order.jy === app.selectedMonth.jy && order.jm === app.selectedMonth.jm
  const lunch = app.orders.filter((order) => inMonth(order) && order.meal === 'lunch' && order.choice).length
  const dinner = app.orders.filter((order) => inMonth(order) && order.meal === 'dinner' && order.choice).length
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-muted">دسترسی مدیریت فقط مشاهده است. ایجاد، ویرایش و حذف در این نقش وجود ندارد.</p>
      <Stats
        items={[
          { label: 'ناهارهای ثبت‌شده', value: fa(lunch), hint: app.monthTitle, icon: Sun },
          { label: 'شام‌های ثبت‌شده', value: fa(dinner), hint: 'جدا از ناهار', icon: Moon },
          { label: 'ساختمان‌ها', value: fa(app.buildings.length), hint: 'خلاصه عملیاتی', icon: CalendarClock },
          { label: 'رویدادهای اخیر', value: fa(Math.min(app.activity.length, 6)), hint: 'در تاریخچه', icon: Utensils },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="خلاصه ساختمان‌ها" action={<button className="min-h-11 px-2 text-xs text-link" onClick={() => app.setPage('reports')}>گزارش‌ها</button>}>
          <ul className="divide-y divide-line text-sm">
            {app.buildings.map((building) => {
              const people = app.employees.filter((employee) => employee.buildingId === building.id)
              const lunchCount = app.orders.filter((order) => inMonth(order) && order.meal === 'lunch' && order.choice && people.some((employee) => employee.id === order.employeeId)).length
              return (
                <li key={building.id} className="flex items-center justify-between py-2">
                  <span>{building.name}</span>
                  <span className="text-muted">{fa(people.filter((employee) => employee.active).length)} کارمند · {fa(lunchCount)} ناهار</span>
                </li>
              )
            })}
          </ul>
        </Panel>
        <Panel title="فعالیت اخیر" action={<button className="min-h-11 px-2 text-xs text-link" onClick={() => app.setPage('activity')}>تاریخچه کامل</button>}>
          <ActivityList />
        </Panel>
      </div>
    </div>
  )
}

function AdminOverview() {
  const app = useApp()
  const links: Array<{ label: string; page: 'menuMgmt' | 'employees' | 'buildings' | 'groups' | 'reports' | 'activity' }> = [
    { label: 'مدیریت منو', page: 'menuMgmt' },
    { label: 'مدیریت کارکنان', page: 'employees' },
    { label: 'ساختمان‌ها', page: 'buildings' },
    { label: 'گروه‌ها', page: 'groups' },
    { label: 'گزارش‌ها', page: 'reports' },
    { label: 'تاریخچه فعالیت‌ها', page: 'activity' },
  ]
  return (
    <div className="space-y-4">
      <Stats
        items={[
          { label: 'کارکنان', value: fa(app.employees.length), hint: `${fa(app.employees.filter((employee) => employee.active).length)} فعال`, icon: Utensils },
          { label: 'ساختمان‌ها', value: fa(app.buildings.length), hint: 'بدون ویژگی اضافه', icon: CalendarClock },
          { label: 'سفارش ثبت‌شده', value: fa(app.orders.filter((order) => order.choice && order.jy === app.selectedMonth.jy && order.jm === app.selectedMonth.jm).length), hint: app.monthTitle, icon: Sun },
          { label: 'گروه‌ها', value: fa(app.groups.length), hint: 'عضویت آزاد', icon: Moon },
        ]}
      />
      <Panel title="بخش‌های سامانه">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <button key={link.page} className="min-h-11 rounded-md border border-line px-3 py-3 text-start text-sm hover:bg-surface2" onClick={() => app.setPage(link.page)}>
              {link.label}
            </button>
          ))}
        </div>
      </Panel>
    </div>
  )
}

function ActivityList() {
  const app = useApp()
  return (
    <ul className="divide-y divide-line text-sm">
      {app.activity.slice(0, 5).map((item) => (
        <li key={item.id} className="py-2">
          <p>{item.actor} · {item.action}</p>
          <p className="text-xs text-muted">{item.target} · {item.at}</p>
        </li>
      ))}
    </ul>
  )
}
