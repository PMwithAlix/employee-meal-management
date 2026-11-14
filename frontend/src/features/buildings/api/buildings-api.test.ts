import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildingApi } from './buildings-api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildingApi', () => {
  it('lists registered buildings from the API', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([
      { id: 'b1', name: 'اصلی', isActive: true },
      { id: 'b2', name: 'فرعی', isActive: true },
    ]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const listed = await buildingApi.list()
    expect(String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0])).toContain('/api/v1/buildings')
    expect(listed).toEqual([
      { id: 'b1', name: 'اصلی', isActive: true },
      { id: 'b2', name: 'فرعی', isActive: true },
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
      isActive: true,
      _count: { users: 3 },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const detail = await buildingApi.get('b1')
    expect(String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0])).toContain('/api/v1/buildings/b1')
    expect(detail).toEqual({ id: 'b1', name: 'اصلی', isActive: true, usersCount: 3 })
  })

  it('creates and edits buildings with the name DTO only', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'POST') {
        expect(JSON.parse(String(init?.body))).toEqual({ name: 'جدید' })
        return new Response(JSON.stringify({ id: 'b3', name: 'جدید', isActive: true }), { status: 201 })
      }
      expect(String(url)).toContain('/api/v1/buildings/b1')
      expect(JSON.parse(String(init?.body))).toEqual({ name: 'اصلی-ویرایش' })
      return new Response(JSON.stringify({ id: 'b1', name: 'اصلی-ویرایش', isActive: true }), { status: 200 })
    }))
    expect((await buildingApi.create('جدید')).id).toBe('b3')
    expect((await buildingApi.update('b1', 'اصلی-ویرایش')).name).toBe('اصلی-ویرایش')
  })

  it('rejects an unparsable building instead of inventing a record', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ name: 'اصلی' }), { status: 200 })))
    await expect(buildingApi.get('b1')).rejects.toMatchObject({ kind: 'http' })
  })

  it('deactivates and reactivates a building through dedicated endpoints', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const inactive = String(url).endsWith('/deactivate')
      return new Response(JSON.stringify({
        id: 'b1',
        name: 'اصلی',
        isActive: !inactive,
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(buildingApi.deactivate('b1')).resolves.toMatchObject({ isActive: false })
    await expect(buildingApi.reactivate('b1')).resolves.toMatchObject({ isActive: true })
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/buildings/b1/deactivate', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/buildings/b1/reactivate', expect.objectContaining({ method: 'POST' }))
  })
})
