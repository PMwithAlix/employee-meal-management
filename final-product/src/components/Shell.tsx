import { useEffect, useState } from 'react'
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  History,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Settings,
  Sun,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { ROLE_LABEL } from '../data'
import { canOpen, useApp } from '../store'
import { fa, cn } from '../lib/text'
import type { Page, Role } from '../types'
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

const TITLES: Record<Page, string> = {
  overview: 'نمای کلی',
  menu: 'منوی ماهانه',
  orders: 'سفارش‌های من',
  menuMgmt: 'مدیریت منو',
  employees: 'مدیریت کارکنان',
  buildings: 'مدیریت ساختمان‌ها',
  groups: 'گروه‌های کارکنان',
  reports: 'گزارش‌ها',
  activity: 'تاریخچه فعالیت‌ها',
  settings: 'تنظیمات',
}

const NAV: Array<{ id: Page; label: string; group: string; icon: typeof Users }> = [
  { id: 'overview', label: 'نمای کلی', group: 'کار روزانه', icon: LayoutDashboard },
  { id: 'menu', label: 'منوی ماهانه', group: 'کار روزانه', icon: CalendarDays },
  { id: 'orders', label: 'سفارش‌های من', group: 'کار روزانه', icon: ClipboardList },
  { id: 'menuMgmt', label: 'مدیریت منو', group: 'عملیات', icon: UtensilsCrossed },
  { id: 'employees', label: 'مدیریت کارکنان', group: 'سازمان', icon: Users },
  { id: 'buildings', label: 'مدیریت ساختمان‌ها', group: 'سازمان', icon: Building2 },
  { id: 'groups', label: 'گروه‌های کارکنان', group: 'سازمان', icon: Layers },
  { id: 'reports', label: 'گزارش‌ها', group: 'نظارت', icon: BarChart3 },
  { id: 'activity', label: 'تاریخچه فعالیت‌ها', group: 'نظارت', icon: History },
  { id: 'settings', label: 'تنظیمات', group: 'سیستم', icon: Settings },
]

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
  const [notesOpen, setNotesOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const unread = app.notes.filter((note) => !note.read).length
  const visible = NAV.filter((item) => canOpen(app.role, item.id))
  const groups = [...new Set(visible.map((item) => item.group))]
  const Page = PAGES[app.page]

  useEffect(() => {
    document.title = `${TITLES[app.page]} · سامانه غذا`
  }, [app.page])

  return (
    <div className="min-h-screen bg-bg text-ink">
      {app.mobileNav && <button className="fixed inset-0 z-30 bg-overlay md:hidden" aria-label="بستن منو" onClick={() => app.setMobileNav(false)} />}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-40 flex flex-col border-s border-line bg-sidebar transition-transform md:translate-x-0',
          app.collapsed ? 'w-[72px]' : 'w-60',
          app.mobileNav ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className={cn('flex h-14 items-center gap-2 border-b border-line px-3', app.collapsed && 'justify-center')}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-sm font-semibold text-onprimary">غ</span>
          {!app.collapsed && (
            <span>
              <span className="block text-sm font-semibold leading-5">سامانه غذا</span>
              <span className="block text-[11px] text-muted">سفارش ماهانه</span>
            </span>
          )}
        </div>
        <nav className="flex-1 overflow-auto px-2 py-3">
          {groups.map((group) => (
            <div key={group} className="mb-3">
              {!app.collapsed && <p className="px-2 pb-1 text-[11px] text-muted">{group}</p>}
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
                      onClick={() => app.setPage(item.id)}
                      className={cn(
                        'mb-0.5 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm',
                        active ? 'bg-selected font-medium text-link shadow-[inset_-2px_0_0_var(--link)]' : 'text-ink hover:bg-surface2',
                        app.collapsed && 'justify-center px-0',
                      )}
                    >
                      <Icon size={16} aria-hidden />
                      {!app.collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  )
                })}
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-2">
          <div className={cn('rounded-md border border-dashed border-line p-2', app.collapsed && 'px-1')}>
            {!app.collapsed && <p className="mb-1 text-[11px] leading-4 text-muted">پیش‌نمایش نقش، فقط در این نمونه</p>}
            <select
              aria-label="پیش‌نمایش نقش"
              title="پیش‌نمایش نقش"
              value={app.role}
              onChange={(event) => app.setRole(event.target.value as Role)}
              className="h-8 w-full rounded-md border border-line bg-surface px-1 text-xs"
            >
              {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
                <option key={role} value={role}>{ROLE_LABEL[role]}</option>
              ))}
            </select>
          </div>
        </div>
      </aside>

      <div className={cn('min-h-screen', app.collapsed ? 'md:mr-[72px]' : 'md:mr-60')}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-bg/95 px-3 backdrop-blur md:px-5">
          <button className="rounded-md p-2 md:hidden" aria-label="باز کردن منو" onClick={() => app.setMobileNav(true)}>
            <Menu size={18} />
          </button>
          <button className="hidden rounded-md p-2 md:inline-flex" aria-label={app.collapsed ? 'باز کردن نوار کناری' : 'جمع کردن نوار کناری'} title={app.collapsed ? 'باز کردن نوار کناری' : 'جمع کردن نوار کناری'} onClick={() => app.setCollapsed(!app.collapsed)}>
            {app.collapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{TITLES[app.page]}</h1>
            <p className="truncate text-[11px] text-muted">{app.monthTitle}</p>
          </div>
          <div className="ms-auto flex items-center gap-1">
            <button
              className="rounded-md p-2"
              aria-label={app.theme === 'dark' ? 'زمینه روشن' : 'زمینه تیره'}
              title={app.theme === 'dark' ? 'زمینه روشن' : 'زمینه تیره'}
              onClick={() => app.setTheme(app.theme === 'dark' ? 'light' : 'dark')}
            >
              {app.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="relative">
              <button className="relative rounded-md p-2" aria-label="اعلان‌ها" title="اعلان‌ها" onClick={() => { setNotesOpen((value) => !value); setProfileOpen(false) }}>
                <Bell size={16} />
                {unread > 0 && <span className="absolute left-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] text-onprimary">{fa(unread)}</span>}
              </button>
              {notesOpen && (
                <div className="absolute end-0 z-30 mt-1 w-[min(22rem,calc(100vw-1.5rem))] rounded-md border border-line bg-surface p-2 shadow-card">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="text-sm font-medium">اعلان‌ها</p>
                    <button className="text-xs text-link" onClick={app.markAllNotes}>خواندن همه</button>
                  </div>
                  <div className="max-h-80 space-y-1 overflow-auto">
                    {app.notes.map((note) => (
                      <button
                        key={note.id}
                        className={cn('block w-full rounded-md px-2 py-2 text-start hover:bg-surface2', !note.read && 'bg-infobg')}
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
              <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface" onClick={() => { setProfileOpen((value) => !value); setNotesOpen(false) }}>
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
                  <button className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-2 hover:bg-surface2" onClick={app.logout}>
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
        <main className="mx-auto w-full max-w-6xl px-3 py-4 md:px-6 md:py-6">
          <Page />
        </main>
      </div>
      <div className="fixed bottom-4 start-4 z-50 space-y-2">
        {app.toasts.map((item) => (
          <div key={item.id} className="rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-card">{item.text}</div>
        ))}
      </div>
    </div>
  )
}
