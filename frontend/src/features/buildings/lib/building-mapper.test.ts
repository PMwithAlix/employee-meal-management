import { describe, expect, it } from 'vitest'
import { isDuplicateBuildingName, normalizeBuildingName } from './building-name'
import { activeMemberCount, parseBuilding, parseBuildingDetail } from './building-mapper'

describe('building names', () => {
  it('treats trimmed and case-insensitive repeats as duplicates', () => {
    expect(normalizeBuildingName('  دهقان   ')).toBe('دهقان')
    expect(isDuplicateBuildingName('دهقان', [{ id: 'b1', name: 'دهقان' }])).toBe(true)
    expect(isDuplicateBuildingName('  دهقان  ', [{ id: 'b1', name: 'دهقان' }], 'b1')).toBe(false)
    expect(isDuplicateBuildingName('شمال', [{ id: 'b1', name: 'دهقان' }])).toBe(false)
  })
})

describe('parseBuilding', () => {
  it('keeps id and name from the backend payload', () => {
    expect(parseBuilding({ id: 'b1', name: 'اصلی', isActive: true, createdAt: '2026-11-01T00:00:00.000Z' })).toEqual({
      id: 'b1',
      name: 'اصلی',
      isActive: true,
    })
  })

  it('rejects an incomplete building instead of using seed data', () => {
    expect(parseBuilding({ name: 'اصلی' })).toBeNull()
    expect(parseBuilding({ items: [] })).toBeNull()
  })
})

describe('parseBuildingDetail', () => {
  it('reuses _count.users when the detail payload includes it', () => {
    expect(parseBuildingDetail({
      id: 'b1',
      name: 'اصلی',
      isActive: true,
      _count: { users: 4, guestOrders: 2 },
    })).toEqual({ id: 'b1', name: 'اصلی', isActive: true, usersCount: 4, guestOrdersCount: 2 })
  })

  it('does not invent a member count when _count is missing', () => {
    expect(parseBuildingDetail({ id: 'b1', name: 'اصلی', isActive: true })?.usersCount).toBeNull()
  })
})

describe('activeMemberCount', () => {
  it('counts only active users of the selected building', () => {
    expect(activeMemberCount([
      { buildingId: 'b1', isActive: true },
      { buildingId: 'b1', isActive: false },
      { buildingId: 'b2', isActive: true },
    ], 'b1')).toBe(1)
  })
})
