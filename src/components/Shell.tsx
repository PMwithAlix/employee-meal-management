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
import { PERSONA_ID, ROLE_LABEL } from '../data'
import { canAccess, ROLES } from '../permissions'
import { NAV_ITEMS, PAGE_TITLES } from '../navigation'
import { useApp } from '../store'
import { fa, cn } from '../lib/text'
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
  const visibleNotes = app.notes.filter((note) => !note.employeeId || note.employeeId === PERSONA_ID[app.role])
  const unread = visibleNotes.filter((note) => !note.read).length
  const visible = NAV_ITEMS.filter((item) => canAccess(app.role, item.id))
  const groups = [...new Set(visible.map((item) => item.group))]
  const Page = PAGES[app.page]
  const iconOnly = app.collapsed && desktop

  useEffect(() => {
    document.title = `${PAGE_TITLES[app.page]} · سامانه غذا`
  }, [app.page])

  useEffect(() => {
    if (desktop && app.mobileNav) app.setMobileNav(false)
  }, [desktop, app.mobileNav, app.setMobileNav])

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
        <div className={cn('flex h-14 items-center gap-2 border-b border-line px-3', iconOnly && 'md:justify-center md:px-2')}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-sm font-semibold text-onprimary">غ</span>
          <span className={cn('min-w-0', iconOnly && 'md:hidden')}>
            <span className="block truncate text-sm font-semibold leading-5">سامانه غذا</span>
            <span className="block truncate text-[11px] text-muted">سفارش ماهانه</span>
          </span>
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
                      title={item.label}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => app.setPage(item.id)}
                      className={cn(
                        'mb-0.5 flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm',
                        active ? 'bg-selected font-medium text-link shadow-[inset_-2px_0_0_var(--link)]' : 'text-ink hover:bg-surface2',
                        iconOnly && 'md:justify-center md:px-0',
                      )}
                    >
                      <Icon size={16} aria-hidden />
                      <span className={cn('truncate', iconOnly && 'md:sr-only')}>{item.label}</span>
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
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">{PAGE_TITLES[app.page]}</h1>
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
              <button className="relative grid h-11 w-11 shrink-0 place-items-center rounded-md" aria-label="اعلان‌ها" title="اعلان‌ها" onClick={() => { setNotesOpen((value) => !value); setProfileOpen(false) }}>
                <Bell size={16} />
                {unread > 0 && <span className="absolute left-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] text-onprimary">{fa(unread)}</span>}
              </button>
              {notesOpen && (
                <div className="absolute end-0 z-30 mt-1 w-[min(22rem,calc(100vw-1.5rem))] rounded-md border border-line bg-surface p-2 shadow-card">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="text-sm font-medium">اعلان‌ها</p>
                    <button className="min-h-11 px-2 text-xs text-link" onClick={app.markAllNotes}>خواندن همه</button>
                  </div>
                  <div className="max-h-80 space-y-1 overflow-auto">
                    {visibleNotes.map((note) => (
                      <button
                        key={note.id}
                        className={cn('block min-h-11 w-full rounded-md px-2 py-2 text-start hover:bg-surface2', !note.read && 'bg-infobg')}
                        onClick={() => {
                          app.markNote(note.id)
                          if (note.page) app.setPage(note.page)
                          setNotesOpen(false)
                        }}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{note.title}</span>
                          {!note.read && <span className="text-[11px] text-info">جدید</span>}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">{note.body}</span>
                        <span className="mt-1 block text-[11px] text-muted">{note.at}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button className="flex h-11 shrink-0 items-center gap-2 rounded-md px-1.5 hover:bg-surface" aria-label="حساب" onClick={() => { setProfileOpen((value) => !value); setNotesOpen(false) }}>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-surface2 text-xs">{app.personaName.slice(0, 1)}</span>
                <span className="hidden text-start sm:block">
                  <span className="block text-xs font-medium leading-4">{app.personaName}</span>
                  <span className="block text-[11px] leading-4 text-muted">{ROLE_LABEL[app.role]}</span>
                </span>
              </button>
              {profileOpen && (
                <div className="absolute end-0 z-30 mt-1 w-56 rounded-md border border-line bg-surface p-2 text-sm shadow-card">
                  <p className="px-2 py-1 font-medium">{app.personaName}</p>
                  <p className="px-2 text-xs text-muted">{ROLE_LABEL[app.role]} · {app.buildingName}</p>
                  <button className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 hover:bg-surface2" onClick={app.logout}>
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
