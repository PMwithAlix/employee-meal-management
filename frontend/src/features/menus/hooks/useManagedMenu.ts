import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthRequestError } from '../../auth/lib/auth-errors'
import type { MealKind } from '../../../shared/types/domain'
import { menuApi } from '../api/menus-api'
import { daysFromVersion, patchOptions, toBackendMeal } from '../lib/menu-mapper'
import type { MenuDay, MenuOption, MenuSummary, MenuVersionDetail } from '../model/menu-types'

export type ManagedLoadState = 'loading' | 'ready' | 'unavailable' | 'forbidden' | 'error'

async function ensureDraft(year: number, month: number, signal?: AbortSignal) {
  const listed = await menuApi.list(year, month, signal)
  let menu: MenuSummary | null = listed.items[0] ?? null
  if (!menu) {
    try {
      menu = await menuApi.create(year, month)
    } catch (error) {
      if (error instanceof AuthRequestError && error.status === 409) {
        const again = await menuApi.list(year, month, signal)
        menu = again.items[0] ?? null
      } else {
        throw error
      }
    }
  }
  if (!menu) throw new Error('منوی این ماه ایجاد نشد.')

  const versions = await menuApi.listVersions(menu.id, signal)
  const draftSummary = versions.find((item) => item.status === 'DRAFT')
  let draft: MenuVersionDetail
  if (draftSummary) {
    draft = await menuApi.getVersion(menu.id, draftSummary.id, signal)
  } else if (menu.publishedVersionId) {
    draft = await menuApi.createVersion(menu.id)
  } else {
    draft = await menuApi.createVersion(menu.id, null)
  }
  const latest = await menuApi.get(menu.id)
  return { menu: latest, draft }
}

export function useManagedMenu(year: number, month: number) {
  const [status, setStatus] = useState<ManagedLoadState>('loading')
  const [message, setMessage] = useState('')
  const [issues, setIssues] = useState<string[]>([])
  const [menu, setMenu] = useState<MenuSummary | null>(null)
  const [draft, setDraft] = useState<MenuVersionDetail | null>(null)
  const [days, setDays] = useState<MenuDay[]>([])
  const [busy, setBusy] = useState(false)
  const [boot, setBoot] = useState(0)
  const request = useRef(0)

  const applyDraft = useCallback(
    (nextMenu: MenuSummary, nextDraft: MenuVersionDetail) => {
      if (nextMenu.jalaliYear !== year || nextMenu.jalaliMonth !== month) return
      setMenu(nextMenu)
      setDraft(nextDraft)
      setDays(daysFromVersion(year, month, nextDraft))
      setStatus('ready')
      setMessage('')
      setIssues([])
    },
    [month, year],
  )

  useEffect(() => {
    const controller = new AbortController()
    const id = ++request.current
    setStatus('loading')
    setMessage('')
    setIssues([])
    setMenu(null)
    setDraft(null)
    setDays([])
    void ensureDraft(year, month, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || id !== request.current) return
        applyDraft(result.menu, result.draft)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || id !== request.current) return
        if (error instanceof AuthRequestError && error.kind === 'network') {
          setStatus('unavailable')
          setMessage(error.message)
          return
        }
        if (error instanceof AuthRequestError && (error.status === 403 || error.kind === 'forbidden')) {
          setStatus('forbidden')
          setMessage(error.message)
          return
        }
        setStatus('error')
        setMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری پیش‌نویس منو انجام نشد.')
        setIssues(error instanceof AuthRequestError ? error.issues : [])
      })
    return () => controller.abort()
  }, [applyDraft, boot, month, year])

  const retry = useCallback(() => setBoot((value) => value + 1), [])

  const saveMeal = useCallback(
    async (day: MenuDay, meal: MealKind, options: MenuOption[]) => {
      if (!menu || !draft || draft.status !== 'DRAFT' || busy) return
      setBusy(true)
      setMessage('')
      setIssues([])
      try {
        const next = await menuApi.patchMeal(menu.id, draft.id, {
          mealDate: day.mealDate,
          mealType: toBackendMeal(meal),
          options: patchOptions(options),
        })
        if (request.current && menu.jalaliYear === year && menu.jalaliMonth === month) {
          setDraft(next)
          setDays(daysFromVersion(year, month, next))
        }
      } catch (error) {
        setMessage(error instanceof AuthRequestError ? error.message : 'ذخیره وعده انجام نشد.')
        setIssues(error instanceof AuthRequestError ? error.issues : [])
        throw error
      } finally {
        setBusy(false)
      }
    },
    [busy, draft, menu, month, year],
  )

  const publish = useCallback(async () => {
    if (!menu || !draft || draft.status !== 'DRAFT' || busy) return
    setBusy(true)
    setMessage('')
    setIssues([])
    try {
      await menuApi.publish(menu.id, draft.id)
      const result = await ensureDraft(year, month)
      applyDraft(result.menu, result.draft)
    } catch (error) {
      setMessage(error instanceof AuthRequestError ? error.message : 'انتشار منو انجام نشد.')
      setIssues(error instanceof AuthRequestError ? error.issues : [])
      throw error
    } finally {
      setBusy(false)
    }
  }, [applyDraft, busy, draft, menu, month, year])

  const reload = useCallback(async () => {
    const result = await ensureDraft(year, month)
    applyDraft(result.menu, result.draft)
  }, [applyDraft, month, year])

  return { status, message, issues, menu, draft, days, busy, retry, saveMeal, publish, reload }
}
