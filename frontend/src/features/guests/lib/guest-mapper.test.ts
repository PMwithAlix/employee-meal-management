import { describe, expect, it } from 'vitest'
import { parseGuestOrder } from './guest-mapper'

const valid = {
  id: 'g1',
  buildingId: 'b1',
  menuItemId: 'm1',
  menuVersionId: 'v1',
  mealDate: '2026-10-23',
  jalaliDate: '1405/08/01',
  mealType: 'LUNCH',
  quantity: 3,
  note: 'هیئت',
  status: 'ACTIVE',
  buildingNameSnapshot: 'اصلی',
  mealTitleSnapshot: 'عدسی',
  createdBy: 'user-1',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  history: [{ id: 'h1', actorId: 'user-1', action: 'CREATED', createdAt: '2026-11-01T00:00:00.000Z' }],
}

describe('parseGuestOrder', () => {
  it('keeps snapshots and menuItemId when they are null', () => {
    const parsed = parseGuestOrder({
      ...valid,
      menuItemId: null,
      menuVersionId: null,
      buildingNameSnapshot: null,
      mealTitleSnapshot: null,
      jalaliDate: null,
      note: null,
      history: [],
    })
    expect(parsed).toMatchObject({
      id: 'g1',
      menuItemId: null,
      buildingNameSnapshot: null,
      mealTitleSnapshot: null,
      jalaliDate: null,
      note: null,
    })
  })

  it('rejects rows with an invalid status or meal type', () => {
    expect(parseGuestOrder({ ...valid, status: 'OPEN' })).toBeNull()
    expect(parseGuestOrder({ ...valid, mealType: 'breakfast' })).toBeNull()
    expect(parseGuestOrder({ ...valid, quantity: '3' })).toBeNull()
    expect(parseGuestOrder({ ...valid, history: {} })).toBeNull()
  })
})
