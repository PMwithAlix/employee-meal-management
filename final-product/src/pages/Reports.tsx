import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, Empty } from '../components/ui'
import { fullName } from '../data'
import { AuthRequestError } from '../auth/errors'
import { buildingApi, type BuildingSummary } from '../buildings/client'
import { groupApi, type DirectoryGroup } from '../groups/client'
import { jalaliMonthLength, JALALI_MONTHS } from '../lib/jalali'
import { fa } from '../lib/text'
import { formatGregorianDate, jalaliFromMealDate } from '../menus/map'
import { orderApi } from '../orders/client'
import type { BackendOrder } from '../orders/types'
import { useStaffRatings } from '../orders/useStaffRatings'
import { usesLiveOrganizationData } from '../permissions'
import { useApp } from '../store'
import { userApi, type DirectoryUser } from '../users/client'
import type { MealKind } from '../types'

type ReportTab = 'lunch' | 'dinner' | 'monthly' | 'comments'

export function ReportsPage() {
  const app = useApp()
  if (usesLiveOrganizationData(app.role)) return <LiveReportsPage />
  return <SeedReportsPage />
}

function SeedReportsPage() {
  const app = useApp()
  const [tab, setTab] = useState<ReportTab>('lunch')
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(30)
  const length = jalaliMonthLength(app.selectedMonth.jy, app.selectedMonth.jm)
  useEffect(() => {
    setFrom(1)
    setTo(length)
  }, [app.selectedMonth.jy, app.selectedMonth.jm, length])
  const [buildingId, setBuildingId] = useState('all')
  const [employeeId, setEmployeeId] = useState('all')
  const [groupId, setGroupId] = useState('all')
  const [meal, setMeal] = useState<'all' | MealKind>('all')
  const rangeInvalid = from > to
  const matchesScope = (order: { jy: number; jm: number; jd: number; buildingId: string; employeeId: string }) => {
    if (order.jy !== app.selectedMonth.jy || order.jm !== app.selectedMonth.jm) return false
    if (order.jd < from || order.jd > to) return false
    if (buildingId !== 'all' && order.buildingId !== buildingId) return false
    const employee = app.employees.find((item) => item.id === order.employeeId)
    if (!employee) return false
    if (employeeId !== 'all' && employee.id !== employeeId) return false
    if (groupId !== 'all' && !employee.groupIds.includes(groupId)) return false
    return true
  }
  const daily = useMemo(() => app.orders.filter((order) => Boolean(order.choice) && matchesScope(order)), [app.orders, app.employees, app.selectedMonth.jy, app.selectedMonth.jm, from, to, buildingId, employeeId, groupId])
  const monthly = useMemo(() => app.employees.flatMap((employee) => {
    if (employeeId !== 'all' && employee.id !== employeeId) return []
    if (groupId !== 'all' && !employee.groupIds.includes(groupId)) return []
    const mine = app.orders.filter((order) => order.employeeId === employee.id && order.choice && order.jy === app.selectedMonth.jy && order.jm === app.selectedMonth.jm && order.jd >= from && order.jd <= to && (buildingId === 'all' || order.buildingId === buildingId))
    const buildingIds = [...new Set(mine.map((order) => order.buildingId))]
    return buildingIds.map((historicalBuildingId) => {
      const orders = mine.filter((order) => order.buildingId === historicalBuildingId)
      return { id: `${employee.id}:${historicalBuildingId}`, name: fullName(employee), building: app.buildings.find((item) => item.id === historicalBuildingId)?.name ?? '—', lunch: orders.filter((order) => order.meal === 'lunch').length, dinner: orders.filter((order) => order.meal === 'dinner').length }
    })
  }), [app.employees, app.orders, app.buildings, app.selectedMonth.jy, app.selectedMonth.jm, from, to, buildingId, employeeId, groupId])
  const ratings = useStaffRatings()
  const comments = ratings.items.filter((item) => {
    const date = item.mealDate ? jalaliFromMealDate(item.mealDate) : null
    if (!date || date.jy !== app.selectedMonth.jy || date.jm !== app.selectedMonth.jm) return false
    if (date.jd < from || date.jd > to) return false
    const itemMeal = item.mealType === 'DINNER' ? 'dinner' : item.mealType === 'LUNCH' ? 'lunch' : null
    if (meal !== 'all' && itemMeal !== meal) return false
    if (employeeId !== 'all' && item.userId !== employeeId) return false
    if (buildingId !== 'all') {
      const building = app.buildings.find((entry) => entry.id === buildingId)
      if (!building || item.buildingNameSnapshot !== building.name) return false
    }
    return true
  })
  const lunchRows = daily.filter((order) => order.meal === 'lunch')
  const dinnerRows = daily.filter((order) => order.meal === 'dinner')
  const blocked = (tab === 'lunch' && meal === 'dinner') || (tab === 'dinner' && meal === 'lunch')
  return (
    <ReportShell tab={tab} setTab={setTab} from={from} setFrom={setFrom} to={to} setTo={setTo} length={length} buildingId={buildingId} setBuildingId={setBuildingId} employeeId={employeeId} setEmployeeId={setEmployeeId} groupId={groupId} setGroupId={setGroupId} meal={meal} setMeal={setMeal} buildings={app.buildings} employees={app.employees.map((item) => ({ id: item.id, username: fullName(item) }))} groups={app.groups}>
      {rangeInvalid ? <Empty title="بازه تاریخ درست نیست" body="روز شروع نباید بعد از روز پایان باشد." /> : blocked ? <Empty title="این گزارش وعده دیگر را نشان نمی‌دهد" body={tab === 'lunch' ? 'گزارش ناهار فقط ناهار است. برای شام، گزارش شام را باز کنید.' : 'گزارش شام فقط شام است. برای ناهار، گزارش ناهار را باز کنید.'} /> : tab === 'lunch' ? <SeedOrderTable rows={lunchRows} meal="lunch" /> : tab === 'dinner' ? <SeedOrderTable rows={dinnerRows} meal="dinner" /> : tab === 'monthly' ? <MonthlyTable rows={monthly.filter((row) => (meal === 'lunch' ? row.lunch > 0 : meal === 'dinner' ? row.dinner > 0 : true))} meal={meal} /> : <CommentsBlock ratings={ratings} comments={comments} />}
    </ReportShell>
  )
}

