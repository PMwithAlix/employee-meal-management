import type { ReactNode } from 'react'
import { CalendarClock, Moon, Sun, Utensils } from 'lucide-react'
import { useApp } from '../store'
import { Button } from '../components/ui'
import { formatDeadlineFromInstant } from '../lib/deadlines'
import { classifyEmployeeDeadline, findOrder, isElapsedDeadlineDay, isOpenDeadlineDay, upcomingChosenMeals } from '../lib/orders'
import { addDays, isSameDate, JALALI_MONTHS, weekdayName, type JalaliDate, type JalaliDateTime } from '../lib/jalali'
import { fa, cn } from '../lib/text'
import { useRecentAudit } from '../audit/useRecentAudit'
import { useGuestMonthCount } from '../guests/useGuestMonthCount'
import { usePublishedMenu } from '../menus/usePublishedMenu'
import { combinedActiveCount, managementOpenDaysMetric, metricValue, openDaysMetric } from '../overview/metrics'
import { useSupportOrderCounts } from '../orders/useSupportOrderCounts'
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

function dayHeading(date: JalaliDate, now: JalaliDateTime) {
  if (isSameDate(date, now)) return 'امروز'
  if (isSameDate(date, addDays(now, 1))) return 'فردا'
  return weekdayName(date)
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
  const id = app.role === 'admin' ? null : app.selfId
  if (!id) return null
  const mine = app.myOrders.filter((order) => order.employeeId === id && order.jy === app.selectedMonth.jy && order.jm === app.selectedMonth.jm)
  const lunchCount = mine.filter((order) => order.meal === 'lunch' && order.choice).length
  const dinnerCount = mine.filter((order) => order.meal === 'dinner' && order.choice).length
  const deadlineFor = app.mealDeadlineAt
  const openDays = app.days.filter((day) => isOpenDeadlineDay(day, deadlineFor))
  const upcoming = openDays
  const selectedDays = app.days.filter((day) => mine.some((order) => order.jd === day.jd && order.choice))
  const missingLunch = app.days.filter((day) => {
    if (!day.lunch || classifyEmployeeDeadline(deadlineFor(day, 'lunch')) !== 'open') return false
    return !findOrder(app.myOrders, id, day, day.jd, 'lunch')?.choice
  })
  const upcomingMeals = upcomingChosenMeals(app.myOrders, id, app.now, app.mealServings)
  const passed = app.days.filter((day) => isElapsedDeadlineDay(day, deadlineFor))
  const deadlines = openDays
    .flatMap((day) =>
      (['lunch', 'dinner'] as const)
        .filter((meal) => day[meal] && classifyEmployeeDeadline(deadlineFor(day, meal)) === 'open')
        .map((meal) => {
          const state = app.mealDeadlineAt(day, meal)
          const text = typeof state === 'object' ? formatDeadlineFromInstant(state.at, day.gregorianDate) ?? 'مهلت باز' : 'مهلت باز'
          return { jd: day.jd, jm: day.jm, meal, text }
        }),
    )
    .slice(0, 4)

  function jump(status: StatusFilter, meal: MealFilter = 'all') {
    app.setMenuQuery({ status, meal, q: '' })
    app.setMenuView('list')
    app.setPage('menu')
  }

  const stats = [
    { label: 'سفارش‌های این ماه', value: fa(lunchCount + dinnerCount), hint: 'مجموع ناهار و شام ثبت‌شده', icon: Utensils },
    { label: 'روزهای باز برای انتخاب', value: fa(openDays.length), hint: `از امروز تا پایان ${JALALI_MONTHS[app.selectedMonth.jm - 1]}`, icon: CalendarClock },
    { label: 'ناهارهای ثبت‌شده', value: fa(lunchCount), hint: 'مستقل از شام', icon: Sun },
    { label: 'شام‌های ثبت‌شده', value: fa(dinnerCount), hint: 'مستقل از ناهار', icon: Moon },
  ]
  const recent = app.feed.filter((item) => item.employeeId === id).slice(0, 5)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line lg:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="bg-surface px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 text-muted">
                <p className="text-[11px] leading-4">{item.label}</p>
                <Icon size={14} aria-hidden />
              </div>
              <p className="mt-1 text-xl font-semibold leading-none">{item.value}</p>
              <p className="mt-1 text-[11px] leading-4 text-muted">{item.hint}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <DashPanel
          className="order-2 lg:order-none lg:col-span-3"
          title="وضعیت سفارش‌ها"
          action={<button className="min-h-11 px-2 text-xs text-link" onClick={() => jump('all')}>رفتن به منو</button>}
        >
          <div className="grid grid-cols-2 gap-2">
            <Bucket title="روزهای پیش رو" count={upcoming.length} sample={upcoming.slice(0, 3).map((day) => fa(day.jd))} onClick={() => jump('open')} />
            <Bucket title="روزهای دارای انتخاب" count={selectedDays.length} sample={selectedDays.slice(-3).map((day) => fa(day.jd))} onClick={() => jump('selected')} />
            <Bucket title="ناهار ثبت‌نشده" count={missingLunch.length} sample={missingLunch.slice(0, 3).map((day) => fa(day.jd))} onClick={() => jump('unselected', 'lunch')} />
            <Bucket title="مهلت گذشته" count={passed.length} sample={passed.slice(-3).map((day) => fa(day.jd))} />
          </div>
        </DashPanel>
        <DashPanel className="order-1 lg:order-none lg:col-span-2" title="سه وعده پیش رو">
          {upcomingMeals.length === 0 ? (
            <p className="py-2 text-sm text-muted">سفارش آینده‌ای ثبت نشده. ناهار یا شام وقتی اینجا می‌آید که غذا انتخاب شده باشد و زمان وعده هنوز نرسیده باشد.</p>
          ) : (
            <ul className="grid gap-2">
              {upcomingMeals.map((order) => (
                <li key={order.id} className="rounded-md border border-line bg-surface2 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">{dayHeading(order, app.now)} · {fa(order.jd)} {JALALI_MONTHS[order.jm - 1]}</span>
                    <span className={cn('shrink-0 text-[11px]', order.meal === 'lunch' ? 'text-lunch' : 'text-dinner')}>{order.meal === 'lunch' ? 'ناهار' : 'شام'}</span>
                  </div>
                  <p className="mt-1 break-words text-sm">{order.choice}</p>
                </li>
              ))}
            </ul>
          )}
        </DashPanel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <DashPanel title="نزدیک‌ترین مهلت‌ها">
          <ul className="divide-y divide-line">
            {deadlines.map((item) => (
              <li key={`${item.jd}-${item.meal}`} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                <span className="min-w-0">
                  <span className={cn('ms-2 text-xs', item.meal === 'lunch' ? 'text-lunch' : 'text-dinner')}>{item.meal === 'lunch' ? 'ناهار' : 'شام'}</span>
                  {fa(item.jd)} {JALALI_MONTHS[item.jm - 1]}
                </span>
                <span className="text-muted">{item.text}</span>
              </li>
            ))}
          </ul>
        </DashPanel>
        <DashPanel title="سفارش‌های اخیر">
          {recent.length === 0 ? (
            <p className="py-2 text-sm text-muted">سفارش اخیری برای این حساب نیست.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-1.5 text-sm">
                  <span className="min-w-0 break-words">{item.text}</span>
                  <span className="shrink-0 text-[11px] text-muted">{item.at}</span>
                </li>
              ))}
            </ul>
          )}
        </DashPanel>
      </div>
    </div>
  )
}

