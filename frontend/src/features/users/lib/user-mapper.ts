export const HR_MANAGED_ROLES = ['EMPLOYEE', 'SUPPORT', 'MANAGEMENT'] as const

export type HrManagedRole = (typeof HR_MANAGED_ROLES)[number]

export interface ManagedUser {
  id: string
  username: string
  role: string
  buildingId: string | null
  buildingName: string | null
  isActive: boolean
  createdAt: string
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export function parseManagedUser(value: unknown): ManagedUser | null {
  const body = asRecord(value)
  if (!body || typeof body.id !== 'string' || typeof body.username !== 'string') return null
  if (typeof body.role !== 'string' || typeof body.isActive !== 'boolean') return null
  if (typeof body.createdAt !== 'string' || !body.createdAt) return null
  const building = asRecord(body.building)
  const buildingId = typeof body.buildingId === 'string' ? body.buildingId : typeof building?.id === 'string' ? building.id : null
  const buildingName = typeof building?.name === 'string' ? building.name : null
  return {
    id: body.id,
    username: body.username,
    role: body.role,
    buildingId,
    buildingName,
    isActive: body.isActive,
    createdAt: body.createdAt,
  }
}

export function parseResetPasswordResult(value: unknown) {
  const body = asRecord(value)
  return body?.ok === true
}

export function roleLabel(role: string) {
  if (role === 'EMPLOYEE') return 'کارمند'
  if (role === 'SUPPORT') return 'پشتیبانی'
  if (role === 'MANAGEMENT') return 'مدیریت'
  if (role === 'HR') return 'منابع انسانی'
  if (role === 'ADMIN') return 'ادمین'
  return role
}

export function formatUserCreatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeZone: 'Asia/Tehran' }).format(date)
}

export function isHrManagedRole(role: string): role is HrManagedRole {
  return (HR_MANAGED_ROLES as readonly string[]).includes(role)
}
