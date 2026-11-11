import { useState } from 'react'
import { Empty } from '../components/ui'
import { useApp } from '../store'

export function ActivityPage() {
  const app = useApp()
  const [q, setQ] = useState('')
  const rows = app.activity.filter((item) => {
    const blob = `${item.actor} ${item.action} ${item.target} ${item.before} ${item.after}`
    return !q.trim() || blob.includes(q.trim())
  })
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">سابقه عملیات فقط خواندنی است. این فهرست اعلان نیست.</p>
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="جستجو در کاربر، عملیات یا مقدار" className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm" />
      {rows.length === 0 ? <Empty title="رویدادی پیدا نشد" body="عبارت جستجو را تغییر دهید." /> : (
        <>
          <div className="hidden overflow-auto rounded-md border border-line bg-surface md:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface2 text-xs text-muted">
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
                    <td className="px-3 py-2">{item.target}</td>
                    <td className="px-3 py-2">{item.before}</td>
                    <td className="px-3 py-2">{item.after}</td>
                    <td className="px-3 py-2">{item.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {rows.map((item) => (
              <article key={item.id} className="rounded-md border border-line bg-surface p-3 text-sm">
                <p className="font-medium">{item.action}</p>
                <p className="text-xs text-muted">{item.at} · {item.actor}</p>
                <p className="mt-2">{item.target}</p>
                <p className="text-xs text-muted">قبلی: {item.before}</p>
                <p className="text-xs text-muted">جدید: {item.after}</p>
                <p className="text-xs">نتیجه: {item.result}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
