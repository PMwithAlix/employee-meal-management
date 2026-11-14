import type { Role } from '../../../shared/types/domain'

export function usesLiveGroupsPage(role: Role) {
  return role === 'admin' || role === 'hr'
}

export function isEligibleGroupCandidate(user: { role: string; isActive: boolean }) {
  return user.role === 'EMPLOYEE' && user.isActive
}
