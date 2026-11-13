import { describe, expect, it } from 'vitest'
import { deadlineKey, isDeadlineOpen, parseBackendOrder, toUiOrder } from './map'

const payload = {
  id: 'order-1',
  userId: 'user-1',
  mealDate: '2026-10-23',
  jalaliDate: '1405-08-01',
  mealType: 'LUNCH',
  quantity: 1,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  status: 'ACTIVE',
  currentCycle: {
    id: 'cycle-1',
    cycleNumber: 1,
    menuItemId: 'item-uuid',
    menuVersionId: 'ver-1',
    optionTitle: 'چلوکباب',
    usernameSnapshot: 'e2e.order.employee',
    buildingIdSnapshot: 'b1',
    buildingNameSnapshot: 'اصلی',
    mealDateSnapshot: '2026-10-23',
    mealTypeSnapshot: 'LUNCH',
    status: 'ACTIVE',
    createdAt: '2026-11-01T00:00:00.000Z',
    groups: [{ groupId: 'g1', groupNameSnapshot: 'گروه الف' }],
  },
  rating: null,
}

describe('parseBackendOrder', () => {
  it('keeps option identity from currentCycle.menuItemId', () => {
    const parsed = parseBackendOrder(payload)
    expect(parsed?.currentCycle?.menuItemId).toBe('item-uuid')
    expect(parsed?.currentCycle?.optionTitle).toBe('چلوکباب')
    const ui = toUiOrder(parsed!)
    expect(ui?.menuItemId).toBe('item-uuid')
    expect(ui?.choice).toBe('چلوکباب')
    expect(ui?.meal).toBe('lunch')
  })

  it('does not treat a cancelled cycle as a current choice', () => {
    const ui = toUiOrder(parseBackendOrder({ ...payload, status: 'CANCELLED', currentCycle: { ...payload.currentCycle, status: 'CANCELLED' } })!)
    expect(ui?.choice).toBeNull()
    expect(ui?.snapshotTitle).toBe('چلوکباب')
    expect(ui?.menuItemId).toBeNull()
    expect(ui?.cycleStatus).toBe('CANCELLED')
  })
})

describe('deadlines', () => {
  it('builds a mealDate+type key and compares ISO deadlines', () => {
    expect(deadlineKey('2026-10-23', 'lunch')).toBe('2026-10-23:LUNCH')
    expect(isDeadlineOpen('2099-01-01T00:00:00.000Z', new Date('2026-01-01T00:00:00.000Z'))).toBe(true)
    expect(isDeadlineOpen('2020-01-01T00:00:00.000Z', new Date('2026-01-01T00:00:00.000Z'))).toBe(false)
  })
})
