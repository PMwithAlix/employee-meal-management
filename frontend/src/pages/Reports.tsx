import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { Button, Empty, Segmented } from '../shared/ui/primitives'
import { JalaliDateField } from '../shared/ui/JalaliDateField'
import { AuthRequestError } from '../features/auth/lib/auth-errors'
import { reportApi } from '../features/reports/api/reports-api'
import { dishes, foodsWithOrders, formatReportInstant, mealFilterLabel, mealLabel, showsDinner, showsLunch, todayIsoDate } from '../features/reports/lib/report-mapper'
import { MonthlyReportView } from '../features/reports/ui/MonthlyReportView'
import type { DailyReport, DailyReportBuilding, DailyReportGuestRow, DailyReportMealSummary, MonthlyReport, ReportMealFilter, ReportPeriod } from '../features/reports/model/report-types'
import { jalaliFromIsoDate } from '../shared/lib/jalali-picker'
import { addMonths, currentDateTime, JALALI_MONTHS, weekdayName, type JalaliDate } from '../shared/lib/jalali'
import { fa } from '../shared/lib/persian-text'

type DailyKind = 'restaurant' | 'buildings'

const MEAL_OPTIONS = [
  { id: 'ALL' as const, label: 'هر دو وعده' },
  { id: 'LUNCH' as const, label: 'فقط ناهار' },
  { id: 'DINNER' as const, label: 'فقط شام' },
]

