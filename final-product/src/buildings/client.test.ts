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

  it('rejects a non-array buildings payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })))
    await expect(buildingApi.list()).rejects.toMatchObject({ kind: 'http' })
  })
})
