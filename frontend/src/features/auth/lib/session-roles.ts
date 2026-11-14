import type { Role } from '../../../shared/types/domain'

export const BACKEND_ROLES = [
  'EMPLOYEE',
  'HR',
  'SUPPORT',
  'MANAGEMENT',
  'ADMIN',
] as const

export type BackendRole = (typeof BACKEND_ROLES)[number]

const ROLE_MAP: Record<BackendRole, Role> = {
  EMPLOYEE: 'employee',
  HR: 'hr',
  SUPPORT: 'support',
  MANAGEMENT: 'management',
  ADMIN: 'admin',
}

export type SessionUser = {
  id: string
  username: string
  role: Role
  backendRole: BackendRole
  buildingId: string | null
  expiresAt: string
}

export function isBackendRole(value: unknown): value is BackendRole {
  return typeof value === 'string' && (BACKEND_ROLES as readonly string[]).includes(value)
}

export function mapBackendRole(value: unknown): Role | null {
  if (!isBackendRole(value)) return null
  return ROLE_MAP[value]
}

export function parseSessionUser(payload: unknown): SessionUser | 'invalid-role' | null {
  if (!payload || typeof payload !== 'object') return null
  const body = payload as Record<string, unknown>
  if (typeof body.id !== 'string' || typeof body.username !== 'string') return null
  if (typeof body.expiresAt !== 'string') return null
  if (body.buildingId !== null && typeof body.buildingId !== 'string') return null
  const role = mapBackendRole(body.role)
  if (!role || !isBackendRole(body.role)) return 'invalid-role'
  return {
    id: body.id,
    username: body.username,
    role,
    backendRole: body.role,
    buildingId: body.buildingId,
    expiresAt: body.expiresAt,
  }
}
