import { useState } from 'react'
import { Empty } from '../components/ui'
import { useApp } from '../store'

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function ActivityPage() {
  const app = useApp()
  const [q, setQ] = useState('')
  const rows = app.activity.filter((item) => {
    const blob = normalize(`${item.actor} ${item.action} ${item.target} ${item.before} ${item.after}`)
    const query = normalize(q)
    return !query || blob.includes(query)
  })
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">سابقه عملیات فقط خواندنی است. این فهرست اعلان نیست.</p>
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="جستجو در کاربر، عملیات، موضوع یا مقدار" aria-label="جستجوی تاریخچه" className="h-11 w-full rounded-md border border-line bg-surface px-3 text-base" />
      {rows.length === 0 ? <Empty title={q.trim() ? 'نتیجه‌ای برای این جستجو نیست' : 'رویدادی ثبت نشده'} body={q.trim() ? 'عبارت را کوتاه‌تر کنید یا فاصله‌های اضافه را بردارید.' : 'عملیات موفق اینجا دیده می‌شود. جابه‌جایی بین صفحه‌ها ثبت نمی‌شود.'} /> : (
        <>
          <div className="hidden overflow-hidden rounded-md border border-line bg-surface lg:block">
            <table className="w-full text-sm">
              <thead className="bg-elevated text-xs text-muted">
                <tr>
                  {['زمان', 'کاربر', 'عملیات', 'موضوع', 'مقدار قبلی', 'مقدار جدید', 'نتیجه'].map((head) => <th key={head} className="px-3 py-2 text-start font-medium">{head}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} className="border-t border-line align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{item.at}</td>
                    <td className="px-3 py-2">{item.actor}</td>
                    <td className="px-3 py-2">{item.action}</td>
                    <td className="px-3 py-2 break-words">{item.target}</td>
                    <td className="px-3 py-2 break-words">{item.before}</td>
                    <td className="px-3 py-2 break-words">{item.after}</td>
                    <td className="px-3 py-2">{item.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 lg:hidden">
            {rows.map((item) => (
              <article key={item.id} className="rounded-md border border-line bg-surface p-3 text-sm">
                <p className="font-medium">{item.action}</p>
                <p className="text-xs text-muted">{item.at} · {item.actor}</p>
                <p className="mt-2 break-words">{item.target}</p>
                <p className="break-words text-xs text-muted">قبلی: {item.before}</p>
                <p className="break-words text-xs text-muted">جدید: {item.after}</p>
                <p className="text-xs">نتیجه: {item.result}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