function LiveReportsPage() {
  const app = useApp()
  const [tab, setTab] = useState<ReportTab>('lunch')
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(30)
  const length = jalaliMonthLength(app.selectedMonth.jy, app.selectedMonth.jm)
  useEffect(() => {
    setFrom(1)
    setTo(length)
  }, [app.selectedMonth.jy, app.selectedMonth.jm, length])
  const [buildingId, setBuildingId] = useState('all')
  const [employeeId, setEmployeeId] = useState('all')
  const [groupId, setGroupId] = useState('all')
  const [meal, setMeal] = useState<'all' | MealKind>('all')
  const [buildings, setBuildings] = useState<BuildingSummary[]>([])
  const [employees, setEmployees] = useState<DirectoryUser[]>([])
  const [groups, setGroups] = useState<DirectoryGroup[]>([])
  const [orders, setOrders] = useState<BackendOrder[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [boot, setBoot] = useState(0)
  const rangeInvalid = from > to
  const blocked = (tab === 'lunch' && meal === 'dinner') || (tab === 'dinner' && meal === 'lunch')

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      buildingApi.list(controller.signal),
      userApi.listAll({ role: 'EMPLOYEE', isActive: true }, controller.signal),
      groupApi.list(controller.signal),
    ]).then(([listedBuildings, listedUsers, listedGroups]) => {
      if (controller.signal.aborted) return
      setBuildings(listedBuildings)
      setEmployees(listedUsers.items)
      setGroups(listedGroups)
    }).catch(() => {
      if (controller.signal.aborted) return
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (rangeInvalid) return
    const controller = new AbortController()
    setStatus('loading')
    const fromDate = formatGregorianDate(app.selectedMonth.jy, app.selectedMonth.jm, from)
    const toDate = formatGregorianDate(app.selectedMonth.jy, app.selectedMonth.jm, to)
    void orderApi.listAllManaged({
      from: fromDate,
      to: toDate,
      status: 'ACTIVE',
      buildingId: buildingId === 'all' ? undefined : buildingId,
      userId: employeeId === 'all' ? undefined : employeeId,
      groupId: groupId === 'all' ? undefined : groupId,
      mealType: meal === 'lunch' ? 'LUNCH' : meal === 'dinner' ? 'DINNER' : undefined,
    }, controller.signal).then((listed) => {
      if (controller.signal.aborted) return
      setOrders(listed.items)
      setStatus('ready')
      setMessage('')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setOrders([])
      setStatus('error')
      setMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری گزارش انجام نشد.')
    })
    return () => controller.abort()
  }, [app.selectedMonth.jy, app.selectedMonth.jm, from, to, buildingId, employeeId, groupId, meal, rangeInvalid, boot])

  const ratings = useStaffRatings()
  const comments = ratings.items.filter((item) => {
    const date = item.mealDate ? jalaliFromMealDate(item.mealDate) : null
    if (!date || date.jy !== app.selectedMonth.jy || date.jm !== app.selectedMonth.jm) return false
    if (date.jd < from || date.jd > to) return false
    const itemMeal = item.mealType === 'DINNER' ? 'dinner' : item.mealType === 'LUNCH' ? 'lunch' : null
    if (meal !== 'all' && itemMeal !== meal) return false
    if (employeeId !== 'all' && item.userId !== employeeId) return false
    if (buildingId !== 'all') {
      const building = buildings.find((entry) => entry.id === buildingId)
      if (!building || item.buildingNameSnapshot !== building.name) return false
    }
    return true
  })
  const lunchRows = orders.filter((order) => order.mealType === 'LUNCH')
  const dinnerRows = orders.filter((order) => order.mealType === 'DINNER')
  const monthlyMap = new Map<string, { id: string; name: string; building: string; lunch: number; dinner: number }>()
  for (const order of orders) {
    const building = order.currentCycle?.buildingNameSnapshot || '—'
    const name = order.currentCycle?.usernameSnapshot || '—'
    const key = `${order.userId}:${order.currentCycle?.buildingIdSnapshot ?? building}`
    const current = monthlyMap.get(key) ?? { id: key, name, building, lunch: 0, dinner: 0 }
    if (order.mealType === 'LUNCH') current.lunch += 1
    if (order.mealType === 'DINNER') current.dinner += 1
    monthlyMap.set(key, current)
  }
  const monthlyRows = [...monthlyMap.values()].filter((row) => (meal === 'lunch' ? row.lunch > 0 : meal === 'dinner' ? row.dinner > 0 : true))

  return (
    <ReportShell tab={tab} setTab={setTab} from={from} setFrom={setFrom} to={to} setTo={setTo} length={length} buildingId={buildingId} setBuildingId={setBuildingId} employeeId={employeeId} setEmployeeId={setEmployeeId} groupId={groupId} setGroupId={setGroupId} meal={meal} setMeal={setMeal} buildings={buildings} employees={employees.map((item) => ({ id: item.id, username: item.username }))} groups={groups}>
      {rangeInvalid ? <Empty title="بازه تاریخ درست نیست" body="روز شروع نباید بعد از روز پایان باشد." /> : blocked ? <Empty title="این گزارش وعده دیگر را نشان نمی‌دهد" body={tab === 'lunch' ? 'گزارش ناهار فقط ناهار است. برای شام، گزارش شام را باز کنید.' : 'گزارش شام فقط شام است. برای ناهار، گزارش ناهار را باز کنید.'} /> : tab === 'comments' ? <CommentsBlock ratings={ratings} comments={comments} /> : status === 'loading' ? <Empty title="در حال بارگذاری گزارش" body="سفارش‌های سازمان از سامانه خوانده می‌شوند." /> : status === 'error' ? (
        <div>
          <Empty title="گزارش از سامانه خوانده نشد" body={message} />
          <Button className="mt-2" variant="secondary" onClick={() => setBoot((value) => value + 1)}>تلاش دوباره</Button>
        </div>
      ) : tab === 'lunch' ? <LiveOrderTable rows={lunchRows} meal="lunch" /> : tab === 'dinner' ? <LiveOrderTable rows={dinnerRows} meal="dinner" /> : <MonthlyTable rows={monthlyRows} meal={meal} />}
    </ReportShell>
  )
}

