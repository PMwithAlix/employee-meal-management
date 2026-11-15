import { authRequest } from '../../auth/api/auth-api'
import type { ReplacePolicy } from '../../../shared/types/domain'
import { parseMeals } from '../lib/menu-mapper'
import {
  IMPORT_POLICY,
  MENU_ENDPOINTS,
  type ImportConfirmResult,
  type ImportPreview,
  type MealPatch,
  type MenuListResponse,
  type MenuSummary,
  type MenuVersionDetail,
  type MenuVersionSummary,
  type PublishedMenu,
} from '../model/menu-types'

const session = { treatUnauthorizedAsSessionEnd: true as const }

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function parseSummary(value: unknown): MenuSummary | null {
  const body = asRecord(value)
  if (!body || typeof body.id !== 'string') return null
  if (typeof body.jalaliYear !== 'number' || typeof body.jalaliMonth !== 'number') return null
  return {
    id: body.id,
    jalaliYear: body.jalaliYear,
    jalaliMonth: body.jalaliMonth,
    publishedVersionId: typeof body.publishedVersionId === 'string' ? body.publishedVersionId : null,
    versionCount: typeof body.versionCount === 'number' ? body.versionCount : undefined,
  }
}

function parseVersion(value: unknown): MenuVersionDetail | null {
  const body = asRecord(value)
  if (!body || typeof body.id !== 'string' || typeof body.menuId !== 'string') return null
  if (typeof body.versionNumber !== 'number') return null
  if (body.status !== 'DRAFT' && body.status !== 'PUBLISHED') return null
  return {
    id: body.id,
    menuId: body.menuId,
    versionNumber: body.versionNumber,
    status: body.status,
    publishedAt: typeof body.publishedAt === 'string' ? body.publishedAt : null,
    createdBy: typeof body.createdBy === 'string' ? body.createdBy : '',
    createdAt: typeof body.createdAt === 'string' ? body.createdAt : '',
    meals: parseMeals(body.meals),
  }
}

function parsePreview(value: unknown): ImportPreview {
  const body = asRecord(value) ?? {}
  return {
    importId: typeof body.importId === 'string' ? body.importId : null,
    valid: body.valid === true,
    jalaliYear: typeof body.jalaliYear === 'number' ? body.jalaliYear : 0,
    jalaliMonth: typeof body.jalaliMonth === 'number' ? body.jalaliMonth : 0,
    dateCount: typeof body.dateCount === 'number' ? body.dateCount : 0,
    lunchMealCount: typeof body.lunchMealCount === 'number' ? body.lunchMealCount : 0,
    dinnerMealCount: typeof body.dinnerMealCount === 'number' ? body.dinnerMealCount : 0,
    optionCount: typeof body.optionCount === 'number' ? body.optionCount : 0,
    errors: Array.isArray(body.errors) ? (body.errors as ImportPreview['errors']) : [],
    warnings: Array.isArray(body.warnings) ? (body.warnings as ImportPreview['warnings']) : [],
    meals: parseMeals(body.meals),
    existing: (body.existing as ImportPreview['existing']) ?? null,
    impact: (body.impact as ImportPreview['impact']) ?? null,
    expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : null,
  }
}

