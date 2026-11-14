import { describe, expect, it } from 'vitest'
import { formatUserCreatedAt, isHrManagedRole, parseManagedUser, parseResetPasswordResult, roleLabel } from './user-mapper'

const payload = {
  id: 'u1',
  username: 'emp.one',
  role: 'EMPLOYEE',
  buildingId: 'b1',
  isActive: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  building: { id: 'b1', name: 'اصلی' },
}

describe('parseManagedUser', () => {
  it('maps backend user fields without firstName, lastName or password hashes', () => {
    const parsed = parseManagedUser({ ...payload, passwordHash: 'secret', firstName: 'علی' })
    expect(parsed).toEqual({
      id: 'u1',
      username: 'emp.one',
      role: 'EMPLOYEE',
      buildingId: 'b1',
      buildingName: 'اصلی',
      isActive: true,
      createdAt: '2026-11-01T00:00:00.000Z',
    })
    expect(parsed && 'passwordHash' in parsed).toBe(false)
    expect(parsed && 'firstName' in parsed).toBe(false)
  })

  it('rejects an incomplete user instead of inventing identity fields', () => {
    expect(parseManagedUser({ ...payload, createdAt: undefined })).toBeNull()
    expect(parseManagedUser({ ...payload, isActive: 'yes' })).toBeNull()
    expect(parseManagedUser({ username: 'emp.one' })).toBeNull()
  })
})

describe('hr managed roles', () => {
  it('keeps HR inside employee, support and management accounts', () => {
    expect(isHrManagedRole('EMPLOYEE')).toBe(true)
    expect(isHrManagedRole('SUPPORT')).toBe(true)
    expect(isHrManagedRole('MANAGEMENT')).toBe(true)
    expect(isHrManagedRole('ADMIN')).toBe(false)
    expect(isHrManagedRole('HR')).toBe(false)
    expect(roleLabel('EMPLOYEE')).toBe('کارمند')
  })
})

describe('user dates and reset payload', () => {
  it('formats createdAt in Asia/Tehran and accepts only ok reset responses', () => {
    expect(formatUserCreatedAt('2026-11-01T00:00:00.000Z')).not.toBe('—')
    expect(formatUserCreatedAt('not-a-date')).toBe('—')
    expect(parseResetPasswordResult({ ok: true })).toBe(true)
    expect(parseResetPasswordResult({ ok: false })).toBe(false)
    expect(parseResetPasswordResult({ passwordHash: 'x' })).toBe(false)
  })
})
