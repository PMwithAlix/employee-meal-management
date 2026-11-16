import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthRequestError } from '../../auth/lib/auth-errors'
import { menuApi } from '../api/menus-api'
import { daysFromVersion, toPickerDay } from '../lib/menu-mapper'
import type { MenuDay, PublishedMenu } from '../model/menu-types'
import type { DayMenu } from '../../../shared/types/domain'

export type PublishedLoadState = 'loading' | 'ready' | 'empty' | 'unavailable' | 'forbidden' | 'error'

export function usePublishedMenu(year: number, month: number) {
  const [status, setStatus] = useState<PublishedLoadState>('loading')
  const [message, setMessage] = useState('')
  const [menu, setMenu] = useState<PublishedMenu | null>(null)
  const [days, setDays] = useState<MenuDay[]>([])
  const [boot, setBoot] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setMessage('')
    setMenu(null)
    setDays([])
    void menuApi
      .getPublished(year, month, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return
        if (!payload || payload.jalaliYear !== year || payload.jalaliMonth !== month) {
          if (!payload) {
            setStatus('error')
            setMessage('پاسخ منوی این ماه نامعتبر است.')
            return
          }
          return
        }
        setMenu(payload)
        setDays(daysFromVersion(year, month, payload.version))
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof AuthRequestError && error.status === 404) {
          setMenu(null)
          setDays([])
          setStatus('empty')
          setMessage(error.message)
          return
        }
        if (error instanceof AuthRequestError && error.kind === 'network') {
          setStatus('unavailable')
          setMessage(error.message)
          return
        }
        if (error instanceof AuthRequestError && (error.status === 403 || error.kind === 'forbidden')) {
          setStatus('forbidden')
          setMessage(error.message)
          return
        }
        setStatus('error')
        setMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری منو انجام نشد.')
      })
    return () => controller.abort()
  }, [year, month, boot])

  const retry = useCallback(() => setBoot((value) => value + 1), [])

  const pickerDays = useMemo((): DayMenu[] => days.map(toPickerDay), [days])

  return { status, message, menu, days, pickerDays, monthStamp: `${year}-${month}`, retry }
}
