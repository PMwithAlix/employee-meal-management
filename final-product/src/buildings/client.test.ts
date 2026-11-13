import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildingApi } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildingApi', () => {
  it('lists registered buildings from the API', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([
      { id: 'b1', name: 'اصلی' },
      { id: 'b2', name: 'فرعی' },
    ]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const listed = await buildingApi.list()
    expect(String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0])).toContain('/api/v1/buildings')
    expect(listed).toEqual([
      { id: 'b1', name: 'اصلی' },
      { id: 'b2', name: 'فرعی' },
    ])
  })

  it('rejects a non-array buildings payload instead of using seed data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })))
    await expect(buildingApi.list()).rejects.toMatchObject({ kind: 'http' })
  })

  it('loads building details including member count from GET /buildings/:id', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: 'b1',
      name: 'اصلی',
      _count: { users: 3 },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const detail = await buildingApi.get('b1')
    expect(String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0])).toContain('/api/v1/buildings/b1')
    expect(detail).toEqual({ id: 'b1', name: 'اصلی', usersCount: 3 })
  })

  it('creates and edits buildings with the name DTO only', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'POST') {
        expect(JSON.parse(String(init?.body))).toEqual({ name: 'جدید' })
        return new Response(JSON.stringify({ id: 'b3', name: 'جدید' }), { status: 201 })
      }
      expect(String(url)).toContain('/api/v1/buildings/b1')
      expect(JSON.parse(String(init?.body))).toEqual({ name: 'اصلی-ویرایش' })
      return new Response(JSON.stringify({ id: 'b1', name: 'اصلی-ویرایش' }), { status: 200 })
    }))
    expect((await buildingApi.create('جدید')).id).toBe('b3')
    expect((await buildingApi.update('b1', 'اصلی-ویرایش')).name).toBe('اصلی-ویرایش')
  })

  it('rejects an unparsable building instead of inventing a record', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ name: 'اصلی' }), { status: 200 })))
    await expect(buildingApi.get('b1')).rejects.toMatchObject({ kind: 'http' })
  })
})
