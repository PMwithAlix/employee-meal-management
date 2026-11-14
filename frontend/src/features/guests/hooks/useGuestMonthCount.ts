import { useEffect, useState } from 'react'
import { AuthRequestError } from '../../auth/lib/auth-errors'
import { can } from '../../../shared/config/permissions'
import { useApp } from '../../../app/providers/app-store'
import { countActiveGuestOrdersInMonth } from '../lib/guest-month-count'

export function useGuestMonthCount() {
  const app = useApp()
  const allowed = can(app.role, 'guest.edit')
  const year = app.selectedMonth.jy
  const month = app.selectedMonth.jm
  const [boot, setBoot] = useState(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable' | 'error' | 'forbidden'>(allowed ? 'loading' : 'idle')
  const [message, setMessage] = useState('')
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!allowed) {
      setCount(null)
      setStatus('idle')
      setMessage('')
      return
    }
    const controller = new AbortController()
    setStatus('loading')
    setMessage('')
    setCount(null)
    void countActiveGuestOrdersInMonth(year, month, controller.signal).then((value) => {
      if (controller.signal.aborted) return
      setCount(value)
      setStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setCount(null)
      if (error instanceof AuthRequestError && (error.kind === 'forbidden' || error.status === 403)) {
        setStatus('forbidden')
        setMessage(error.message)
        return
      }
      if (error instanceof AuthRequestError && error.kind === 'network') {
        setStatus('unavailable')
        setMessage(error.message)
        return
      }
      setStatus('error')
      setMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری شمارش سفارش مهمان انجام نشد.')
    })
    return () => controller.abort()
  }, [allowed, year, month, boot])

  return { allowed, status, message, count, retry: () => setBoot((value) => value + 1) }
}
