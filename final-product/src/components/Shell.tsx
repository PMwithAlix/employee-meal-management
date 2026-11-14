import { useEffect, useState } from 'react'
import {
  Bell,
  LogOut,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Sun,
  X,
} from 'lucide-react'
import { ROLE_LABEL } from '../data'
import { usernameInitials } from '../lib/credentials'
import { canAccess, ROLES } from '../permissions'
import { NAV_ITEMS, pageTitle } from '../navigation'
import { useApp } from '../store'
import { cn } from '../lib/text'
import { AuthRequestError } from '../auth/errors'
import { notificationApi, type NotificationItem } from '../notifications/client'
import type { Role } from '../types'
import { BottomNav } from './BottomNav'
import { OverviewPage } from '../pages/Overview'
import { MonthlyMenuPage } from '../pages/MonthlyMenu'
import { MyOrdersPage } from '../pages/MyOrders'
import { MenuManagementPage } from '../pages/MenuManagement'
import { EmployeesPage } from '../pages/Employees'
import { BuildingsPage } from '../pages/Buildings'
import { GroupsPage } from '../pages/Groups'
import { ReportsPage } from '../pages/Reports'
import { ActivityPage } from '../pages/Activity'
import { SettingsPage } from '../pages/Settings'
import { BrandIcon, BrandWordmark, BRAND_NAME } from './Brand'

