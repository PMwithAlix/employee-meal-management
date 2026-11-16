import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthRequestError } from '../../auth/lib/auth-errors'
import { menuApi } from './menus-api'

describe('menuApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads a published menu with credentials and preserves option ids', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'menu-1',
          jalaliYear: 1405,
          jalaliMonth: 8,
          publishedVersionId: 'ver-1',
          version: {
            id: 'ver-1',
            menuId: 'menu-1',
            versionNumber: 1,
            status: 'PUBLISHED',
            publishedAt: '2026-11-01T00:00:00.000Z',
            createdBy: 'user-1',
            createdAt: '2026-11-01T00:00:00.000Z',
            meals: [
              {
                mealDate: '2026-10-23',
                mealType: 'LUNCH',
                options: [{ id: 'opt-1', title: 'عدسی', displayOrder: 1 }],
              },
            ],
          },
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const result = await menuApi.getPublished(1405, 8)
    const [url, init] = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0]
    expect(url).toBe('/api/v1/published-menus/1405/8')
    expect(init.credentials).toBe('include')
    expect(result?.version.meals[0]?.options[0]?.id).toBe('opt-1')
  })

  it('treats 404 as an empty published month, not seed data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'منوی منتشرشده‌ای برای این ماه وجود ندارد.' }), { status: 404 })),
    )
    await expect(menuApi.getPublished(1405, 1)).rejects.toMatchObject({ kind: 'not_found', status: 404 })
  })

  it('creates a monthly menu and asks for the current version without copying a draft', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/menus') && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'menu-2', jalaliYear: 1405, jalaliMonth: 8, publishedVersionId: 'pub-1' }), { status: 201 })
      }
      return new Response(
        JSON.stringify({
          id: 'draft-1',
          menuId: 'menu-2',
          versionNumber: 2,
          status: 'DRAFT',
          publishedAt: null,
          createdBy: 'user-1',
          createdAt: '2026-11-01T00:00:00.000Z',
          meals: [],
        }),
        { status: 201 },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    await menuApi.create(1405, 8)
    await menuApi.createVersion('menu-2')
    const createVersion = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[1]
    expect(createVersion[0]).toBe('/api/v1/menus/menu-2/versions')
    expect(createVersion[1].body).toBe('{}')
  })

  it('patches live menu options and confirms excel imports', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url)
      if (init?.method === 'PATCH' && path.includes('/versions/')) {
        return new Response(JSON.stringify({
          id: 'draft-1', menuId: 'menu-1', versionNumber: 2, status: 'DRAFT', publishedAt: null, createdBy: 'u', createdAt: '2026-11-01T00:00:00.000Z', meals: [],
        }), { status: 200 })
      }
      if (path.includes('/confirm')) {
        return new Response(JSON.stringify({
          menu: { id: 'menu-1', jalaliYear: 1405, jalaliMonth: 8, publishedVersionId: null },
          version: { id: 'draft-9', menuId: 'menu-1', versionNumber: 9, status: 'DRAFT', publishedAt: null, createdBy: 'u', createdAt: '2026-11-01T00:00:00.000Z', meals: [] },
          policy: 'KEEP_EXISTING_ORDERS',
          impact: { matches: [], unmatchedPublished: [], unmatchedImported: [], ambiguous: [], activeOrderCount: 0, atRiskOrderCount: 0, atRiskOrders: [] },
        }), { status: 200 })
      }
      return new Response('{}', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    await menuApi.patchMeal('menu-1', 'draft-1', {
      mealDate: '2026-10-23',
      mealType: 'LUNCH',
      options: [{ title: 'عدسی', displayOrder: 1 }],
    })
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>
    expect(calls[0][1].method).toBe('PATCH')
    await menuApi.confirmImport('import-1', 'keep')
    expect(calls[1][1].body).toBe(JSON.stringify({ policy: 'KEEP_EXISTING_ORDERS' }))
  })

  it('asks the user to preview again when an import is expired', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'پیش‌نمایش واردسازی پیدا نشد یا منقضی شده است.' }), { status: 404 })),
    )
    await expect(menuApi.confirmImport('gone', 'keep')).rejects.toBeInstanceOf(AuthRequestError)
  })

  it('does not set Content-Type on multipart preview so the browser can send the boundary', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ valid: false, importId: null, errors: [], warnings: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['xlsx'], 'menu.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    await menuApi.previewImport(file)
    const init = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0][1]
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.credentials).toBe('include')
  })

  it('parses preview meals so the import board can render Excel options', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({
        valid: true,
        importId: 'import-1',
        jalaliYear: 1405,
        jalaliMonth: 8,
        meals: [{ mealDate: '2026-11-15', mealType: 'LUNCH', options: [{ id: 'p1', title: 'قورمه', displayOrder: 1 }] }],
        errors: [],
        warnings: [],
      }), { status: 200 })),
    )
    const file = new File(['xlsx'], 'menu.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const preview = await menuApi.previewImport(file)
    expect(preview.meals[0]?.options[0]?.title).toBe('قورمه')
    await menuApi.patchImportMeal('import-1', { mealDate: '2026-11-15', mealType: 'LUNCH', options: [{ title: 'قیمه', displayOrder: 1 }] })
  })
})
