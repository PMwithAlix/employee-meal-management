import { describe, expect, it } from 'vitest'
import { pickerViewBounds, placeMealPicker } from './meal-picker-position'

const view = { top: 56, bottom: 800, left: 0, right: 1280 }

describe('placeMealPicker', () => {
  it('opens below when the real list fits under the trigger', () => {
    const box = placeMealPicker(
      { top: 80, bottom: 124, left: 40, right: 360, width: 320 },
      88,
      view,
      true,
    )
    expect(box.placeAbove).toBe(false)
    expect(box.top).toBe(128)
    expect(box.maxHeight).toBe(88)
  })

  it('opens above using content height, not a guessed maxHeight', () => {
    const trigger = { top: 700, bottom: 744, left: 24, right: 344, width: 320 }
    const box = placeMealPicker(trigger, 88, { top: 56, bottom: 780, left: 0, right: 390 }, true)
    expect(box.placeAbove).toBe(true)
    expect(box.maxHeight).toBe(88)
    expect(box.top).toBe(700 - 4 - 88)
    expect(box.top).toBeGreaterThan(trigger.top - 120)
  })

  it('aligns to the start edge in LTR without leaving the viewport', () => {
    const box = placeMealPicker(
      { top: 80, bottom: 120, left: 20, right: 200, width: 180 },
      88,
      { top: 0, bottom: 700, left: 0, right: 360 },
      false,
    )
    expect(box.left).toBe(20)
    expect(box.left + box.width).toBeLessThanOrEqual(352)
  })

  it('clips a long list to the larger side and stays inside the view', () => {
    const box = placeMealPicker(
      { top: 620, bottom: 664, left: 16, right: 336, width: 320 },
      480,
      { top: 56, bottom: 720, left: 8, right: 382 },
      true,
    )
    expect(box.placeAbove).toBe(true)
    expect(box.maxHeight).toBeLessThanOrEqual(620 - 4 - 56)
    expect(box.top).toBeGreaterThanOrEqual(56 + 8)
    expect(box.top + box.maxHeight).toBeLessThanOrEqual(720)
    expect(box.left).toBeGreaterThanOrEqual(16)
    expect(box.left + box.width).toBeLessThanOrEqual(382 - 8)
  })
})

describe('pickerViewBounds', () => {
  it('keeps the panel out of the sticky header and mobile bottom nav', () => {
    const bounds = pickerViewBounds(
      { offsetTop: 0, offsetLeft: 0, width: 390, height: 700 },
      { headerBottom: 56, navTop: 624 },
    )
    expect(bounds.top).toBe(56)
    expect(bounds.bottom).toBe(624)
  })
})
