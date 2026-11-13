import type { Role } from '../types'

export function usesLiveGroupsPage(role: Role) {
  return role === 'admin' || role === 'hr'
}

export function isEligibleGroupCandidate(user: { role: Role; isActive: boolean }) {
  return user.role === 'employee' && user.isActive
}
