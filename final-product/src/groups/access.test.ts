import { describe, expect, it } from 'vitest'
import { isEligibleGroupCandidate, usesLiveGroupsPage } from './access'

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
    expect(isEligibleGroupCandidate({ role: 'employee', isActive: true })).toBe(true)
    expect(isEligibleGroupCandidate({ role: 'employee', isActive: false })).toBe(false)
    expect(isEligibleGroupCandidate({ role: 'admin', isActive: true })).toBe(false)
    expect(isEligibleGroupCandidate({ role: 'hr', isActive: true })).toBe(false)
    expect(isEligibleGroupCandidate({ role: 'support', isActive: true })).toBe(false)
    expect(isEligibleGroupCandidate({ role: 'management', isActive: true })).toBe(false)
  })
})