function DashPanel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-md border border-line bg-surface', className)}>
      <div className="flex min-h-10 items-center justify-between gap-2 border-b border-line px-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </section>
  )
}

function Bucket({ title, count, sample, onClick }: { title: string; count: number; sample: string[]; onClick?: () => void }) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="block text-[13px] leading-5">{title}</span>
        <span className="block truncate text-[11px] leading-4 text-muted">{sample.length ? sample.join('، ') : 'موردی نیست'}</span>
      </span>
      <span className="shrink-0 text-base font-semibold">{fa(count)}</span>
    </>
  )
  const className = 'flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-line bg-surface2 px-2.5 py-1.5 text-start'
  if (!onClick) return <div className={className}>{body}</div>
  return <button type="button" className={cn(className, 'hover:bg-elevated')} onClick={onClick}>{body}</button>
}

function SupportOverview() {
  return <LiveOpsOverview variant="support" />
}

function LiveOpsOverview({ variant }: { variant: 'support' | 'management' }) {
  const app = useApp()
  const guests = useGuestMonthCount()
  const counts = useSupportOrderCounts()
  const published = usePublishedMenu(app.selectedMonth.jy, app.selectedMonth.jm)
  const recent = useRecentAudit(5)
  const openDays = published.status === 'ready' && app.deadlineStatus === 'ready'
    ? published.pickerDays.filter((day) => isOpenDeadlineDay(day, app.mealDeadlineAt))
    : []
  const openValue = variant === 'management'
    ? managementOpenDaysMetric(published.status, app.deadlineStatus, openDays.length)
    : openDaysMetric(published.status, app.deadlineStatus, openDays.length)
  const deadlinesLoading = published.status === 'loading' || app.deadlineStatus === 'loading'
  const deadlinesReady = published.status === 'ready' && app.deadlineStatus === 'ready'
  const managementDeadlinesEmpty = variant === 'management' && app.deadlineStatus === 'ready' && (published.status === 'empty' || (published.status === 'ready' && openDays.length === 0))
  const managementDeadlinesError = variant === 'management' && !deadlinesLoading && !deadlinesReady && !managementDeadlinesEmpty
  const fourth = variant === 'support'
    ? { label: 'سفارش مهمان', value: metricValue(guests.status, guests.count), hint: 'مورد فعال', icon: Utensils }
    : { label: 'سفارش‌های فعال', value: metricValue(counts.status, combinedActiveCount(counts.status, counts.lunch, counts.dinner)), hint: 'مجموع ناهار و شام', icon: Utensils }
  const retry = () => {
    counts.retry()
    published.retry()
    recent.retry()
  }

  return (
    <div className="space-y-4">
      <Stats
        items={[
          { label: 'ناهارهای ثبت‌شده', value: metricValue(counts.status, counts.lunch), hint: 'همه ساختمان‌ها', icon: Sun },
          { label: 'شام‌های ثبت‌شده', value: metricValue(counts.status, counts.dinner), hint: 'جدا از ناهار', icon: Moon },
          { label: 'روزهای باز', value: openValue, hint: 'هنوز مهلت دارند', icon: CalendarClock },
          fourth,
        ]}
      />
      {variant === 'management' && (counts.status === 'error' || managementDeadlinesError || recent.status === 'error') && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
          <p className="text-sm text-danger">{counts.message || published.message || recent.message || 'داده‌های نمای کلی از سامانه خوانده نشد.'}</p>
          <Button variant="secondary" onClick={retry}>تلاش دوباره</Button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="مهلت‌های پیش رو" action={variant === 'support'
          ? <button className="min-h-11 px-2 text-xs text-link" onClick={() => app.setPage('menuMgmt')}>مدیریت منو</button>
          : <button className="min-h-11 px-2 text-xs text-link" onClick={() => app.setPage('reports')}>گزارش‌ها</button>}
        >
          {deadlinesLoading ? <p className="text-sm text-muted">در حال خواندن مهلت‌ها…</p> : variant === 'support' ? (
            published.status !== 'ready' || app.deadlineStatus !== 'ready' ? <p className="text-sm text-danger">مهلت‌ها از سامانه خوانده نشد.</p> : openDays.length === 0 ? <p className="text-sm text-muted">روز بازی با مهلت ذخیره‌شده نیست.</p> : <UpcomingDeadlines days={openDays} />
          ) : managementDeadlinesError ? <p className="text-sm text-danger">{published.message || app.deadlineMessage || 'مهلت‌ها از سامانه خوانده نشد.'}</p> : managementDeadlinesEmpty ? <p className="text-sm text-muted">روز بازی با مهلت ذخیره‌شده نیست.</p> : <UpcomingDeadlines days={openDays} />}
        </Panel>
        <Panel title={variant === 'support' ? 'فعالیت عملیاتی اخیر' : 'فعالیت اخیر'} action={<button className="min-h-11 px-2 text-xs text-link" onClick={() => app.setPage('activity')}>{variant === 'support' ? 'تاریخچه' : 'تاریخچه کامل'}</button>}>
          {recent.status === 'loading' ? <p className="text-sm text-muted">در حال خواندن تاریخچه…</p> : recent.status !== 'ready' ? <p className="text-sm text-danger">{recent.message || 'تاریخچه خوانده نشد.'}</p> : recent.items.length === 0 ? <p className="text-sm text-muted">رویدادی ثبت نشده است.</p> : (
            <ul className="divide-y divide-line text-sm">
              {recent.items.map((item) => (
                <li key={item.id} className="py-2">
                  <p>{item.actorUsername || 'سامانه'} · {item.action}</p>
                  <p className="text-xs text-muted">{item.entityType} · {item.createdAt}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

function UpcomingDeadlines({ days }: { days: ReturnType<typeof usePublishedMenu>['pickerDays'] }) {
  const app = useApp()
  return (
    <ul className="space-y-2 text-sm">
      {days.slice(0, 4).map((day) => {
        const lunch = classifyEmployeeDeadline(app.mealDeadlineAt(day, 'lunch'))
        const dinner = classifyEmployeeDeadline(app.mealDeadlineAt(day, 'dinner'))
        const lunchState = app.mealDeadlineAt(day, 'lunch')
        const dinnerState = app.mealDeadlineAt(day, 'dinner')
        return (
          <li key={day.jd} className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
            <span className="min-w-0">{fa(day.jd)} {JALALI_MONTHS[day.jm - 1]}، {day.weekday}</span>
            <span className="break-words text-muted">
              {day.lunch && lunch === 'open' && typeof lunchState === 'object' ? `ناهار ${formatDeadlineFromInstant(lunchState.at, day.gregorianDate) ?? 'مهلت باز'}` : ''}
              {day.lunch && lunch === 'open' && day.dinner && dinner === 'open' ? ' · ' : ''}
              {day.dinner && dinner === 'open' && typeof dinnerState === 'object' ? `شام ${formatDeadlineFromInstant(dinnerState.at, day.gregorianDate) ?? 'مهلت باز'}` : ''}
            </span>
          </li>
        )
      })}
    </ul>
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
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-muted">دسترسی مدیریت فقط مشاهده است. ایجاد، ویرایش و حذف در این نقش وجود ندارد.</p>
      <LiveOpsOverview variant="management" />
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

