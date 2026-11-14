import { describe, expect, it } from 'vitest'
import { usesLiveBuildingsPage } from './building-access'

describe('usesLiveBuildingsPage', () => {
  it('routes ADMIN and HR to live buildings', () => {
    expect(usesLiveBuildingsPage('admin')).toBe(true)
    expect(usesLiveBuildingsPage('hr')).toBe(true)
    expect(usesLiveBuildingsPage('employee')).toBe(false)
  })
})
