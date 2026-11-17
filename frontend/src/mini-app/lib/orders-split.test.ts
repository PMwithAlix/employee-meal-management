import { describe, expect, it } from 'vitest'
import type { Order } from '../../shared/types/domain'
import { splitOrdersByMealDate } from './orders-split'

function order(partial: Partial<Order> & Pick<Order, 'id' | 'jy' | 'jm' | 'jd'>): Order {
  return {
    employeeId: 'u1',
    buildingId: 'b1',
    meal: 'lunch',
    choice: 'چلو',
    cycleStatus: 'ACTIVE',
    rating: null,
    ...partial,
  }
}

describe('splitOrdersByMealDate', () => {
  it('keeps next-month meals in upcoming, not past', () => {
    const today = { jy: 1404, jm: 8, jd: 20 }
    const split = splitOrdersByMealDate(
      [
        order({ id: 'future-month', jy: 1404, jm: 9, jd: 1 }),
        order({ id: 'yesterday', jy: 1404, jm: 8, jd: 19 }),
        order({ id: 'today', jy: 1404, jm: 8, jd: 20 }),
      ],
      today,
    )
    expect(split.upcoming.map((item) => item.id)).toEqual(['today', 'future-month'])
    expect(split.past.map((item) => item.id)).toEqual(['yesterday'])
  })

  it('does not drop orders that lack a current menu mapping', () => {
    const split = splitOrdersByMealDate(
      [order({ id: 'orphan', jy: 1404, jm: 7, jd: 1, choice: null, snapshotTitle: 'قدیمی' })],
      { jy: 1404, jm: 8, jd: 1 },
    )
    expect(split.past).toHaveLength(1)
    expect(split.past[0]?.snapshotTitle).toBe('قدیمی')
  })
})
