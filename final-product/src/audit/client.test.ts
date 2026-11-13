import { afterEach, describe, expect, it, vi } from 'vitest'
import { auditApi } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('auditApi', () => {
  it('lists audit logs from the live endpoint without treating page length as total', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      items: [{
        id: 'a1',
        action: 'ORDER_CREATED',
        entityType: 'Order',
        entityId: 'o1',
        actorId: 'u1',
        actor: { id: 'u1', username: 'support', role: 'SUPPORT' },
        beforeData: null,
        afterData: { menuItemId: 'm1' },
        createdAt: '2026-11-01T00:00:00.000Z',
      }],
      total: 9,
      page: 1,
      pageSize: 20,
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const listed = await auditApi.list({ page: 1, pageSize: 20 })
    expect(String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0])).toContain('/api/v1/audit-logs')
    expect(listed.total).toBe(9)
    expect(listed.items).toHaveLength(1)
    expect(listed.items[0]?.actorUsername).toBe('support')
  })

  it('rejects an incomplete audit payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ total: 1, page: 1, pageSize: 20 }), { status: 200 })))
    await expect(auditApi.list()).rejects.toMatchObject({ kind: 'http' })
  })
})