function ReportShell({
  tab, setTab, from, setFrom, to, setTo, length, buildingId, setBuildingId, employeeId, setEmployeeId, groupId, setGroupId, meal, setMeal, buildings, employees, groups, children,
}: {
  tab: ReportTab
  setTab: (tab: ReportTab) => void
  from: number
  setFrom: (value: number) => void
  to: number
  setTo: (value: number) => void
  length: number
  buildingId: string
  setBuildingId: (value: string) => void
  employeeId: string
  setEmployeeId: (value: string) => void
  groupId: string
  setGroupId: (value: string) => void
  meal: 'all' | MealKind
  setMeal: (value: 'all' | MealKind) => void
  buildings: Array<{ id: string; name: string }>
  employees: Array<{ id: string; username: string }>
  groups: Array<{ id: string; name: string }>
  children: ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {([['lunch', 'گزارش ناهار'], ['dinner', 'گزارش شام'], ['monthly', 'گزارش ماهانه کارکنان'], ['comments', 'دیدگاه‌ها']] as const).map(([id, label]) => (
          <button key={id} className={`min-h-11 rounded-md px-3 text-sm ${tab === id ? 'bg-primary text-onprimary' : 'border border-line bg-surface'}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="grid gap-2 rounded-md border border-line bg-surface p-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-xs text-muted">از روز<select className="mt-1 h-11 w-full rounded-md border border-line bg-bg px-2 text-base text-ink" value={from} onChange={(event) => setFrom(Number(event.target.value))}>{days(length)}</select></label>
        <label className="text-xs text-muted">تا روز<select className="mt-1 h-11 w-full rounded-md border border-line bg-bg px-2 text-base text-ink" value={to} onChange={(event) => setTo(Number(event.target.value))}>{days(length)}</select></label>
        <label className="text-xs text-muted">ساختمان<select className="mt-1 h-11 w-full rounded-md border border-line bg-bg px-2 text-base text-ink" value={buildingId} onChange={(event) => setBuildingId(event.target.value)}><option value="all">همه</option>{buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-xs text-muted">کارمند<select className="mt-1 h-11 w-full rounded-md border border-line bg-bg px-2 text-base text-ink" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="all">همه</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.username}</option>)}</select></label>
        <label className="text-xs text-muted">گروه<select className="mt-1 h-11 w-full rounded-md border border-line bg-bg px-2 text-base text-ink" value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="all">همه</option>{groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-xs text-muted">وعده<select className="mt-1 h-11 w-full rounded-md border border-line bg-bg px-2 text-base text-ink" value={meal} onChange={(event) => setMeal(event.target.value as 'all' | MealKind)}><option value="all">همه</option><option value="lunch">ناهار</option><option value="dinner">شام</option></select></label>
      </div>
      {children}
    </div>
  )
}

function days(length: number) {
  return Array.from({ length }, (_, index) => <option key={index + 1} value={index + 1}>{fa(index + 1)}</option>)
}

function SeedOrderTable({ rows, meal }: { rows: ReturnType<typeof useApp>['orders']; meal: MealKind }) {
  const app = useApp()
  if (rows.length === 0) return <Empty title="ردیفی برای این فیلتر نیست" body="بازه تاریخ، ساختمان، کارمند یا گروه را تغییر دهید." />
  return (
    <div className="hidden overflow-hidden rounded-md border border-line bg-surface lg:block">
      <table className="w-full text-sm">
        <thead className="bg-elevated text-xs text-muted">
          <tr>{['تاریخ', 'ساختمان زمان سفارش', 'کارمند', meal === 'lunch' ? 'ناهار انتخاب‌شده' : 'شام انتخاب‌شده'].map((head) => <th key={head} className="px-3 py-2 text-start font-medium">{head}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((order) => {
            const employee = app.employees.find((item) => item.id === order.employeeId)
            return (
              <tr key={order.id} className="border-t border-line">
                <td className="px-3 py-2">{fa(order.jd)} {JALALI_MONTHS[order.jm - 1]}</td>
                <td className="px-3 py-2">{app.buildings.find((item) => item.id === order.buildingId)?.name}</td>
                <td className="px-3 py-2">{employee ? fullName(employee) : '—'}</td>
                <td className="px-3 py-2">{order.choice}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function LiveOrderTable({ rows, meal }: { rows: BackendOrder[]; meal: MealKind }) {
  if (rows.length === 0) return <Empty title="ردیفی برای این فیلتر نیست" body="بازه تاریخ، ساختمان، کارمند یا گروه را تغییر دهید." />
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-elevated text-xs text-muted">
          <tr>{['تاریخ', 'ساختمان زمان سفارش', 'کارمند', meal === 'lunch' ? 'ناهار انتخاب‌شده' : 'شام انتخاب‌شده'].map((head) => <th key={head} className="px-3 py-2 text-start font-medium">{head}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((order) => {
            const date = jalaliFromMealDate(order.mealDate)
            return (
              <tr key={order.id} className="border-t border-line">
                <td className="px-3 py-2">{date ? `${fa(date.jd)} ${JALALI_MONTHS[date.jm - 1]}` : order.jalaliDate ?? order.mealDate}</td>
                <td className="px-3 py-2">{order.currentCycle?.buildingNameSnapshot || '—'}</td>
                <td className="px-3 py-2">{order.currentCycle?.usernameSnapshot || '—'}</td>
                <td className="px-3 py-2">{order.currentCycle?.optionTitle || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MonthlyTable({ rows, meal }: { rows: Array<{ id: string; name: string; building: string; lunch: number; dinner: number }>; meal: 'all' | MealKind }) {
  if (rows.length === 0) return <Empty title="کارمندی در این بازه سفارش ندارد" body="فقط کارکنانی نشان داده می‌شوند که در ساختمان زمان سفارش، انتخاب ثبت‌شده داشته باشند." />
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-elevated text-xs text-muted">
          <tr>{['کارمند', 'ساختمان زمان سفارش', 'تعداد ناهار', 'تعداد شام'].map((head) => <th key={head} className="px-3 py-2 text-start font-medium">{head}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className="px-3 py-2">{row.name}</td>
              <td className="px-3 py-2">{row.building}</td>
              <td className="px-3 py-2">{meal === 'dinner' ? '—' : fa(row.lunch)}</td>
              <td className="px-3 py-2">{meal === 'lunch' ? '—' : fa(row.dinner)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CommentsBlock({ ratings, comments }: { ratings: ReturnType<typeof useStaffRatings>; comments: ReturnType<typeof useStaffRatings>['items'] }) {
  if (ratings.status === 'loading') return <Empty title="در حال بارگذاری دیدگاه‌ها" body="بازخوردها از سامانه خوانده می‌شوند." />
  if (ratings.status === 'forbidden') return <Empty title="دسترسی ندارید" body={ratings.message || 'مشاهده دیدگاه‌ها برای این نقش مجاز نیست.'} />
  if (ratings.status === 'unavailable' || ratings.status === 'error') {
    return (
      <div>
        <Empty title="دیدگاه‌ها از سامانه خوانده نشد" body={ratings.message || 'داده نمایشی جایگزین نمی‌شود.'} />
        <Button className="mt-2" variant="secondary" onClick={ratings.retry}>تلاش دوباره</Button>
      </div>
    )
  }
  if (comments.length === 0) return <Empty title="دیدگاهی برای این فیلتر نیست" body="بازه تاریخ، ساختمان، کارمند، گروه یا وعده را تغییر دهید." />
  return (
    <div className="space-y-2">
      {comments.map((item) => {
        const date = item.mealDate ? jalaliFromMealDate(item.mealDate) : null
        return (
          <article key={item.id} className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
            <p className="font-medium">{item.usernameSnapshot || 'کارمند'} · {item.mealType === 'DINNER' ? 'شام' : 'ناهار'} {date ? `${fa(date.jd)} ${JALALI_MONTHS[date.jm - 1]}` : item.jalaliDate}</p>
            <p className="text-muted">{item.buildingNameSnapshot || '—'}</p>
            {item.mealTitleSnapshot ? <p className="text-muted">{item.mealTitleSnapshot}</p> : null}
            <p>امتیاز {fa(item.score)} از ۵</p>
            <p className="break-words text-muted">{item.comment?.trim() ? item.comment : 'بدون توضیح'}</p>
          </article>
        )
      })}
    </div>
  )
}
