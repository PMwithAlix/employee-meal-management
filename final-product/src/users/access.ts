import type { Role } from '../types'

export function usesLiveEmployeesPage(role: Role) {
  return role === 'admin' || role === 'hr'
}

export const ADMIN_DIRECTORY_ROLES = ['EMPLOYEE', 'HR', 'SUPPORT', 'MANAGEMENT', 'ADMIN'] as const

export type DirectoryRole = (typeof ADMIN_DIRECTORY_ROLES)[number]

export function isDirectoryRole(value: string): value is DirectoryRole {
  return (ADMIN_DIRECTORY_ROLES as readonly string[]).includes(value)
}