export function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('daily')
  const [meal, setMeal] = useState<ReportMealFilter>('ALL')
  const [mealDate, setMealDate] = useState(todayIsoDate)
  const [month, setMonth] = useState<Pick<JalaliDate, 'jy' | 'jm'>>(() => {
    const now = currentDateTime()
    return { jy: now.jy, jm: now.jm }
  })
  const [tab, setTab] = useState<DailyKind>('restaurant')
  const [daily, setDaily] = useState<DailyReport | null>(null)
  const [monthly, setMonthly] = useState<MonthlyReport | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [excelError, setExcelError] = useState('')
  const [boot, setBoot] = useState(0)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    const request = period === 'daily'
      ? reportApi.daily(mealDate, meal, controller.signal).then((payload) => {
          if (controller.signal.aborted) return
          setDaily(payload)
          setMonthly(null)
        })
      : reportApi.monthly(month.jy, month.jm, meal, controller.signal).then((payload) => {
          if (controller.signal.aborted) return
          setMonthly(payload)
          setDaily(null)
          setExcelError('')
        })
    void request.then(() => {
      if (controller.signal.aborted) return
      setStatus('ready')
      setMessage('')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setDaily(null)
      setMonthly(null)
      setStatus('error')
      setMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری گزارش انجام نشد.')
    })
    return () => controller.abort()
  }, [period, meal, mealDate, month.jy, month.jm, boot])

  const titleDate = reportDateTitle(mealDate, daily?.jalaliDate ?? null)
  const preparedAt = daily ? formatReportInstant(daily.generatedAt) : ''
  const mealTitle = mealFilterLabel(meal)

  return (
    <div className="space-y-3">
      <div className="print-hide space-y-3">
        <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-3">
          <Segmented
            label="دوره گزارش"
            size="touch"
            value={period}
            onChange={setPeriod}
            options={[
              { id: 'daily', label: 'گزارش روزانه' },
              { id: 'monthly', label: 'گزارش ماهانه' },
            ]}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            {period === 'daily' ? (
              <JalaliDateField label="تاریخ گزارش" value={mealDate} onChange={setMealDate} allowClear={false} />
            ) : (
              <ReportMonthField value={month} onChange={setMonth} />
            )}
            <Segmented
              label="وعده"
              size="touch"
              value={meal}
              onChange={setMeal}
              options={MEAL_OPTIONS}
            />
          </div>
          {period === 'daily' && (
            <Segmented
              label="نوع گزارش روزانه"
              size="touch"
              value={tab}
              onChange={setTab}
              options={[
                { id: 'restaurant', label: 'گزارش کلی رستوران' },
                { id: 'buildings', label: 'گزارش تفصیلی ساختمان‌ها' },
              ]}
            />
          )}
        </div>
      </div>

      {status === 'loading' ? (
        <Empty title="در حال تهیه گزارش" body={period === 'daily' ? 'سفارش‌های این روز از سامانه خوانده می‌شوند.' : 'سفارش‌های این ماه از سامانه تجمیع می‌شوند.'} />
      ) : status === 'error' ? (
        <div>
          <Empty title="گزارش از سامانه خوانده نشد" body={message} />
          <Button className="print-hide mt-2" variant="secondary" onClick={() => setBoot((value) => value + 1)}>تلاش دوباره</Button>
        </div>
      ) : period === 'daily' && daily ? (
        <div className="report-daily space-y-3">
          <section className={tab === 'restaurant' ? 'report-restaurant' : 'report-restaurant hidden'}>
            <DailyToolbar kind="restaurant" label="چاپ گزارش کلی رستوران" visible={tab === 'restaurant'} />
            <article dir="rtl" className="report-sheet space-y-4 rounded-md border border-line bg-surface p-3 sm:p-4">
              <DailyHeading title="گزارش کلی رستوران" dateLabel={titleDate} mealLabel={mealTitle} preparedAt={preparedAt} />
              {showsLunch(daily.meal) && <MealSummaryBlock title="ناهار" meal={daily.lunch} />}
              {showsDinner(daily.meal) && <MealSummaryBlock title="شام" meal={daily.dinner} />}
              {daily.meal === 'ALL' && (
                <p className="text-sm font-medium">مجموع کل ناهار و شام: {fa(daily.lunch.total + daily.dinner.total)} پرس (کاربران {fa(daily.lunch.staffTotal + daily.dinner.staffTotal)}، مهمان‌ها {fa(daily.lunch.guestTotal + daily.dinner.guestTotal)})</p>
              )}
            </article>
          </section>

          <section className={tab === 'buildings' ? 'report-buildings' : 'report-buildings hidden'}>
            <DailyToolbar kind="buildings" label="چاپ گزارش تفصیلی ساختمان‌ها" visible={tab === 'buildings'} />
            <article dir="rtl" className="report-sheet space-y-4 rounded-md border border-line bg-surface p-3 sm:p-4">
              <DailyHeading title="گزارش تفصیلی سفارش‌ها به تفکیک ساختمان" dateLabel={titleDate} mealLabel={mealTitle} preparedAt={preparedAt} />
              {daily.buildings.length === 0 && daily.unassignedGuests.length === 0 ? (
                <Empty title="سفارشی برای این روز نیست" body="هیچ سفارش معتبر کاربر یا مهمانی برای تاریخ و وعده انتخاب‌شده پیدا نشد." />
              ) : (
                <div className="space-y-5">
                  {daily.buildings.map((building) => (
                    <BuildingBlock key={building.buildingId ?? 'unassigned-users'} building={building} meal={daily.meal} />
                  ))}
                  {daily.unassignedGuests.length > 0 && (
                    <section className="building-section space-y-2">
                      <h3 className="building-title text-sm font-semibold">مهمان‌های بدون ساختمان مشخص</h3>
                      <GuestTable rows={daily.unassignedGuests} />
                    </section>
                  )}
                </div>
              )}
            </article>
          </section>
        </div>
      ) : period === 'monthly' && monthly ? (
        <>
          {excelError && <p className="print-hide rounded-md bg-dangerbg px-3 py-2 text-sm text-danger" role="alert">{excelError}</p>}
          <MonthlyReportView
            report={monthly}
            exporting={exporting}
            onPrint={() => printReport('monthly')}
            onExcel={() => {
              setExporting(true)
              setExcelError('')
              void reportApi.downloadMonthlyExcel(month.jy, month.jm, meal).catch((error: unknown) => {
                setExcelError(error instanceof AuthRequestError ? error.message : 'تهیه فایل اکسل انجام نشد.')
              }).finally(() => setExporting(false))
            }}
          />
        </>
      ) : null}
    </div>
  )
}

