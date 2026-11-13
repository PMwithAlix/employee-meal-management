import { afterEach, describe, expect, it, vi } from 'vitest'
import { userApi } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
})

function user(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    username: `emp.${id}`,
    role: 'EMPLOYEE',
    buildingId: 'b1',
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    building: { id: 'b1', name: 'اصلی' },
    ...extra,
  }
}

function jsonPage(page: number, total: number, items: unknown[], pageSize = 20) {
  return new Response(JSON.stringify({ items, total, page, pageSize }), { status: 200 })
}

describe('userApi', () => {
  it('lists directory users without password fields and uses total not page length', async () => {
    const fetchMock = vi.fn(async () => jsonPage(1, 9, [user('u1')], 20))
    vi.stubGlobal('fetch', fetchMock)
    const listed = await userApi.list({
      page: 1,
      pageSize: 20,
      username: 'emp',
      role: 'EMPLOYEE',
      buildingId: 'b1',
      isActive: true,
    })
    const url = String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0])
    expect(url).toContain('/api/v1/users')
    expect(url).toContain('username=emp')
    expect(url).toContain('role=EMPLOYEE')
    expect(url).toContain('buildingId=b1')
    expect(url).toContain('isActive=true')
    expect(listed.total).toBe(9)
    expect(listed.items).toHaveLength(1)
    expect(listed.items[0]?.username).toBe('emp.u1')
    expect(listed.items[0] && 'passwordHash' in listed.items[0]).toBe(false)
  })

  it('rejects a user list without items instead of using seed data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ total: 1, page: 1, pageSize: 100 }), { status: 200 })))
    await expect(userApi.list()).rejects.toMatchObject({ kind: 'http' })
  })

  it('rejects an incomplete user row instead of inventing a name', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonPage(1, 1, [{ id: 'u1', username: 'emp' }])))
    await expect(userApi.list()).rejects.toMatchObject({ kind: 'http' })
  })

  it('creates, updates, activates and resets passwords on the live user endpoints', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url)
      const method = init?.method ?? 'GET'
      if (method === 'POST' && path.endsWith('/users')) {
        expect(JSON.parse(String(init?.body))).toEqual({
          username: 'new.emp',
          password: 'Kavosh-1405',
          role: 'EMPLOYEE',
          buildingId: 'b1',
        })
        return new Response(JSON.stringify(user('new', { username: 'new.emp' })), { status: 201 })
      }
      if (method === 'PATCH' && path.endsWith('/users/u1')) {
        expect(JSON.parse(String(init?.body))).toEqual({ buildingId: 'b2' })
        return new Response(JSON.stringify(user('u1', { buildingId: 'b2', building: { id: 'b2', name: 'فرعی' } })), { status: 200 })
      }
      if (method === 'POST' && path.endsWith('/users/u1/deactivate')) {
        return new Response(JSON.stringify(user('u1', { isActive: false })), { status: 200 })
      }
      if (method === 'POST' && path.endsWith('/users/u1/reactivate')) {
        return new Response(JSON.stringify(user('u1', { isActive: true })), { status: 200 })
      }
      if (method === 'POST' && path.endsWith('/users/u1/reset-password')) {
        expect(JSON.parse(String(init?.body))).toEqual({ newPassword: 'Newpass12' })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      if (method === 'GET' && path.endsWith('/users/u1')) {
        return new Response(JSON.stringify(user('u1')), { status: 200 })
      }
      return new Response('missing', { status: 404 })
    }))
    expect((await userApi.create({ username: 'new.emp', password: 'Kavosh-1405', role: 'EMPLOYEE', buildingId: 'b1' })).id).toBe('new')
    expect((await userApi.update('u1', { buildingId: 'b2' })).buildingId).toBe('b2')
    expect((await userApi.deactivate('u1')).isActive).toBe(false)
    expect((await userApi.reactivate('u1')).isActive).toBe(true)
    await expect(userApi.resetPassword('u1', 'Newpass12')).resolves.toEqual({ ok: true })
    expect((await userApi.get('u1')).username).toBe('emp.u1')
  })

  it('lists members of a building using buildingId and backend total', async () => {
    const fetchMock = vi.fn(async () => jsonPage(1, 2, [user('u1'), user('u2')], 100))
    vi.stubGlobal('fetch', fetchMock)
    const listed = await userApi.listAll({ buildingId: 'b1' })
    expect(String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0])).toContain('buildingId=b1')
    expect(listed.total).toBe(2)
    expect(listed.items.every((item) => item.buildingId === 'b1')).toBe(true)
  })

  it('does not treat a reset response without ok as success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ passwordHash: 'nope' }), { status: 200 })))
    await expect(userApi.resetPassword('u1', 'Newpass12')).rejects.toMatchObject({ kind: 'http' })
  })
})
