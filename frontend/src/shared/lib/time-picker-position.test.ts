import { describe, expect, it } from 'vitest'
import { placeTimePopup } from './time-picker-position'

describe('placeTimePopup', () => {
  it('keeps the popup inside a narrow viewport and prefers space above when needed', () => {
    const below = placeTimePopup(
      { top: 40, bottom: 80, left: 10, width: 160 },
      { width: 288, height: 280 },
      { width: 390, height: 800 },
    )
    expect(below.left).toBeGreaterThanOrEqual(8)
    expect(below.left + below.width).toBeLessThanOrEqual(382)
    expect(below.top).toBe(84)
    expect(below.left).toBe(8)

    const above = placeTimePopup(
      { top: 520, bottom: 560, left: 20, width: 160 },
      { width: 288, height: 320 },
      { width: 360, height: 600 },
    )
    expect(above.top).toBe(196)
    expect(above.left + above.width).toBeLessThanOrEqual(352)
  })
})
