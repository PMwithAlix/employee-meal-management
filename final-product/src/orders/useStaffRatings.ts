import { useEffect, useState } from 'react'
import { AuthRequestError } from '../auth/errors'
import { canAccess } from '../permissions'
import { useApp } from '../store'
import { orderApi } from './client'
import type { BackendStaffRating } from './types'

export function useStaffRatings() {
  const app = useApp()
  const allowed = canAccess(app.role, 'reports')
  const [boot, setBoot] = useState(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable' | 'error' | 'forbidden'>(allowed ? 'loading' : 'idle')
  const [message, setMessage] = useState('')
  const [items, setItems] = useState<BackendStaffRating[]>([])

  useEffect(() => {
    if (!allowed) {
      setItems([])
      setStatus('idle')
      setMessage('')
      return
    }
    const controller = new AbortController()
    setStatus('loading')
    setMessage('')
    void orderApi.listAllRatings({}, controller.signal).then((listed) => {
      if (controller.signal.aborted) return
      setItems(listed.items)
      setStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setItems([])
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
      setMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری دیدگاه‌ها انجام نشد.')
    })
    return () => controller.abort()
  }, [allowed, boot, app.selfId])

  return { allowed, status, message, items, retry: () => setBoot((value) => value + 1) }
}
