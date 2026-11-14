import { describe, expect, it } from 'vitest'
import { formatGroupInstant, parseGroup, parseGroupDetail, parseGroupHistory, parseGroupMember } from './group-mapper'

const group = { id: 'g1', name: 'گروه الف', isActive: true }
const member = {
  id: 'm1',
  groupId: 'g1',
  userId: 'u1',
  startedAt: '2026-11-01T00:00:00.000Z',
  endedAt: null,
  user: { id: 'u1', username: 'emp.one', role: 'EMPLOYEE', buildingId: 'b1', isActive: true },
}

describe('parseGroup', () => {
  it('maps id, name and active status', () => {
    expect(parseGroup(group)).toEqual(group)
  })

  it('rejects an incomplete group instead of using seed data', () => {
    expect(parseGroup({ name: 'گروه الف' })).toBeNull()
    expect(parseGroup({ id: 'g1', name: 'گروه الف' })).toBeNull()
  })
})

describe('parseGroupDetail', () => {
  it('reuses active membership count from _count.memberships', () => {
    expect(parseGroupDetail({ ...group, _count: { memberships: 3 } })).toEqual({
      ...group,
      memberCount: 3,
    })
  })

  it('does not invent a member count', () => {
    expect(parseGroupDetail(group)?.memberCount).toBeNull()
  })
})

describe('membership payloads', () => {
  it('maps current members from nested user records', () => {
    expect(parseGroupMember(member)).toEqual({
      membershipId: 'm1',
      groupId: 'g1',
      userId: 'u1',
      username: 'emp.one',
      role: 'EMPLOYEE',
      isActive: true,
      startedAt: '2026-11-01T00:00:00.000Z',
    })
  })

  it('maps history endedAt without inferring missing rows', () => {
    expect(parseGroupHistory({ ...member, endedAt: '2026-11-02T00:00:00.000Z' })?.endedAt).toBe('2026-11-02T00:00:00.000Z')
    expect(parseGroupHistory({ ...member, endedAt: null })?.endedAt).toBeNull()
    expect(parseGroupMember({ groupId: 'g1' })).toBeNull()
  })

  it('formats timestamps or shows an empty marker', () => {
    expect(formatGroupInstant(null)).toBe('—')
    expect(formatGroupInstant('not-a-date')).toBe('—')
    expect(formatGroupInstant('2026-11-01T00:00:00.000Z')).not.toBe('—')
  })
})
