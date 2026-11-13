import { afterEach, describe, expect, it, vi } from 'vitest'
import { userApi } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('userApi', () => {
  it('lists directory users without password fields', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      items: [{ id: 'u1', username: 'emp', role: 'EMPLOYEE', buildingId: 'b1', isActive: true }],
      total: 1,
      page: 1,
      pageSize: 100,
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const listed = await userApi.listAll({ role: 'EMPLOYEE', isActive: true })
    expect(String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0])).toContain('/api/v1/users')
    expect(listed.total).toBe(1)
    expect(listed.items[0]).toEqual({ id: 'u1', username: 'emp', role: 'EMPLOYEE', buildingId: 'b1', isActive: true })
  })

  it('rejects a user list without items', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ total: 1, page: 1, pageSize: 100 }), { status: 200 })))
    await expect(userApi.list()).rejects.toMatchObject({ kind: 'http' })
  })
})
