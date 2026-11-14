import { describe, expect, it } from 'vitest'
import { isEligibleGroupCandidate, usesLiveGroupsPage } from './group-access'

describe('usesLiveGroupsPage', () => {
  it('routes ADMIN and HR to the live groups implementation', () => {
    expect(usesLiveGroupsPage('admin')).toBe(true)
    expect(usesLiveGroupsPage('hr')).toBe(true)
  })

  it('does not expose group management to other roles', () => {
    expect(usesLiveGroupsPage('support')).toBe(false)
    expect(usesLiveGroupsPage('management')).toBe(false)
    expect(usesLiveGroupsPage('employee')).toBe(false)
  })
})

describe('isEligibleGroupCandidate', () => {
  it('allows active employees only', () => {
    expect(isEligibleGroupCandidate({ role: 'EMPLOYEE', isActive: true })).toBe(true)
    expect(isEligibleGroupCandidate({ role: 'EMPLOYEE', isActive: false })).toBe(false)
    expect(isEligibleGroupCandidate({ role: 'ADMIN', isActive: true })).toBe(false)
    expect(isEligibleGroupCandidate({ role: 'HR', isActive: true })).toBe(false)
    expect(isEligibleGroupCandidate({ role: 'SUPPORT', isActive: true })).toBe(false)
    expect(isEligibleGroupCandidate({ role: 'MANAGEMENT', isActive: true })).toBe(false)
  })
})
