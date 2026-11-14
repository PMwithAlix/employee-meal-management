import { useEffect, useState } from 'react'
import { AuthRequestError } from '../../auth/lib/auth-errors'
import { canAccess } from '../../../shared/config/permissions'
import { useApp } from '../../../app/providers/app-store'
import { auditApi, type AuditLogItem } from '../api/audit-api'

export function useRecentAudit(pageSize = 5) {
  const app = useApp()
  const allowed = canAccess(app.role, 'activity')
  const [boot, setBoot] = useState(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [items, setItems] = useState<AuditLogItem[]>([])

  useEffect(() => {
    if (!allowed) {
      setItems([])
      setStatus('idle')
      return
    }
    const controller = new AbortController()
    setStatus('loading')
    void auditApi.list({ page: 1, pageSize }, controller.signal).then((listed) => {
      if (controller.signal.aborted) return
      if (!Number.isInteger(listed.total) || listed.page !== 1 || listed.pageSize !== pageSize) {
        setItems([])
        setStatus('error')
        setMessage('بارگذاری تاریخچه فعالیت کامل نشد.')
        return
      }
      setItems(listed.items)
      setStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setItems([])
      setStatus('error')
      setMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری تاریخچه انجام نشد.')
    })
    return () => controller.abort()
  }, [allowed, boot, pageSize])

  return { allowed, status, message, items, retry: () => setBoot((value) => value + 1) }
}
