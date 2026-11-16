import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthRequestError } from '../../auth/lib/auth-errors'
import type { MealKind } from '../../../shared/types/domain'
import { menuApi } from '../api/menus-api'
import { daysFromVersion, patchOptions, sameOptions, toBackendMeal } from '../lib/menu-mapper'
import type { MenuDay, MenuOption, MenuSummary, MenuVersionDetail } from '../model/menu-types'

export type ManagedLoadState = 'loading' | 'ready' | 'unavailable' | 'forbidden' | 'error'
export type MenuSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type PendingMeal = {
  day: MenuDay
  meal: MealKind
  options: MenuOption[]
}

async function ensureLive(year: number, month: number, signal?: AbortSignal) {
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
  const latestSummary = versions.reduce<typeof versions[number] | undefined>(
    (best, item) => !best || item.versionNumber > best.versionNumber ? item : best,
    undefined,
  )
  const draft = latestSummary
    ? await menuApi.getVersion(menu.id, latestSummary.id, signal)
    : await menuApi.createVersion(menu.id, null)
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
  const busy = false
  const [saveStatus, setSaveStatus] = useState<MenuSaveStatus>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [announceBusy, setAnnounceBusy] = useState(false)
  const [boot, setBoot] = useState(0)
  const request = useRef(0)
  const menuRef = useRef(menu)
  const draftRef = useRef(draft)
  const daysRef = useRef(days)
  const pending = useRef(new Map<string, PendingMeal>())
  const flushing = useRef<Promise<void> | null>(null)
  const failed = useRef<PendingMeal | null>(null)
  const failedMessage = useRef('')
  menuRef.current = menu
  draftRef.current = draft
  daysRef.current = days

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
    setSaveStatus('idle')
    setSaveMessage('')
    pending.current.clear()
    failed.current = null
    failedMessage.current = ''
    flushing.current = null
    void ensureLive(year, month, controller.signal)
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
        setMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری منو انجام نشد.')
        setIssues(error instanceof AuthRequestError ? error.issues : [])
      })
    return () => controller.abort()
  }, [applyDraft, boot, month, year])

  const retry = useCallback(() => setBoot((value) => value + 1), [])

  const runFlush = useCallback(async () => {
    setSaveStatus('saving')
    setSaveMessage('')
    while (pending.current.size > 0) {
      const [key, job] = pending.current.entries().next().value as [string, PendingMeal]
      pending.current.delete(key)
      const currentMenu = menuRef.current
      const currentDraft = draftRef.current
      if (!currentMenu || !currentDraft) {
        failed.current = job
        setSaveStatus('error')
        setSaveMessage('منوی جاری برای ذخیره در دسترس نیست.')
        return
      }
      try {
        const next = await menuApi.patchMeal(currentMenu.id, currentDraft.id, {
          mealDate: job.day.mealDate,
          mealType: toBackendMeal(job.meal),
          options: patchOptions(job.options),
        })
        if (request.current && currentMenu.jalaliYear === year && currentMenu.jalaliMonth === month) {
          setDraft(next)
          setDays(daysFromVersion(year, month, next))
        }
        failed.current = null
        failedMessage.current = ''
      } catch (error) {
        failed.current = job
        const message = error instanceof AuthRequestError ? error.message : 'ذخیره وعده انجام نشد.'
        failedMessage.current = message
        setSaveStatus('error')
        setSaveMessage(message)
        setIssues(error instanceof AuthRequestError ? error.issues : [])
        return
      }
    }
    setSaveStatus('saved')
    setSaveMessage('ذخیره شد')
  }, [month, year])

  const flushSaves = useCallback(async () => {
    if (flushing.current) {
      await flushing.current
      if (pending.current.size > 0) await flushSaves()
      return
    }
    const work = runFlush().finally(() => {
      if (flushing.current === work) flushing.current = null
    })
    flushing.current = work
    await work
    if (pending.current.size > 0) await flushSaves()
  }, [runFlush])

  const saveMeal = useCallback(
    async (day: MenuDay, meal: MealKind, options: MenuOption[]) => {
      const current = daysRef.current.find((item) => item.jd === day.jd)
      const existing = meal === 'lunch' ? current?.lunch ?? [] : current?.dinner ?? []
      if (sameOptions(existing, options)) return
      const key = `${day.mealDate}:${meal}`
      pending.current.set(key, { day, meal, options })
      setIssues([])
      await flushSaves()
      if (failed.current && `${failed.current.day.mealDate}:${failed.current.meal}` === key) {
        throw new Error(failedMessage.current || 'ذخیره وعده انجام نشد.')
      }
    },
    [flushSaves],
  )

  const retrySave = useCallback(async () => {
    if (!failed.current) return
    const job = failed.current
    pending.current.set(`${job.day.mealDate}:${job.meal}`, job)
    await flushSaves()
  }, [flushSaves])

  const announce = useCallback(
    async (payload: { title: string; body: string }) => {
      if (!menu || announceBusy) return null
      setAnnounceBusy(true)
      setMessage('')
      setIssues([])
      try {
        const result = await menuApi.announce(menu.id, payload)
        setMenu((current) =>
          current && current.id === result.id
            ? {
                ...current,
                lastAnnouncedAt: result.lastAnnouncedAt ?? null,
                lastAnnouncedBy: result.lastAnnouncedBy ?? null,
              }
            : current,
        )
        return result
      } catch (error) {
        setMessage(error instanceof AuthRequestError ? error.message : 'ارسال اعلام منو انجام نشد.')
        setIssues(error instanceof AuthRequestError ? error.issues : [])
        throw error
      } finally {
        setAnnounceBusy(false)
      }
    },
    [announceBusy, menu],
  )

  const reload = useCallback(async () => {
    const result = await ensureLive(year, month)
    applyDraft(result.menu, result.draft)
  }, [applyDraft, month, year])

  return {
    status,
    message,
    issues,
    menu,
    draft,
    days,
    busy,
    saveStatus,
    saveMessage,
    announceBusy,
    retry,
    saveMeal,
    retrySave,
    announce,
    reload,
  }
}
