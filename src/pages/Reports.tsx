import { useMemo, useState } from 'react'
import { Empty } from '../components/ui'
import { fullName } from '../data'
import { useApp } from '../store'
import { fa } from '../lib/text'
import type { MealKind } from '../types'

type ReportTab = 'lunch' | 'dinner' | 'monthly' | 'comments'

export function ReportsPage() {
  const app = useApp()
  const [tab, setTab] = useState<ReportTab>('lunch')
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(30)
  const [buildingId, setBuildingId] = useState('all')
  const [employeeId, setEmployeeId] = useState('all')
  const [groupId, setGroupId] = useState('all')
  const [meal, setMeal] = useState<'all' | MealKind>('all')

  const daily = useMemo(() => {
    return app.orders.filter((order) => {
      if (!order.choice) return false
      if (order.jd < from || order.jd > to) return false
      if (buildingId !== 'all' && order.buildingId !== buildingId) return false
      const employee = app.employees.find((item) => item.id === order.employeeId)
      if (!employee) return false
      if (employeeId !== 'all' && employee.id !== employeeId) return false
      if (groupId !== 'all' && !employee.groupIds.includes(groupId)) return false
      return true
    })
  }, [app.orders, app.employees, from, to, buildingId, employeeId, groupId])

  const monthly = useMemo(() => {
    return app.employees.filter((employee) => {
      if (buildingId !== 'all' && employee.buildingId !== buildingId) return false
      if (employeeId !== 'all' && employee.id !== employeeId) return false
      if (groupId !== 'all' && !employee.groupIds.includes(groupId)) return false
      return true
    }).map((employee) => {
      const mine = app.orders.filter((order) => order.employeeId === employee.id && order.choice && order.jd >= from && order.jd <= to)
      const buildingAtOrder = mine[0] ? app.buildings.find((item) => item.id === mine[0].buildingId)?.name : app.buildings.find((item) => item.id === employee.buildingId)?.name
      return {
        id: employee.id,
        name: fullName(employee),
        building: buildingAtOrder ?? '—',
        lunch: mine.filter((order) => order.meal === 'lunch').length,
        dinner: mine.filter((order) => order.meal === 'dinner').length,
      }
    })
  }, [app.employees, app.orders, app.buildings, from, to, buildingId, employeeId, groupId])

  const comments = app.orders.filter((order) => order.rating && order.jd >= from && order.jd <= to)

  const lunchRows = daily.filter((order) => order.meal === 'lunch')
  const dinnerRows = daily.filter((order) => order.meal === 'dinner')
  const blocked = (tab === 'lunch' && meal === 'dinner') || (tab === 'dinner' && meal === 'lunch')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {([['lunch', 'گزارش ناهار'], ['dinner', 'گزارش شام'], ['monthly', 'گزارش ماهانه کارکنان'], ['comments', 'دیدگاه‌ها']] as const).map(([id, label]) => (
          <button key={id} className={`h-9 rounded-md px-3 text-sm ${tab === id ? 'bg-primary text-onprimary' : 'border border-line bg-surface'}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="grid gap-2 rounded-md border border-line bg-surface p-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-xs text-muted">از روز<select className="mt-1 h-9 w-full rounded-md border border-line bg-bg px-2 text-sm text-ink" value={from} onChange={(event) => setFrom(Number(event.target.value))}>{days()}</select></label>
        <label className="text-xs text-muted">تا روز<select className="mt-1 h-9 w-full rounded-md border border-line bg-bg px-2 text-sm text-ink" value={to} onChange={(event) => setTo(Number(event.target.value))}>{days()}</select></label>
        <label className="text-xs text-muted">ساختمان<select className="mt-1 h-9 w-full rounded-md border border-line bg-bg px-2 text-sm text-ink" value={buildingId} onChange={(event) => setBuildingId(event.target.value)}><option value="all">همه</option>{app.buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-xs text-muted">کارمند<select className="mt-1 h-9 w-full rounded-md border border-line bg-bg px-2 text-sm text-ink" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="all">همه</option>{app.employees.map((item) => <option key={item.id} value={item.id}>{fullName(item)}</option>)}</select></label>
        <label className="text-xs text-muted">گروه<select className="mt-1 h-9 w-full rounded-md border border-line bg-bg px-2 text-sm text-ink" value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="all">همه</option>{app.groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-xs text-muted">وعده<select className="mt-1 h-9 w-full rounded-md border border-line bg-bg px-2 text-sm text-ink" value={meal} onChange={(event) => setMeal(event.target.value as 'all' | MealKind)}><option value="all">همه</option><option value="lunch">ناهار</option><option value="dinner">شام</option></select></label>
      </div>
      {blocked ? (
        <Empty title="این گزارش وعده دیگر را نشان نمی‌دهد" body={tab === 'lunch' ? 'گزارش ناهار فقط ناهار است. برای شام، گزارش شام را باز کنید.' : 'گزارش شام فقط شام است. برای ناهار، گزارش ناهار را باز کنید.'} />
      ) : tab === 'lunch' ? (
        <OrderTable rows={lunchRows} meal="lunch" />
      ) : tab === 'dinner' ? (
        <OrderTable rows={dinnerRows} meal="dinner" />
      ) : tab === 'monthly' ? (
        <div className="overflow-auto rounded-md border border-line bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface2 text-xs text-muted">
              <tr>
                {['کارمند', 'ساختمان زمان سفارش', 'تعداد ناهار', 'تعداد شام'].map((head) => <th key={head} className="px-3 py-2 text-start font-medium">{head}</th>)}
              </tr>
            </thead>
            <tbody>
              {monthly.filter((row) => (meal === 'lunch' ? row.lunch > 0 : meal === 'dinner' ? row.dinner > 0 : true)).map((row) => (
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
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted">دیدگاه کارکنان فقط برای پشتیبان، مدیریت و ادمین نمایش داده می‌شود.</p>
          {comments.length === 0 ? <Empty title="دیدگاهی در این بازه نیست" body="فیلتر تاریخ را بازتر کنید." /> : comments.map((order) => {
            const employee = app.employees.find((item) => item.id === order.employeeId)
            return (
              <article key={order.id} className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
                <p className="font-medium">{employee ? fullName(employee) : 'کارمند'} · {order.meal === 'lunch' ? 'ناهار' : 'شام'} {fa(order.jd)} آبان</p>
                <p>امتیاز {fa(order.rating?.score ?? 0)} از ۵</p>
                <p className="text-muted">{order.rating?.comment || 'بدون توضیح'}</p>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function days() {
  return Array.from({ length: 30 }, (_, index) => <option key={index + 1} value={index + 1}>{fa(index + 1)}</option>)
}

function OrderTable({ rows, meal }: { rows: ReturnType<typeof useApp>['orders']; meal: MealKind }) {
  const app = useApp()
  if (rows.length === 0) return <Empty title="ردیفی برای این فیلتر نیست" body="بازه تاریخ، ساختمان یا گروه را تغییر دهید." />
  return (
    <div className="overflow-auto rounded-md border border-line bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-surface2 text-xs text-muted">
          <tr>
            {['تاریخ', 'ساختمان', 'کارمند', meal === 'lunch' ? 'ناهار انتخاب‌شده' : 'شام انتخاب‌شده'].map((head) => <th key={head} className="px-3 py-2 text-start font-medium">{head}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => {
            const employee = app.employees.find((item) => item.id === order.employeeId)
            return (
              <tr key={order.id} className="border-t border-line">
                <td className="px-3 py-2">{fa(order.jd)} آبان</td>
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
