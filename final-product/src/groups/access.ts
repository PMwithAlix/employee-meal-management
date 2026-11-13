import type { Role } from '../types'

export function usesLiveGroupsPage(role: Role) {
  return role === 'admin' || role === 'hr'
}

export function isEligibleGroupCandidate(user: { role: string; isActive: boolean }) {
  return user.role === 'EMPLOYEE' && user.isActive
}
