import type { Role } from '../types'

export function usesLiveGroupsPage(role: Role) {
  return role === 'admin' || role === 'hr'
}
