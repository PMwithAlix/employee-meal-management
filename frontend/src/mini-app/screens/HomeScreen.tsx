import { useEffect, useState } from 'react'
import { AuthRequestError } from '../../features/auth/lib/auth-errors'
import { notificationApi, type NotificationItem } from '../../features/notifications/api/notifications-api'
import { ROLE_LABEL } from '../../shared/fixtures/seed-data'
import { currentDateTime, monthTitle } from '../../shared/lib/jalali'
import { fa } from '../../shared/lib/persian-text'
import { useMiniAuth } from '../auth/MiniAuth'
import { canUse, type MiniTab } from '../nav/routes'
import { KmButton, KmScreen, KmSkeleton, KmState } from '../ui/primitives'

export function HomeScreen({ onOpen }: { onOpen: (tab: MiniTab) => void }) {
  const { user } = useMiniAuth()
  const today = currentDateTime()
  const [notes, setNotes] = useState<NotificationItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void notificationApi
      .list({ page: 1, pageSize: 5 }, controller.signal)
      .then((payload) => {
        setNotes(payload.items)
        setError('')
      })
      .catch((caught: unknown) => {
        setError(caught instanceof AuthRequestError ? caught.message : 'اعلان‌ها بارگذاری نشد.')
      })
    return () => controller.abort()
  }, [])

  if (!user) return null

  return (
    <KmScreen title={`سلام ${user.username}`} subtitle={`${ROLE_LABEL[user.role]} · ${monthTitle(today)} ${fa(today.jd)}`}>
      <div className="km-card">
        <h2>کار امروز</h2>
        <p>
          {canUse(user.role, 'order.self')
            ? 'منوی جاری را ببینید و سفارش را قبل از مهلت ثبت کنید.'
            : 'عملیات حساس در پنل وب می‌ماند. اینجا وضعیت و گزارش‌های مجاز شماست.'}
        </p>
        <div className="km-actions" style={{ marginTop: 12 }}>
          {canUse(user.role, 'order.self') ? <KmButton onClick={() => onOpen('menu')}>رفتن به منو</KmButton> : null}
          {canUse(user.role, 'order.ops') ? <KmButton variant="ghost" onClick={() => onOpen('org-orders')}>پیگیری سفارش‌ها</KmButton> : null}
        </div>
      </div>
      <div className="km-card">
        <h2>اعلان‌ها</h2>
        {!notes && !error ? <KmSkeleton /> : null}
        {error ? <KmState title="اعلان‌ها در دسترس نیست" body={error} /> : null}
        {notes && notes.length === 0 ? <p>اعلان جدیدی نیست.</p> : null}
        {notes?.map((item) => (
          <p key={item.id}>
            <strong>{item.title}</strong>
            <br />
            {item.body}
          </p>
        ))}
      </div>
    </KmScreen>
  )
}
