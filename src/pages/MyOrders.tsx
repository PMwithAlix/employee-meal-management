import { useState } from 'react'
import { Button, Dialog, Empty } from '../components/ui'
import { useApp } from '../store'
import { findOrder, isLocked } from '../lib/orders'
import { fa } from '../lib/text'
import type { Order } from '../types'

export function MyOrdersPage() {
  const app = useApp()
  const id = app.personaId
  const [editing, setEditing] = useState<Order | null>(null)
  if (!id) return <Empty title="سفارش شخصی ندارید" body="نقش ادمین به ساختمان و سفارش شخصی متصل نیست." />

  const days = [...app.days].reverse().filter((day) => day.lunch || day.dinner)
  const past = app.past.filter((item) => item.employeeId === id)

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-line bg-surface">
        <header className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">آبان ۱۴۰۵</h2>
          <p className="text-xs text-muted">سفارش‌های خودتان. ناهار و شام جدا آمده‌اند.</p>
        </header>
        <div className="divide-y divide-line">
          {days.map((day) => {
            const lunch = findOrder(app.orders, id, day.jd, 'lunch')
            const dinner = findOrder(app.orders, id, day.jd, 'dinner')
            return (
              <div key={day.jd} className="grid gap-3 px-4 py-3 md:grid-cols-[8rem_1fr_1fr]">
                <div>
                  <p className="text-sm font-medium">{fa(day.jd)} آبان</p>
                  <p className="text-xs text-muted">{day.weekday}</p>
                  <p className="text-xs text-muted">{isLocked(day.jd, app.today) ? 'مهلت تمام' : 'قابل ویرایش'}</p>
                </div>
                <OrderLine label="ناهار" name={day.lunch ? lunch?.choice ?? null : undefined} missing={!day.lunch} rating={lunch} onRate={() => lunch && setEditing(lunch)} locked={day.jd < app.today} />
                <OrderLine label="شام" name={day.dinner ? dinner?.choice ?? null : undefined} missing={!day.dinner} rating={dinner} onRate={() => dinner && setEditing(dinner)} locked={day.jd < app.today} />
              </div>
            )
          })}
        </div>
      </section>
      <section className="rounded-md border border-line bg-surface">
        <header className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">مهر ۱۴۰۵</h2>
        </header>
        {past.length === 0 ? (
          <div className="p-4"><Empty title="سفارش مهر برای این حساب نیست" body="سفارش‌های آبان در بخش بالا قرار دارند." /></div>
        ) : (
          <ul className="divide-y divide-line">
            {past.map((item) => (
              <li key={`${item.date}-${item.meal}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>{item.date} · {item.weekday} · {item.meal === 'lunch' ? 'ناهار' : 'شام'}</span>
                <span>{item.choice}</span>
                <span className="text-xs text-muted">{item.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {editing && <RatingDialog order={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function OrderLine({
  label,
  name,
  missing,
  rating,
  onRate,
  locked,
}: {
  label: string
  name: string | null | undefined
  missing: boolean
  rating?: Order
  onRate: () => void
  locked: boolean
}) {
  return (
    <div className={label === 'ناهار' ? 'rounded-md border border-lunchline bg-lunchbg px-3 py-2' : 'rounded-md border border-dinnerline bg-dinnerbg px-3 py-2'}>
      <p className={label === 'ناهار' ? 'text-xs text-lunch' : 'text-xs text-dinner'}>{label}</p>
      <p className="text-sm">{missing ? 'منو تعریف نشده' : name ?? 'انتخاب نشده'}</p>
      {locked && name && rating && (
        <button className="mt-1 text-xs text-link" onClick={onRate}>
          {rating.rating ? `دیدگاه: ${fa(rating.rating.score)} از ۵` : 'ثبت دیدگاه'}
        </button>
      )}
    </div>
  )
}

function RatingDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const app = useApp()
  const [score, setScore] = useState(order.rating?.score ?? 0)
  const [comment, setComment] = useState(order.rating?.comment ?? '')
  const [saving, setSaving] = useState(false)
  return (
    <Dialog open title={`دیدگاه ${order.meal === 'lunch' ? 'ناهار' : 'شام'} ${fa(order.jd)} آبان`} onClose={onClose} locked={saving}>
      <p className="text-sm text-muted">امتیاز ۱ تا ۵. توضیح اختیاری است و فقط پشتیبان، مدیریت و ادمین آن را می‌بینند.</p>
      <div className="mt-3 flex gap-1" role="radiogroup" aria-label="امتیاز">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} type="button" aria-checked={score === value} onClick={() => setScore(value)} className={`h-9 w-9 rounded-md border text-sm ${score >= value ? 'border-primary bg-primary text-onprimary' : 'border-line'}`}>
            {fa(value)}
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="توضیح، اگر لازم است" className="mt-3 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm" />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>انصراف</Button>
        <Button
          disabled={!score || saving}
          onClick={() => {
            setSaving(true)
            window.setTimeout(() => {
              app.rateMeal(order.id, score, comment)
              setSaving(false)
              onClose()
            }, 500)
          }}
        >
          {saving ? 'در حال ذخیره' : order.rating ? 'ویرایش دیدگاه' : 'ثبت دیدگاه'}
        </Button>
      </div>
    </Dialog>
  )
}
