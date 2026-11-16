import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { Button, Empty, Segmented } from '../shared/ui/primitives'
import { JalaliDateField } from '../shared/ui/JalaliDateField'
import { AuthRequestError } from '../features/auth/lib/auth-errors'
import { reportApi } from '../features/reports/api/reports-api'
import { dishes, formatReportInstant, mealLabel, todayIsoDate } from '../features/reports/lib/report-mapper'
import type { DailyReport, DailyReportBuilding, DailyReportGuestRow, DailyReportMealSummary } from '../features/reports/model/report-types'
import { jalaliFromIsoDate } from '../shared/lib/jalali-picker'
import { JALALI_MONTHS, weekdayName } from '../shared/lib/jalali'
import { fa } from '../shared/lib/persian-text'

type ReportKind = 'restaurant' | 'buildings'

export function ReportsPage() {
  const [mealDate, setMealDate] = useState(todayIsoDate)
  const [tab, setTab] = useState<ReportKind>('restaurant')
  const [report, setReport] = useState<DailyReport | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [boot, setBoot] = useState(0)

  useEffect(() => {
    if (!mealDate) return
    const controller = new AbortController()
    setStatus('loading')
    void reportApi.daily(mealDate, controller.signal).then((payload) => {
      if (controller.signal.aborted) return
      setReport(payload)
      setStatus('ready')
      setMessage('')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setReport(null)
      setStatus('error')
      setMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری گزارش انجام نشد.')
    })
    return () => controller.abort()
  }, [mealDate, boot])

  const titleDate = reportDateTitle(mealDate, report?.jalaliDate ?? null)
  const preparedAt = report ? formatReportInstant(report.generatedAt) : ''

  return (
    <div className="space-y-3">
      <div className="print-hide space-y-3">
        <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-3 sm:flex-row sm:items-end sm:justify-between">
          <JalaliDateField label="تاریخ گزارش" value={mealDate} onChange={setMealDate} allowClear={false} />
          <Segmented
            label="نوع گزارش"
            size="touch"
            value={tab}
            onChange={setTab}
            options={[
              { id: 'restaurant', label: 'گزارش کلی رستوران' },
              { id: 'buildings', label: 'گزارش تفصیلی ساختمان‌ها' },
            ]}
          />
        </div>
      </div>

      {status === 'loading' ? (
        <Empty title="در حال تهیه گزارش" body="سفارش‌های این روز از سامانه خوانده می‌شوند." />
      ) : status === 'error' ? (
        <div>
          <Empty title="گزارش از سامانه خوانده نشد" body={message} />
          <Button className="print-hide mt-2" variant="secondary" onClick={() => setBoot((value) => value + 1)}>تلاش دوباره</Button>
        </div>
      ) : report ? (
        <>
          <section className={tab === 'restaurant' ? 'report-restaurant' : 'report-restaurant hidden'}>
            <ReportToolbar
              kind="restaurant"
              label="چاپ گزارش کلی رستوران"
              visible={tab === 'restaurant'}
            />
            <article dir="rtl" className="report-sheet space-y-4 rounded-md border border-line bg-surface p-3 sm:p-4">
              <ReportHeading
                title="گزارش کلی رستوران"
                dateLabel={titleDate}
                preparedAt={preparedAt}
              />
              <MealSummaryBlock title="ناهار" meal={report.lunch} />
              <MealSummaryBlock title="شام" meal={report.dinner} />
            </article>
          </section>

          <section className={tab === 'buildings' ? 'report-buildings' : 'report-buildings hidden'}>
            <ReportToolbar
              kind="buildings"
              label="چاپ گزارش تفصیلی ساختمان‌ها"
              visible={tab === 'buildings'}
            />
            <article dir="rtl" className="report-sheet space-y-4 rounded-md border border-line bg-surface p-3 sm:p-4">
              <ReportHeading
                title="گزارش تفصیلی سفارش‌ها به تفکیک ساختمان"
                dateLabel={titleDate}
                preparedAt={preparedAt}
              />
              {report.buildings.length === 0 && report.unassignedGuests.length === 0 ? (
                <Empty title="سفارشی برای این روز نیست" body="هیچ سفارش معتبر کاربر یا مهمانی برای تاریخ انتخاب‌شده پیدا نشد." />
              ) : (
                <div className="space-y-5">
                  {report.buildings.map((building) => (
                    <BuildingBlock key={building.buildingId ?? 'unassigned-users'} building={building} />
                  ))}
                  {report.unassignedGuests.length > 0 && (
                    <section className="building-section space-y-2">
                      <h3 className="building-title text-sm font-semibold">مهمان‌های بدون ساختمان مشخص</h3>
                      <GuestTable rows={report.unassignedGuests} />
                    </section>
                  )}
                </div>
              )}
            </article>
          </section>
        </>
      ) : null}
    </div>
  )
}

function ReportToolbar({ kind, label, visible }: { kind: ReportKind; label: string; visible: boolean }) {
  if (!visible) return null
  return (
    <div className="print-hide mb-2 flex justify-end">
      <Button variant="secondary" onClick={() => printReport(kind)}>
        <Printer size={14} /> {label}
      </Button>
    </div>
  )
}

function ReportHeading({ title, dateLabel, preparedAt }: { title: string; dateLabel: string; preparedAt: string }) {
  return (
    <header className="report-heading border-b border-line pb-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm">تاریخ گزارش: {dateLabel}</p>
      {preparedAt ? <p className="text-xs text-muted">زمان تهیه: {preparedAt}</p> : null}
    </header>
  )
}

function MealSummaryBlock({ title, meal }: { title: string; meal: DailyReportMealSummary }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {meal.foods.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-3 text-sm text-muted">برای این وعده غذایی در منو نیست و سفارشی هم ثبت نشده است.</p>
      ) : (
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
              {meal.foods.map((food) => (
                <tr key={`${food.menuItemId ?? 'extra'}-${food.title}`}>
                  <td>
                    {food.title}
                    {!food.onMenu ? <span className="ms-1 text-xs text-muted">· خارج از منوی جاری</span> : null}
                  </td>
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
      )}
    </section>
  )
}

function BuildingBlock({ building }: { building: DailyReportBuilding }) {
  return (
    <section className="building-section space-y-2">
      <h3 className="building-title text-sm font-semibold">{building.buildingName}</h3>
      {building.users.length > 0 && (
        <div className="overflow-x-auto">
          <table className="report-table w-full min-w-[24rem] text-sm">
            <thead>
              <tr>
                {['نام کاربر', 'ناهار', 'شام'].map((head) => (
                  <th key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {building.users.map((user) => (
                <tr key={user.userId}>
                  <td>{user.name}</td>
                  <td>{dishes(user.lunch)}</td>
                  <td>{dishes(user.dinner)}</td>
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

function printReport(kind: ReportKind) {
  const root = document.documentElement
  root.dataset.printReport = kind
  const cleanup = () => {
    delete root.dataset.printReport
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
}
