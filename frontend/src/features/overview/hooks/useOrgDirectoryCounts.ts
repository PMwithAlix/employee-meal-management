import { useEffect, useState } from 'react'
import { AuthRequestError } from '../../auth/lib/auth-errors'
import { buildingApi } from '../../buildings/api/buildings-api'
import { groupApi } from '../../groups/api/groups-api'
import { userApi } from '../../users/api/users-api'

export function useOrgDirectoryCounts() {
  const [boot, setBoot] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [users, setUsers] = useState<number | null>(null)
  const [activeEmployees, setActiveEmployees] = useState<number | null>(null)
  const [buildings, setBuildings] = useState<number | null>(null)
  const [groups, setGroups] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setMessage('')
    setUsers(null)
    setActiveEmployees(null)
    setBuildings(null)
    setGroups(null)
    void Promise.all([
      userApi.list({ page: 1, pageSize: 1 }, controller.signal),
      userApi.list({ page: 1, pageSize: 1, role: 'EMPLOYEE', isActive: true }, controller.signal),
      buildingApi.list(controller.signal),
      groupApi.list(controller.signal),
    ]).then(([listedUsers, listedEmployees, listedBuildings, listedGroups]) => {
      if (controller.signal.aborted) return
      if (!Number.isInteger(listedUsers.total) || !Number.isInteger(listedEmployees.total)) {
        setStatus('error')
        setMessage('بارگذاری شمارش سازمانی کامل نشد.')
        return
      }
      setUsers(listedUsers.total)
      setActiveEmployees(listedEmployees.total)
      setBuildings(listedBuildings.length)
      setGroups(listedGroups.length)
      setStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setStatus('error')
      setMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری شمارش سازمانی انجام نشد.')
    })
    return () => controller.abort()
  }, [boot])

  return { status, message, users, activeEmployees, buildings, groups, retry: () => setBoot((value) => value + 1) }
}
