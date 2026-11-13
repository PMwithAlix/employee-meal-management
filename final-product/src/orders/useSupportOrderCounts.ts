import { useEffect, useState } from 'react'
import { AuthRequestError } from '../auth/errors'
import { jalaliMonthLength } from '../lib/jalali'
import { formatGregorianDate } from '../menus/map'
import { useApp } from '../store'
import { orderApi } from './client'

export function useSupportOrderCounts() {
  const app = useApp()
  const year = app.selectedMonth.jy
  const month = app.selectedMonth.jm
  const [boot, setBoot] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [lunch, setLunch] = useState<number | null>(null)
  const [dinner, setDinner] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const from = formatGregorianDate(year, month, 1)
    const to = formatGregorianDate(year, month, jalaliMonthLength(year, month))
    setStatus('loading')
    setLunch(null)
    setDinner(null)
    setMessage('')
    void Promise.all([
      orderApi.countManaged({ from, to, mealType: 'LUNCH', status: 'ACTIVE' }, controller.signal),
      orderApi.countManaged({ from, to, mealType: 'DINNER', status: 'ACTIVE' }, controller.signal),
    ]).then(([lunchCount, dinnerCount]) => {
      if (controller.signal.aborted) return
      setLunch(lunchCount)
      setDinner(dinnerCount)
      setStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setLunch(null)
      setDinner(null)
      setStatus('error')
      setMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری شمارش سفارش انجام نشد.')
    })
    return () => controller.abort()
  }, [year, month, boot])

  return { status, message, lunch, dinner, retry: () => setBoot((value) => value + 1) }
}
