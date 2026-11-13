import { afterEach, describe, expect, it, vi } from 'vitest'
import { groupApi } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
})

const group = { id: 'g1', name: 'گروه الف', isActive: true }
const member = {
  id: 'm1',
  groupId: 'g1',
  userId: 'u1',
  startedAt: '2026-11-01T00:00:00.000Z',
  endedAt: null,
  user: { id: 'u1', username: 'emp.one', role: 'EMPLOYEE', buildingId: 'b1', isActive: true },
}

describe('groupApi', () => {
  it('lists groups from GET /groups without using seed data', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([group]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const listed = await groupApi.list()
    expect(String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0])).toContain('/api/v1/groups')
    expect(listed).toEqual([group])
  })

  it('rejects a non-array group list instead of falling back to seed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [group] }), { status: 200 })))
    await expect(groupApi.list()).rejects.toMatchObject({ kind: 'http' })
  })

  it('loads details, members, history, create, rename, membership and deactivation', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url)
      const method = init?.method ?? 'GET'
      if (method === 'GET' && path.endsWith('/groups/g1')) {
        return new Response(JSON.stringify({ ...group, _count: { memberships: 1 } }), { status: 200 })
      }
      if (method === 'GET' && path.endsWith('/groups/g1/members')) {
        return new Response(JSON.stringify([member]), { status: 200 })
      }
      if (method === 'GET' && path.endsWith('/groups/g1/memberships/history')) {
        return new Response(JSON.stringify([{ ...member, endedAt: null }]), { status: 200 })
      }
      if (method === 'POST' && path.endsWith('/groups')) {
        expect(JSON.parse(String(init?.body))).toEqual({ name: 'گروه جدید' })
        return new Response(JSON.stringify({ id: 'g2', name: 'گروه جدید', isActive: true }), { status: 201 })
      }
      if (method === 'PATCH' && path.endsWith('/groups/g1')) {
        expect(JSON.parse(String(init?.body))).toEqual({ name: 'گروه ب' })
        return new Response(JSON.stringify({ ...group, name: 'گروه ب' }), { status: 200 })
      }
      if (method === 'POST' && path.endsWith('/groups/g1/members')) {
        expect(JSON.parse(String(init?.body))).toEqual({ userId: 'u2' })
        return new Response(JSON.stringify({ id: 'm2', groupId: 'g1', userId: 'u2' }), { status: 201 })
      }
      if (method === 'DELETE' && path.endsWith('/groups/g1/members/u1')) {
        return new Response(JSON.stringify({ id: 'm1', endedAt: '2026-11-02T00:00:00.000Z' }), { status: 200 })
      }
      if (method === 'POST' && path.endsWith('/groups/g1/deactivate')) {
        return new Response(JSON.stringify({ ...group, isActive: false }), { status: 200 })
      }
      return new Response('missing', { status: 404 })
    }))
    expect((await groupApi.get('g1')).memberCount).toBe(1)
    expect(await groupApi.members('g1')).toEqual(['u1'])
    expect((await groupApi.listMembers('g1'))[0]?.username).toBe('emp.one')
    expect((await groupApi.history('g1'))[0]?.endedAt).toBeNull()
    expect((await groupApi.create('گروه جدید')).id).toBe('g2')
    expect((await groupApi.update('g1', 'گروه ب')).name).toBe('گروه ب')
    await groupApi.addMember('g1', 'u2')
    await groupApi.removeMember('g1', 'u1')
    expect((await groupApi.deactivate('g1')).isActive).toBe(false)
  })

  it('treats empty members and empty history as valid, not as failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })))
    await expect(groupApi.listMembers('g1')).resolves.toEqual([])
    await expect(groupApi.history('g1')).resolves.toEqual([])
  })

  it('rejects incomplete members and history instead of inventing rows', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('history')) return new Response(JSON.stringify({ items: [] }), { status: 200 })
      return new Response(JSON.stringify([{ userId: 'u1' }]), { status: 200 })
    }))
    await expect(groupApi.listMembers('g1')).rejects.toMatchObject({ kind: 'http' })
    await expect(groupApi.history('g1')).rejects.toMatchObject({ kind: 'http' })
  })

  it('surfaces backend overlap and validation errors without treating them as success', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url)
      const method = init?.method ?? 'GET'
      if (method === 'POST' && path.endsWith('/groups/g1/members')) {
        return new Response(JSON.stringify({ message: 'کاربر هم‌اکنون عضو فعال این گروه است.', statusCode: 409 }), { status: 409 })
      }
      if (method === 'POST' && path.endsWith('/groups')) {
        return new Response(JSON.stringify({ message: ['name should not be empty'], statusCode: 400 }), { status: 400 })
      }
      return new Response(JSON.stringify({ message: 'دسترسی ندارید.', statusCode: 403 }), { status: 403 })
    }))
    await expect(groupApi.addMember('g1', 'u1')).rejects.toMatchObject({ kind: 'conflict', status: 409 })
    await expect(groupApi.create('')).rejects.toMatchObject({ kind: 'http', status: 400 })
    await expect(groupApi.deactivate('g1')).rejects.toMatchObject({ kind: 'forbidden', status: 403 })
  })
})
