import { describe, expect, it } from 'vitest'
import { usesLiveGroupsPage } from './access'

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
