import type { Role } from '../../../shared/types/domain'

export function usesLiveBuildingsPage(role: Role) {
  return role === 'admin' || role === 'hr'
}