export const menuApi = {
  getPublished(year: number, month: number, signal?: AbortSignal) {
    return authRequest<unknown>(MENU_ENDPOINTS.published(year, month), { ...session, signal }).then((body) => {
      const summary = parseSummary(body)
      const version = parseVersion(asRecord(body)?.version)
      if (!summary || !version) return null
      return { ...summary, version } satisfies PublishedMenu
    })
  },

  list(year: number, month: number, signal?: AbortSignal) {
    return authRequest<unknown>(`${MENU_ENDPOINTS.list}?year=${year}&month=${month}&pageSize=100`, {
      ...session,
      signal,
    }).then((body) => {
      const record = asRecord(body)
      const items = Array.isArray(record?.items)
        ? record.items.map(parseSummary).filter((item): item is MenuSummary => item !== null)
        : []
      return {
        items,
        total: typeof record?.total === 'number' ? record.total : items.length,
        page: typeof record?.page === 'number' ? record.page : 1,
        pageSize: typeof record?.pageSize === 'number' ? record.pageSize : items.length,
      } satisfies MenuListResponse
    })
  },

  create(year: number, month: number) {
    return authRequest<unknown>(MENU_ENDPOINTS.create, {
      ...session,
      method: 'POST',
      body: { year, month },
    }).then((body) => {
      const summary = parseSummary(body)
      if (!summary) throw new Error('پاسخ ایجاد منو نامعتبر است.')
      return summary
    })
  },

  get(id: string) {
    return authRequest<unknown>(MENU_ENDPOINTS.get(id), session).then((body) => {
      const summary = parseSummary(body)
      if (!summary) throw new Error('پاسخ منو نامعتبر است.')
      return summary
    })
  },

  listVersions(menuId: string, signal?: AbortSignal) {
    return authRequest<unknown>(MENU_ENDPOINTS.versions(menuId), { ...session, signal }).then((body) => {
      if (!Array.isArray(body)) return [] as MenuVersionSummary[]
      return body
        .map(parseVersion)
        .filter((item): item is MenuVersionDetail => item !== null)
        .map((item) => ({
          id: item.id,
          menuId: item.menuId,
          versionNumber: item.versionNumber,
          status: item.status,
          publishedAt: item.publishedAt,
          createdBy: item.createdBy,
          createdAt: item.createdAt,
        }))
    })
  },

  createVersion(menuId: string, sourceVersionId?: string | null) {
    const body = sourceVersionId === undefined ? {} : { sourceVersionId }
    return authRequest<unknown>(MENU_ENDPOINTS.versions(menuId), {
      ...session,
      method: 'POST',
      body,
    }).then((value) => {
      const version = parseVersion(value)
      if (!version) throw new Error('پاسخ نسخه منو نامعتبر است.')
      return version
    })
  },

  getVersion(menuId: string, versionId: string, signal?: AbortSignal) {
    return authRequest<unknown>(MENU_ENDPOINTS.version(menuId, versionId), { ...session, signal }).then((value) => {
      const version = parseVersion(value)
      if (!version) throw new Error('پاسخ نسخه منو نامعتبر است.')
      return version
    })
  },

  patchMeal(menuId: string, versionId: string, patch: MealPatch) {
    return authRequest<unknown>(MENU_ENDPOINTS.version(menuId, versionId), {
      ...session,
      method: 'PATCH',
      body: patch,
    }).then((value) => {
      const version = parseVersion(value)
      if (!version) throw new Error('پاسخ ویرایش وعده نامعتبر است.')
      return version
    })
  },

  publish(menuId: string, versionId: string) {
    return authRequest<unknown>(MENU_ENDPOINTS.publish(menuId, versionId), {
      ...session,
      method: 'POST',
    }).then((value) => {
      const version = parseVersion(value)
      if (!version) throw new Error('پاسخ انتشار نامعتبر است.')
      return version
    })
  },

  previewImport(file: File) {
    const data = new FormData()
    data.append('file', file)
    return authRequest<unknown>(MENU_ENDPOINTS.preview, {
      ...session,
      method: 'POST',
      body: data,
    }).then(parsePreview)
  },

  patchImportMeal(importId: string, patch: MealPatch) {
    return authRequest<unknown>(MENU_ENDPOINTS.patchImport(importId), {
      ...session,
      method: 'PATCH',
      body: patch,
    }).then(parsePreview)
  },

  confirmImport(importId: string, policy: ReplacePolicy) {
    return authRequest<unknown>(MENU_ENDPOINTS.confirm(importId), {
      ...session,
      method: 'POST',
      body: { policy: IMPORT_POLICY[policy] },
    }).then((value) => {
      const record = asRecord(value)
      const menu = parseSummary(record?.menu)
      const version = parseVersion(record?.version)
      if (!menu || !version) throw new Error('پاسخ تأیید واردسازی نامعتبر است.')
      return {
        menu,
        version,
        policy: typeof record?.policy === 'string' ? record.policy : IMPORT_POLICY[policy],
        impact: (record?.impact as ImportConfirmResult['impact']) ?? {
          matches: [],
          unmatchedPublished: [],
          unmatchedImported: [],
          ambiguous: [],
          activeOrderCount: 0,
          atRiskOrderCount: 0,
          atRiskOrders: [],
        },
      } satisfies ImportConfirmResult
    })
  },
}
