import { FileSpreadsheet, Printer } from 'lucide-react'
import { Button, Empty } from '../../../shared/ui/primitives'
import { fa } from '../../../shared/lib/persian-text'
import { formatReportInstant, showsDinner, showsLunch } from '../lib/report-mapper'
import type { MonthlyCountRow, MonthlyFoodRow, MonthlyReport } from '../model/report-types'

export function MonthlyReportView({
  report,
  exporting,
  onPrint,
  onExcel,
}: {
  report: MonthlyReport
  exporting: boolean
  onPrint: () => void
  onExcel: () => void
}) {
  const lunch = showsLunch(report.meal)
  const dinner = showsDinner(report.meal)
  const preparedAt = formatReportInstant(report.generatedAt)
  return (
    <section className="report-monthly">
      <div className="print-hide mb-2 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onPrint}>
          <Printer size={14} aria-hidden /> چاپ گزارش ماهانه
        </Button>
        <Button variant="secondary" onClick={onExcel} disabled={exporting}>
          <FileSpreadsheet size={14} aria-hidden /> {exporting ? 'در حال تهیه اکسل' : 'خروجی Excel'}
        </Button>
      </div>
      <article dir="rtl" className="report-sheet space-y-5 rounded-md border border-line bg-surface p-3 sm:p-4">
        <header className="report-heading border-b border-line pb-3">
          <h2 className="text-base font-semibold">گزارش ماهانه رستوران</h2>
          <p className="mt-1 text-sm">ماه گزارش: {report.monthLabel}</p>
          <p className="text-sm">وعده: {report.mealLabel}</p>
          {preparedAt ? <p className="text-xs text-muted">زمان تهیه: {preparedAt}</p> : null}
        </header>

        <MonthlyFoodTable
          title="تعداد کل غذاها در ماه"
          foods={report.foods}
          total={report.foodsTotal}
          lunch={lunch}
          dinner={dinner}
        />

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">تعداد غذا به تفکیک ساختمان</h3>
          {report.buildingRows.length === 0 ? (
            <Empty title="سفارش معتبری در این ماه نیست" body="هیچ سفارش فعال کاربر یا مهمانی برای ماه انتخاب‌شده پیدا نشد." />
          ) : (
            <CountTable
              columns={[
                'ساختمان',
                'نوع غذا',
                ...(lunch ? ['تعداد ناهار'] : []),
                ...(dinner ? ['تعداد شام'] : []),
                'مجموع',
              ]}
              rows={report.buildingRows.map((row) => [
                row.buildingName,
                row.title,
                ...(lunch ? [fa(row.lunchCount)] : []),
                ...(dinner ? [fa(row.dinnerCount)] : []),
                fa(row.total),
              ])}
            />
          )}
        </section>

        {report.buildingTotals.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">مجموع نیاز هر ساختمان</h3>
            <CountTable
              columns={[
                'ساختمان',
                ...(lunch ? ['مجموع ناهار'] : []),
                ...(dinner ? ['مجموع شام'] : []),
                'کل موردنیاز',
              ]}
              rows={report.buildingTotals.map((row) => [
                row.buildingName,
                ...(lunch ? [fa(row.lunchCount)] : []),
                ...(dinner ? [fa(row.dinnerCount)] : []),
                fa(row.total),
              ])}
              footer={[
                'مجموع ساختمان‌ها',
                ...(lunch ? [fa(report.foodsTotal.lunchCount)] : []),
                ...(dinner ? [fa(report.foodsTotal.dinnerCount)] : []),
                fa(report.foodsTotal.total),
              ]}
            />
          </section>
        )}

        <MonthlyFoodTable
          title="جمع‌بندی تأمین غذا"
          foods={report.supply}
          total={report.supplyTotal}
          lunch={lunch}
          dinner={dinner}
          nameHeader="نوع غذا"
        />

        {!report.reconciliation.matched && (
          <p className="rounded-md bg-warnbg px-3 py-2 text-sm text-warn" role="alert">
            مجموع گزارش ساختمان‌ها با گزارش کلی رستوران برابر نیست. اختلاف: {fa(report.reconciliation.difference)} پرس.
          </p>
        )}
      </article>
    </section>
  )
}

function MonthlyFoodTable({
  title,
  foods,
  total,
  lunch,
  dinner,
  nameHeader = 'نام غذا',
}: {
  title: string
  foods: MonthlyFoodRow[]
  total: MonthlyCountRow
  lunch: boolean
  dinner: boolean
  nameHeader?: string
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <CountTable
        columns={[
          nameHeader,
          ...(lunch ? ['تعداد ناهار'] : []),
          ...(dinner ? ['تعداد شام'] : []),
          'مجموع',
        ]}
        rows={foods.map((food) => [
          food.title,
          ...(lunch ? [fa(food.lunchCount)] : []),
          ...(dinner ? [fa(food.dinnerCount)] : []),
          fa(food.total),
        ])}
        footer={[
          'مجموع',
          ...(lunch ? [fa(total.lunchCount)] : []),
          ...(dinner ? [fa(total.dinnerCount)] : []),
          fa(total.total),
        ]}
      />
    </section>
  )
}

function CountTable({
  columns,
  rows,
  footer,
}: {
  columns: string[]
  rows: string[][]
  footer?: string[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="report-table w-full min-w-[28rem] text-sm">
        <thead>
          <tr>
            {columns.map((head) => (
              <th key={head}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>سفارش معتبری برای این جدول نیست.</td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={`${row[0]}-${row[1] ?? ''}-${index}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${cellIndex}-${cell}`} className={cellIndex === row.length - 1 ? 'font-medium' : undefined}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer && (
          <tfoot>
            <tr>
              {footer.map((cell, index) => (
                index === 0
                  ? <th key={cell} scope="row">{cell}</th>
                  : <td key={`${cell}-${index}`} className="font-semibold">{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