function ReportMonthField({
  value,
  onChange,
}: {
  value: Pick<JalaliDate, 'jy' | 'jm'>
  onChange: (next: Pick<JalaliDate, 'jy' | 'jm'>) => void
}) {
  return (
    <div className="min-w-[16rem]">
      <p className="text-xs text-muted">ماه گزارش</p>
      <div className="mt-1 flex items-center justify-between gap-2 rounded-md border border-line bg-bg px-2">
        <button type="button" className="min-h-11 rounded-md px-3 text-sm text-link" onClick={() => onChange(addMonths(value, -1))}>ماه قبل</button>
        <p className="min-w-0 truncate text-center text-sm font-semibold text-ink">{JALALI_MONTHS[value.jm - 1]} {fa(value.jy)}</p>
        <button type="button" className="min-h-11 rounded-md px-3 text-sm text-link" onClick={() => onChange(addMonths(value, 1))}>ماه بعد</button>
      </div>
    </div>
  )
}

function DailyToolbar({ kind, label, visible }: { kind: DailyKind; label: string; visible: boolean }) {
  if (!visible) return null
  return (
    <div className="print-hide mb-2 flex justify-end">
      <Button variant="secondary" onClick={() => printReport(kind)}>
        <Printer size={14} aria-hidden /> {label}
      </Button>
    </div>
  )
}

function DailyHeading({ title, dateLabel, mealLabel, preparedAt }: { title: string; dateLabel: string; mealLabel: string; preparedAt: string }) {
  return (
    <header className="report-heading border-b border-line pb-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm">تاریخ گزارش: {dateLabel}</p>
      <p className="text-sm">وعده: {mealLabel}</p>
      {preparedAt ? <p className="text-xs text-muted">زمان تهیه: {preparedAt}</p> : null}
    </header>
  )
}

function MealSummaryBlock({ title, meal }: { title: string; meal: DailyReportMealSummary }) {
  const foods = foodsWithOrders(meal.foods)
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="overflow-x-auto">
        <table className="report-table w-full min-w-[28rem] text-sm">
          <thead>
            <tr>
              {['نام غذا', 'سفارش کاربران', 'سفارش مهمان‌ها', 'مجموع'].map((head) => (
                <th key={head}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {foods.map((food) => (
              <tr key={`${food.menuItemId}-${food.title}`}>
                <td>{food.title}</td>
                <td>{fa(food.staffCount)}</td>
                <td>{fa(food.guestCount)}</td>
                <td className="font-medium">{fa(food.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">مجموع کل {title}</th>
              <td>{fa(meal.staffTotal)}</td>
              <td>{fa(meal.guestTotal)}</td>
              <td className="font-semibold">{fa(meal.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

function BuildingBlock({ building, meal }: { building: DailyReportBuilding; meal: ReportMealFilter }) {
  const lunch = showsLunch(meal)
  const dinner = showsDinner(meal)
  return (
    <section className="building-section space-y-2">
      <h3 className="building-title text-sm font-semibold">{building.buildingName}</h3>
      {building.users.length > 0 && (
        <div className="overflow-x-auto">
          <table className="report-table w-full min-w-[24rem] text-sm">
            <thead>
              <tr>
                {['نام کاربر', ...(lunch ? ['ناهار'] : []), ...(dinner ? ['شام'] : [])].map((head) => (
                  <th key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {building.users.map((user) => (
                <tr key={user.userId}>
                  <td>{user.name}</td>
                  {lunch ? <td>{dishes(user.lunch)}</td> : null}
                  {dinner ? <td>{dishes(user.dinner)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {building.guests.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted">سفارش‌های مهمان</h4>
          <GuestTable rows={building.guests} />
        </div>
      )}
    </section>
  )
}

function GuestTable({ rows }: { rows: DailyReportGuestRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="report-table w-full min-w-[24rem] text-sm">
        <thead>
          <tr>
            {['وعده', 'غذا', 'تعداد', 'توضیح'].map((head) => (
              <th key={head}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{mealLabel(row.mealType)}</td>
              <td>{row.title}</td>
              <td>{fa(row.quantity)}</td>
              <td>{row.note?.trim() || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function reportDateTitle(iso: string, jalaliDate: string | null) {
  const date = jalaliFromIsoDate(iso)
  if (!date) return jalaliDate ? fa(jalaliDate) : iso
  return `${weekdayName(date)} ${fa(date.jd)} ${JALALI_MONTHS[date.jm - 1]} ${fa(date.jy)}`
}

function printReport(kind: DailyKind | 'monthly') {
  const root = document.documentElement
  root.dataset.printReport = kind
  const cleanup = () => {
    delete root.dataset.printReport
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
}
