import { describe, expect, it } from 'vitest'
import { isDirectoryRole, usesLiveEmployeesPage } from './access'

describe('usesLiveEmployeesPage', () => {
  it('routes ADMIN and HR to live employees', () => {
    expect(usesLiveEmployeesPage('admin')).toBe(true)
    expect(usesLiveEmployeesPage('hr')).toBe(true)
    expect(usesLiveEmployeesPage('support')).toBe(false)
  })
})

describe('isDirectoryRole', () => {
  it('accepts backend role names used in the Users API', () => {
    expect(isDirectoryRole('EMPLOYEE')).toBe(true)
    expect(isDirectoryRole('ADMIN')).toBe(true)
    expect(isDirectoryRole('employee')).toBe(false)
  })
})
