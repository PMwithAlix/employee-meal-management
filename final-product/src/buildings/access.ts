import type { Role } from '../types'

export function usesLiveBuildingsPage(role: Role) {
  return role === 'admin' || role === 'hr'
}