function useIsDesktop() {
  const query = '(min-width: 768px)'
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setDesktop(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return desktop
}

const PAGES = {
  overview: OverviewPage,
  menu: MonthlyMenuPage,
  orders: MyOrdersPage,
  menuMgmt: MenuManagementPage,
  employees: EmployeesPage,
  buildings: BuildingsPage,
  groups: GroupsPage,
  reports: ReportsPage,
  activity: ActivityPage,
  settings: SettingsPage,
}

export function Shell() {
  const app = useApp()
  const desktop = useIsDesktop()
  const [notesOpen, setNotesOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationRefresh, setNotificationRefresh] = useState(0)
  const [notificationStatus, setNotificationStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const visible = NAV_ITEMS.filter((item) => canAccess(app.role, item.id))
  const groups = [...new Set(visible.map((item) => item.group))]
  const Page = PAGES[app.page]
  const iconOnly = app.collapsed && desktop

  useEffect(() => {
    document.title = `${pageTitle(app.page, app.role)} · ${BRAND_NAME}`
  }, [app.page, app.role])

  useEffect(() => {
    if (desktop && app.mobileNav) app.setMobileNav(false)
  }, [desktop, app.mobileNav, app.setMobileNav])

  useEffect(() => {
    const controller = new AbortController()
    setNotificationStatus('loading')
    setNotificationMessage('')
    void notificationApi.list({ page: 1, pageSize: 20 }, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setNotificationItems(result.items)
      setUnreadNotificationCount(result.unreadCount)
      setNotificationStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setNotificationStatus('error')
      setNotificationMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری اعلان‌ها انجام نشد.')
    })
    return () => controller.abort()
  }, [notificationRefresh])

  async function markNotificationRead(id: string) {
    const current = notificationItems.find((item) => item.id === id)
    if (!current || current.readAt) return
    try {
      const updated = await notificationApi.markRead(id)
      setNotificationItems((items) => items.map((item) => item.id === id ? updated : item))
      setUnreadNotificationCount((count) => Math.max(0, count - 1))
    } catch (error) {
      setNotificationMessage(error instanceof AuthRequestError ? error.message : 'علامت‌گذاری اعلان انجام نشد.')
    }
  }

  async function markAllNotificationsRead() {
    if (unreadNotificationCount === 0) return
    try {
      const result = await notificationApi.markAllRead()
      setNotificationItems((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? result.readAt })))
      setUnreadNotificationCount(0)
    } catch (error) {
      setNotificationMessage(error instanceof AuthRequestError ? error.message : 'علامت‌گذاری اعلان‌ها انجام نشد.')
    }
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <aside
        id="app-navigation"
        role="navigation"
        aria-label="منوی اصلی"
        className={cn(
          'fixed inset-y-0 right-0 z-40 hidden w-60 flex-col border-s border-line bg-sidebar md:flex',
          iconOnly && 'md:w-[72px]',
        )}
      >
        <div className={cn('flex h-14 shrink-0 items-center overflow-hidden border-b border-line', iconOnly ? 'justify-center px-2' : 'px-3')}>
          {iconOnly ? (
            <BrandIcon className="h-8 w-8 rounded-md" />
          ) : (
            <BrandWordmark className="h-8 max-h-8" />
          )}
        </div>
        <nav className="flex-1 overflow-auto px-2 py-3" aria-label="بخش‌های برنامه">
          {groups.map((group) => (
            <div key={group} className="mb-3">
              <p className={cn('px-2 pb-1 text-[11px] text-muted', iconOnly && 'md:sr-only')}>{group}</p>
              {visible
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon
                  const active = app.page === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={pageTitle(item.id, app.role)}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => app.setPage(item.id)}
                      className={cn(
                        'mb-0.5 flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm',
                        active ? 'bg-selected font-medium text-link shadow-[inset_-2px_0_0_var(--link)]' : 'text-ink hover:bg-surface2',
                        iconOnly && 'md:justify-center md:px-0',
                      )}
                    >
                      <Icon size={16} aria-hidden />
                      <span className={cn('truncate', iconOnly && 'md:sr-only')}>{pageTitle(item.id, app.role)}</span>
                    </button>
                  )
                })}
            </div>
          ))}
        </nav>
        {import.meta.env.DEV && (
          <div className="border-t border-line p-2">
            <div className={cn('rounded-md border border-dashed border-line p-2', iconOnly && 'md:px-1')}>
              <p className={cn('mb-1 text-[11px] leading-4 text-muted', iconOnly && 'md:sr-only')}>پیش‌نمایش نقش، فقط در توسعه</p>
              <select
                aria-label="پیش‌نمایش نقش"
                title="پیش‌نمایش نقش"
                value={app.role}
                onChange={(event) => app.setRole(event.target.value as Role)}
                className="h-11 w-full rounded-md border border-line bg-surface px-1 text-xs"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>{ROLE_LABEL[role]}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </aside>

      <div className={cn('min-h-screen min-w-0', app.collapsed ? 'md:mr-[72px]' : 'md:mr-60')}>
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-2 border-b border-line bg-bg/95 px-3 py-1 backdrop-blur md:px-5">
          <button className="hidden h-11 w-11 shrink-0 place-items-center rounded-md md:grid" aria-label={app.collapsed ? 'باز کردن نوار کناری' : 'جمع کردن نوار کناری'} title={app.collapsed ? 'باز کردن نوار کناری' : 'جمع کردن نوار کناری'} onClick={() => app.setCollapsed(!app.collapsed)}>
            {app.collapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
          </button>
          <BrandIcon className="h-8 w-8 shrink-0 rounded-md md:hidden" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">{pageTitle(app.page, app.role)}</h1>
            <div className="flex items-center gap-1">
              <button type="button" className="min-h-11 rounded-md px-2 text-xs text-link" onClick={() => app.shiftMonth(-1)}>ماه قبل</button>
              <p className="truncate text-[11px] text-muted">{app.monthTitle}</p>
              <button type="button" className="min-h-11 rounded-md px-2 text-xs text-link" onClick={() => app.shiftMonth(1)}>ماه بعد</button>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md"
              aria-label={app.theme === 'dark' ? 'زمینه روشن' : 'زمینه تیره'}
              title={app.theme === 'dark' ? 'زمینه روشن' : 'زمینه تیره'}
              onClick={() => app.setTheme(app.theme === 'dark' ? 'light' : 'dark')}
            >
              {app.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="relative">
              <button
                className="relative grid h-11 w-11 shrink-0 place-items-center rounded-md"
                aria-label={unreadNotificationCount > 0 ? 'اعلان‌ها، ' + unreadNotificationCount + ' خوانده‌نشده' : 'اعلان‌ها'}
                title="اعلان‌ها"
                aria-expanded={notesOpen}
                onClick={() => {
                  const opening = !notesOpen
                  setNotesOpen(opening)
                  setProfileOpen(false)
                  if (opening) setNotificationRefresh((value) => value + 1)
                }}
              >
                <Bell size={16} />
                {unreadNotificationCount > 0 && (
                  <span className="absolute left-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] text-onprimary">
                    {unreadNotificationCount > 99 ? '۹۹+' : unreadNotificationCount.toLocaleString('fa-IR')}
                  </span>
                )}
              </button>
              {notesOpen && (
                <div className="absolute end-0 z-30 mt-1 w-[min(22rem,calc(100vw-1.5rem))] rounded-md border border-line bg-surface p-2 shadow-card">
                  <div className="mb-2 flex items-center justify-between gap-2 px-1">
                    <p className="text-sm font-medium">اعلان‌ها</p>
                    <button
                      type="button"
                      className="min-h-9 px-2 text-xs text-link disabled:opacity-50"
                      disabled={notificationStatus !== 'ready' || unreadNotificationCount === 0}
                      onClick={() => void markAllNotificationsRead()}
                    >
                      خواندن همه
                    </button>
                  </div>
                  {notificationStatus === 'loading' && <p className="px-2 py-4 text-sm text-muted">در حال بارگذاری اعلان‌ها…</p>}
                  {notificationStatus === 'ready' && notificationMessage && <p className="px-2 py-2 text-xs text-danger">{notificationMessage}</p>}
                  {notificationStatus === 'error' && (
                    <div className="px-2 py-3">
                      <p className="text-sm text-danger">{notificationMessage}</p>
                      <button type="button" className="mt-2 min-h-9 text-xs text-link" onClick={() => setNotificationRefresh((value) => value + 1)}>تلاش دوباره</button>
                    </div>
                  )}
                  {notificationStatus === 'ready' && notificationItems.length === 0 && (
                    <p className="px-2 py-4 text-sm text-muted">اعلانی برای این حساب ثبت نشده است.</p>
                  )}
                  {notificationStatus === 'ready' && notificationItems.length > 0 && (
                    <div className="max-h-80 space-y-1 overflow-auto">
                      {notificationItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={cn('block min-h-11 w-full rounded-md px-2 py-2 text-start hover:bg-surface2', !item.readAt && 'bg-infobg')}
                          onClick={() => void markNotificationRead(item.id)}
                          disabled={Boolean(item.readAt)}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{item.title}</span>
                            {!item.readAt && <span className="shrink-0 text-[11px] text-info">جدید</span>}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted">{item.body}</span>
                          <span className="mt-1 block text-[11px] text-muted">{formatNotificationDate(item.createdAt)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <button className="flex h-11 shrink-0 items-center gap-2 rounded-md px-1.5 hover:bg-surface" aria-label="حساب" aria-expanded={profileOpen} onClick={() => { setProfileOpen((value) => !value); setNotesOpen(false) }}>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-surface2 text-[11px]">{usernameInitials(app.personaUsername)}</span>
                <span className="hidden min-w-0 text-start sm:block">
                  <span className="block truncate text-xs font-medium leading-4" dir="ltr">{app.personaUsername}</span>
                  <span className="block text-[11px] leading-4 text-muted">{ROLE_LABEL[app.role]}</span>
                </span>
              </button>
              {profileOpen && (
                <div className="absolute end-0 z-30 mt-1 w-[min(18rem,calc(100vw-1.5rem))] rounded-md border border-line bg-surface p-2 text-sm shadow-card">
                  <div className="flex items-center gap-2 px-2 py-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface2 text-sm">{usernameInitials(app.personaUsername)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium" dir="ltr">{app.personaUsername}</span>
                    </span>
                  </div>
                  <p className="px-2 text-xs text-muted">{ROLE_LABEL[app.role]}</p>
                  <p className="px-2 pb-1 text-xs text-muted">{app.buildingName}</p>
                  <button
                    className="mt-1 flex min-h-11 w-full items-center rounded-md px-2 py-2 hover:bg-surface2"
                    onClick={() => {
                      app.setPage('settings')
                      setProfileOpen(false)
                    }}
                  >
                    حساب کاربری
                  </button>
                  <button className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 hover:bg-surface2" onClick={app.logout}>
                    <LogOut size={14} /> خروج
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {(notesOpen || profileOpen) && (
          <button className="fixed inset-0 z-10" aria-label="بستن" onClick={() => { setNotesOpen(false); setProfileOpen(false) }}>
            <X className="sr-only" />
          </button>
        )}
        <main className="mx-auto w-full max-w-6xl px-3 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] pt-4 md:px-6 md:pb-6 md:pt-6">
          <Page />
        </main>
      </div>
      <BottomNav />
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] start-4 z-50 space-y-2 md:bottom-4">
        {app.toasts.map((item) => (
          <div key={item.id} className="rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-card">{item.text}</div>
        ))}
      </div>
    </div>
  )
}

function formatNotificationDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}
