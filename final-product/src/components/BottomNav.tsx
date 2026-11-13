import { useEffect, useRef, useState } from 'react'
import { Ellipsis } from 'lucide-react'
import { ROLE_LABEL } from '../data'
import { moreNavPages, navIcon, pageTitle, primaryNavPages } from '../navigation'
import { ROLES } from '../permissions'
import { useApp } from '../store'
import { cn } from '../lib/text'
import type { Page, Role } from '../types'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusableElements(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    if (element.getAttribute('aria-hidden') === 'true') return false
    const style = getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
}

function canRestoreFocus(element: HTMLElement | null): element is HTMLElement {
  if (!element?.isConnected || window.matchMedia('(min-width: 768px)').matches) return false
  if (element.hasAttribute('disabled')) return false
  if (element.getAttribute('aria-hidden') === 'true') return false
  const style = getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  return element.getClientRects().length > 0
}

export function BottomNav() {
  const app = useApp()
  const primary = primaryNavPages(app.role)
  const more = moreNavPages(app.role)
  const [open, setOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const moreActive = more.includes(app.page)

  useEffect(() => {
    setOpen(false)
  }, [app.role])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const onChange = () => {
      if (media.matches) setOpen(false)
    }
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!open) return
    const sheet = sheetRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const items = sheet ? focusableElements(sheet) : []
    ;(items[0] ?? sheet)?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== 'Tab' || !sheet) return
      const current = focusableElements(sheet)
      if (current.length === 0) {
        event.preventDefault()
        sheet.focus()
        return
      }
      const first = current[0]
      const last = current[current.length - 1]
      const active = document.activeElement
      const inside = active instanceof Node && sheet.contains(active)
      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault()
          last.focus()
        }
        return
      }
      if (!inside || active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      const trigger = moreButtonRef.current
      if (canRestoreFocus(trigger)) trigger.focus()
    }
  }, [open])

  function go(page: Page) {
    app.setPage(page)
    setOpen(false)
  }

  const slots = more.length ? primary.length + 1 : primary.length

  return (
    <>
      {open && (
        <button type="button" className="fixed inset-0 z-30 bg-overlay md:hidden" aria-label="بستن صفحات بیشتر" onClick={() => setOpen(false)} />
      )}
      {open && (
        <div
          ref={sheetRef}
          id="more-pages"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="صفحات بیشتر"
          className="fixed inset-x-0 z-40 mx-2 mb-2 rounded-lg border border-line bg-surface p-2 shadow-card outline-none md:hidden"
          style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <p className="px-2 pb-2 pt-1 text-xs text-muted">صفحات دیگر این نقش</p>
          <ul className="space-y-1">
            {more.map((page) => {
              const Icon = navIcon(page)
              const active = app.page === page
              return (
                <li key={page}>
                  <button
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => go(page)}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-sm',
                      active ? 'bg-selected font-medium text-link' : 'text-ink hover:bg-surface2',
                    )}
                  >
                    <Icon size={16} aria-hidden />
                    {pageTitle(page, app.role)}
                  </button>
                </li>
              )
            })}
          </ul>
          {import.meta.env.DEV && (
            <div className="mt-2 border-t border-dashed border-line p-2">
              <p className="mb-1 text-[11px] text-muted">پیش‌نمایش نقش، فقط در توسعه</p>
              <select
                aria-label="پیش‌نمایش نقش"
                value={app.role}
                onChange={(event) => app.setRole(event.target.value as Role)}
                className="h-11 w-full rounded-md border border-line bg-bg px-2 text-sm"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden"
        aria-label="ناوبری اصلی"
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
          {primary.map((page) => {
            const Icon = navIcon(page)
            const active = app.page === page
            return (
              <li key={page}>
                <button
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => go(page)}
                  className={cn(
                    'flex min-h-11 w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] leading-tight',
                    active ? 'font-medium text-link' : 'text-muted',
                  )}
                >
                  <Icon size={18} aria-hidden />
                  <span className="line-clamp-2 text-center">{pageTitle(page, app.role)}</span>
                </button>
              </li>
            )
          })}
          {more.length > 0 && (
            <li>
              <button
                ref={moreButtonRef}
                type="button"
                aria-label="بیشتر"
                aria-expanded={open}
                aria-controls={open ? 'more-pages' : undefined}
                onClick={() => setOpen((value) => !value)}
                className={cn(
                  'flex min-h-11 w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] leading-tight',
                  moreActive || open ? 'font-medium text-link' : 'text-muted',
                )}
              >
                <Ellipsis size={18} aria-hidden />
                <span>بیشتر</span>
              </button>
            </li>
          )}
        </ul>
      </nav>
    </>
  )
}
