import { describe, expect, it } from 'vitest'
import { mapBackendRole, parseSessionUser } from './session-roles'

describe('mapBackendRole', () => {
  it('maps every backend role onto the confirmed frontend role', () => {
    expect(mapBackendRole('EMPLOYEE')).toBe('employee')
    expect(mapBackendRole('HR')).toBe('hr')
    expect(mapBackendRole('SUPPORT')).toBe('support')
    expect(mapBackendRole('MANAGEMENT')).toBe('management')
    expect(mapBackendRole('ADMIN')).toBe('admin')
  })

  it('rejects unknown roles so the app shell is not opened', () => {
    expect(mapBackendRole('SUPERADMIN')).toBeNull()
    expect(mapBackendRole('employee')).toBeNull()
  })
})

describe('parseSessionUser', () => {
  const base = {
    id: '11111111-1111-1111-1111-111111111111',
    username: 'e2e.order.employee',
    role: 'EMPLOYEE',
    buildingId: '22222222-2222-2222-2222-222222222222',
    expiresAt: '2026-11-14T08:00:00.000Z',
  }

  it('keeps identity fields from the backend session payload', () => {
    expect(parseSessionUser(base)).toEqual({
      id: base.id,
      username: base.username,
      role: 'employee',
      backendRole: 'EMPLOYEE',
      buildingId: base.buildingId,
      expiresAt: base.expiresAt,
    })
  })

  it('accepts a null buildingId for ADMIN accounts', () => {
    expect(parseSessionUser({ ...base, role: 'ADMIN', buildingId: null })).toMatchObject({
      role: 'admin',
      buildingId: null,
    })
  })

  it('flags an unknown role instead of falling back to a persona', () => {
    expect(parseSessionUser({ ...base, role: 'GUEST' })).toBe('invalid-role')
  })
})
