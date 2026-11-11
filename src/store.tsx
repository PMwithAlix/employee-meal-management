import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createSnapshot, fullName, MONTH_TITLE, PERSONA_ID, PREVIEW_MENU, ROLE_LABEL, TODAY } from './data'
import { fa } from './lib/text'
import type {
  ActivityItem,
  Employee,
  FeedItem,
  GuestOrder,
  ImportedFile,
  MealKind,
  MenuQuery,
  MenuView,
  Note,
  Page,
  ReplacePolicy,
  Role,
} from './types'

interface Toast {
  id: string
  text: string
}

interface StoreValue {
  role: Role
  theme: 'light' | 'dark'
  page: Page
  collapsed: boolean
  mobileNav: boolean
  menuView: MenuView
  menuQuery: MenuQuery
  deadlineHour: number
  monthTitle: string
  today: number
  buildings: ReturnType<typeof createSnapshot>['buildings']
  groups: ReturnType<typeof createSnapshot>['groups']
  employees: Employee[]
  days: ReturnType<typeof createSnapshot>['days']
  orders: ReturnType<typeof createSnapshot>['orders']
  guests: GuestOrder[]
  activity: ActivityItem[]
  notes: Note[]
  feed: FeedItem[]
  past: ReturnType<typeof createSnapshot>['past']
  importedFile: ImportedFile | null
  toasts: Toast[]
  personaId: string | null
  personaName: string
  buildingName: string
  setRole: (role: Role) => void
  setTheme: (theme: 'light' | 'dark') => void
  setPage: (page: Page) => void
  setCollapsed: (value: boolean) => void
  setMobileNav: (value: boolean) => void
  setMenuView: (view: MenuView) => void
  setMenuQuery: (query: Partial<MenuQuery>) => void
  clearMenuQuery: () => void
  setDeadlineHour: (hour: number) => void
  selectMeal: (employeeId: string, jd: number, meal: MealKind, choice: string | null, scope: 'self' | 'ops') => void
  rateMeal: (orderId: string, score: number, comment: string) => void
  saveEmployee: (input: Omit<Employee, 'id' | 'created' | 'active'> & { id?: string }) => string | null
  setEmployeeActive: (id: string, active: boolean) => void
  saveBuilding: (name: string, id?: string) => string | undefined
  assignBuilding: (employeeId: string, buildingId: string) => void
  saveGroup: (name: string, id?: string) => void
  setMembership: (groupId: string, employeeId: string, member: boolean) => void
  addGuest: (guest: Omit<GuestOrder, 'id'>) => void
  removeGuest: (id: string) => void
  updateDayOptions: (jd: number, meal: MealKind, options: string[]) => void
  setImportedFile: (file: ImportedFile | null) => void
  applyImport: (policy: ReplacePolicy) => { affected: number; keptOutside: number }
  previewImpact: (policy: ReplacePolicy) => { affected: number; keptOutside: number }
  markNote: (id: string) => void
  markAllNotes: () => void
  logout: () => void
}

const StoreContext = createContext<StoreValue | null>(null)
const emptyQuery: MenuQuery = { meal: 'all', status: 'all', q: '' }

const NAV_ROLES: Record<Page, Role[]> = {
  overview: ['employee', 'hr', 'support', 'management', 'admin'],
  menu: ['employee', 'hr', 'support', 'admin'],
  orders: ['employee', 'hr', 'support', 'admin'],
  menuMgmt: ['support', 'admin'],
  employees: ['hr', 'admin'],
  buildings: ['hr', 'admin'],
  groups: ['hr', 'admin'],
  reports: ['support', 'management', 'admin'],
  activity: ['support', 'management', 'admin'],
  settings: ['employee', 'hr', 'support', 'management', 'admin'],
}

export function canOpen(role: Role, page: Page) {
  return NAV_ROLES[page].includes(role)
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

export function StoreProvider({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const initial = useMemo(() => createSnapshot(), [])
  const [role, setRoleState] = useState<Role>('employee')
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => (localStorage.getItem('meal-theme') === 'dark' ? 'dark' : 'light'))
  const [page, setPageState] = useState<Page>('overview')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [menuView, setMenuView] = useState<MenuView>('list')
  const [menuQuery, setMenuQueryState] = useState<MenuQuery>(emptyQuery)
  const [deadlineHour, setDeadlineHourState] = useState(10)
  const [buildings, setBuildings] = useState(initial.buildings)
  const [groups, setGroups] = useState(initial.groups)
  const [employees, setEmployees] = useState(initial.employees)
  const [days, setDays] = useState(initial.days)
  const [orders, setOrders] = useState(initial.orders)
  const [guests, setGuests] = useState(initial.guests)
  const [activity, setActivity] = useState(initial.activity)
  const [notes, setNotes] = useState(initial.notes)
  const [feed, setFeed] = useState(initial.feed)
  const [importedFile, setImportedFile] = useState<ImportedFile | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('meal-theme', theme)
  }, [theme])

  const personaId = PERSONA_ID[role]
  const persona = employees.find((item) => item.id === personaId) ?? null
  const personaName = persona ? fullName(persona) : 'مدیر سامانه'
  const buildingName = persona ? buildings.find((item) => item.id === persona.buildingId)?.name ?? '—' : 'بدون ساختمان'

  function toast(text: string) {
    const id = uid('t')
    setToasts((list) => [...list, { id, text }])
    window.setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 2200)
  }

  function pushActivity(item: Omit<ActivityItem, 'id' | 'result'>) {
    setActivity((list) => [{ id: uid('a'), result: 'موفق', ...item }, ...list])
  }

  function setRole(next: Role) {
    setRoleState(next)
    setPageState((current) => (canOpen(next, current) ? current : 'overview'))
    setMobileNav(false)
  }

  function setPage(next: Page) {
    if (!canOpen(role, next)) return
    setPageState(next)
    setMobileNav(false)
  }

  function selectMeal(employeeId: string, jd: number, meal: MealKind, choice: string | null, scope: 'self' | 'ops') {
    const locked = jd < TODAY
    if (scope === 'self') {
      if (employeeId !== personaId) return
      if (locked && role !== 'support') return
    } else if (role !== 'support' && role !== 'admin') {
      return
    }
    const current = orders.find((item) => item.employeeId === employeeId && item.jd === jd && item.meal === meal)
    const employee = employees.find((item) => item.id === employeeId)
    if (!employee || (current && current.choice === choice) || (!current && choice === null)) return
    const before = current?.choice ?? 'انتخاب نشده'
    const after = choice ?? 'انتخاب نشده'
    if (!current) {
      setOrders((list) => [...list, { id: uid('o'), employeeId, buildingId: employee.buildingId, jd, meal, choice, rating: null }])
    } else {
      setOrders((list) => list.map((item) => (item.id === current.id ? { ...item, choice } : item)))
    }
    pushActivity({
      actor: personaName,
      action: scope === 'ops' || (locked && role === 'support') ? 'تغییر سفارش پس از مهلت' : 'ثبت سفارش',
      target: `${fullName(employee)} · ${meal === 'lunch' ? 'ناهار' : 'شام'} ${fa(jd)} آبان`,
      at: 'همین حالا',
      before,
      after,
    })
    if (employeeId === personaId) {
      setFeed((list) => [
        {
          id: uid('f'),
          employeeId,
          at: 'همین حالا',
          meal,
          jd,
          text: `${meal === 'lunch' ? 'ناهار' : 'شام'} ${fa(jd)} آبان: ${after}`,
        },
        ...list,
      ])
    } else if (employee) {
      setNotes((list) => [
        {
          id: uid('n'),
          title: 'سفارش یک کارمند تغییر کرد',
          body: `${personaName} ${meal === 'lunch' ? 'ناهار' : 'شام'} ${fa(jd)} آبان ${fullName(employee)} را به «${after}» تغییر داد.`,
          at: 'همین حالا',
          read: false,
          page: 'menuMgmt',
        },
        ...list,
      ])
    }
    toast('ذخیره شد')
  }

  function rateMeal(orderId: string, score: number, comment: string) {
    const order = orders.find((item) => item.id === orderId)
    if (!order || order.employeeId !== personaId || order.jd >= TODAY || !order.choice) return
    setOrders((list) => list.map((item) => (item.id === orderId ? { ...item, rating: { score, comment: comment.trim() } } : item)))
    pushActivity({
      actor: personaName,
      action: order.rating ? 'ویرایش دیدگاه' : 'ثبت دیدگاه',
      target: `${order.meal === 'lunch' ? 'ناهار' : 'شام'} ${fa(order.jd)} آبان`,
      at: 'همین حالا',
      before: order.rating ? `${order.rating.score} از ۵` : '—',
      after: `${score} از ۵`,
    })
    toast('ذخیره شد')
  }

  function saveEmployee(input: Omit<Employee, 'id' | 'created' | 'active'> & { id?: string }) {
    const username = input.username.trim()
    const duplicate = employees.some((item) => item.username === username && item.id !== input.id)
    if (!input.firstName.trim() || !input.lastName.trim() || !username || !input.buildingId || duplicate) return 'نام، نام خانوادگی، نام کاربری یکتا و ساختمان لازم است.'
    if (input.id) {
      const previous = employees.find((item) => item.id === input.id)
      setEmployees((list) => list.map((item) => (item.id === input.id ? { ...item, ...input, username, id: item.id } : item)))
      pushActivity({
        actor: personaName,
        action: 'ویرایش کارمند',
        target: `${input.firstName.trim()} ${input.lastName.trim()}`,
        at: 'همین حالا',
        before: previous ? fullName(previous) : '—',
        after: `${input.firstName.trim()} ${input.lastName.trim()}`,
      })
    } else {
      const id = uid('e')
      setEmployees((list) => [
        {
          id,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          username,
          buildingId: input.buildingId,
          groupIds: input.groupIds,
          active: true,
          created: '۲۱ آبان ۱۴۰۵',
        },
        ...list,
      ])
      pushActivity({
        actor: personaName,
        action: 'ایجاد حساب کارمند',
        target: `${input.firstName.trim()} ${input.lastName.trim()}`,
        at: 'همین حالا',
        before: '—',
        after: 'فعال',
      })
    }
    toast('ذخیره شد')
    return null
  }

  function setEmployeeActive(id: string, active: boolean) {
    const employee = employees.find((item) => item.id === id)
    if (!employee || employee.active === active) return
    setEmployees((list) => list.map((item) => (item.id === id ? { ...item, active } : item)))
    pushActivity({
      actor: personaName,
      action: active ? 'فعال‌سازی حساب' : 'غیرفعال‌سازی حساب',
      target: fullName(employee),
      at: 'همین حالا',
      before: employee.active ? 'فعال' : 'غیرفعال',
      after: active ? 'فعال' : 'غیرفعال',
    })
    toast(active ? 'حساب فعال شد' : 'حساب غیرفعال شد')
  }

  function saveBuilding(name: string, id?: string) {
    const clean = name.trim()
    if (!clean) return
    if (id) {
      const previous = buildings.find((item) => item.id === id)
      setBuildings((list) => list.map((item) => (item.id === id ? { ...item, name: clean } : item)))
      pushActivity({ actor: personaName, action: 'ویرایش ساختمان', target: clean, at: 'همین حالا', before: previous?.name ?? '—', after: clean })
      toast('ذخیره شد')
      return id
    }
    const nextId = uid('b')
    setBuildings((list) => [...list, { id: nextId, name: clean }])
    pushActivity({ actor: personaName, action: 'ایجاد ساختمان', target: clean, at: 'همین حالا', before: '—', after: clean })
    toast('ذخیره شد')
    return nextId
  }

  function assignBuilding(employeeId: string, buildingId: string) {
    const employee = employees.find((item) => item.id === employeeId)
    const building = buildings.find((item) => item.id === buildingId)
    if (!employee || !building || employee.buildingId === buildingId) return
    const before = buildings.find((item) => item.id === employee.buildingId)?.name ?? '—'
    setEmployees((list) => list.map((item) => (item.id === employeeId ? { ...item, buildingId } : item)))
    pushActivity({
      actor: personaName,
      action: 'انتقال ساختمان',
      target: fullName(employee),
      at: 'همین حالا',
      before,
      after: building.name,
    })
    toast('ساختمان کارمند به‌روز شد')
  }

  function saveGroup(name: string, id?: string) {
    const clean = name.trim()
    if (!clean) return
    if (id) {
      const previous = groups.find((item) => item.id === id)
      setGroups((list) => list.map((item) => (item.id === id ? { ...item, name: clean } : item)))
      pushActivity({ actor: personaName, action: 'ویرایش گروه', target: clean, at: 'همین حالا', before: previous?.name ?? '—', after: clean })
    } else {
      setGroups((list) => [...list, { id: uid('g'), name: clean }])
      pushActivity({ actor: personaName, action: 'ایجاد گروه', target: clean, at: 'همین حالا', before: '—', after: clean })
    }
    toast('ذخیره شد')
  }

  function setMembership(groupId: string, employeeId: string, member: boolean) {
    const employee = employees.find((item) => item.id === employeeId)
    const group = groups.find((item) => item.id === groupId)
    if (!employee || !group) return
    const has = employee.groupIds.includes(groupId)
    if (has === member) return
    setEmployees((list) =>
      list.map((item) =>
        item.id === employeeId
          ? { ...item, groupIds: member ? [...item.groupIds, groupId] : item.groupIds.filter((id) => id !== groupId) }
          : item,
      ),
    )
    pushActivity({
      actor: personaName,
      action: member ? 'افزودن به گروه' : 'حذف از گروه',
      target: `${fullName(employee)} · ${group.name}`,
      at: 'همین حالا',
      before: member ? 'خارج از گروه' : 'عضو گروه',
      after: member ? 'عضو گروه' : 'خارج از گروه',
    })
  }

  function addGuest(guest: Omit<GuestOrder, 'id'>) {
    setGuests((list) => [{ ...guest, id: uid('gu') }, ...list])
    const building = buildings.find((item) => item.id === guest.buildingId)?.name ?? 'ساختمان'
    pushActivity({
      actor: personaName,
      action: 'ثبت سفارش مهمان',
      target: `${building} · ${fa(guest.jd)} آبان`,
      at: 'همین حالا',
      before: '—',
      after: `${guest.count} پرس ${guest.meal === 'lunch' ? 'ناهار' : 'شام'}`,
    })
    toast('سفارش مهمان ثبت شد')
  }

  function removeGuest(id: string) {
    const guest = guests.find((item) => item.id === id)
    if (!guest) return
    setGuests((list) => list.filter((item) => item.id !== id))
    pushActivity({
      actor: personaName,
      action: 'حذف سفارش مهمان',
      target: `${fa(guest.jd)} آبان`,
      at: 'همین حالا',
      before: `${guest.count} پرس`,
      after: 'حذف شد',
    })
  }

  function updateDayOptions(jd: number, meal: MealKind, options: string[]) {
    setDays((list) => list.map((day) => (day.jd === jd ? { ...day, [meal]: options.length ? options : null } : day)))
    toast('ذخیره شد')
  }

  function impact(policy: ReplacePolicy) {
    const future = orders.filter((order) => order.choice)
    if (policy === 'reset') return { affected: future.length, keptOutside: 0 }
    const outside = future.filter((order) => {
      const day = days.find((item) => item.jd === order.jd)
      const options = order.meal === 'lunch' ? PREVIEW_MENU.lunch : PREVIEW_MENU.dinner
      return Boolean(day && day[order.meal] && order.choice && !options.includes(order.choice))
    })
    if (policy === 'match') return { affected: outside.length, keptOutside: 0 }
    return { affected: 0, keptOutside: outside.length }
  }

  function applyImport(policy: ReplacePolicy) {
    const result = impact(policy)
    setDays((list) =>
      list.map((day) => (day.lunch || day.dinner ? { ...day, lunch: day.lunch ? [...PREVIEW_MENU.lunch] : null, dinner: day.dinner ? [...PREVIEW_MENU.dinner] : null } : day)),
    )
    if (policy === 'reset') {
      setOrders((list) => list.map((order) => ({ ...order, choice: null, rating: null })))
    } else if (policy === 'match') {
      setOrders((list) =>
        list.map((order) => {
          const options = order.meal === 'lunch' ? PREVIEW_MENU.lunch : PREVIEW_MENU.dinner
          if (order.choice && !options.includes(order.choice)) return { ...order, choice: null, rating: null }
          return order
        }),
      )
    }
    pushActivity({
      actor: personaName,
      action: 'جایگزینی منو',
      target: MONTH_TITLE,
      at: 'همین حالا',
      before: 'منوی قبلی',
      after: policy === 'keep' ? 'حفظ سفارش‌ها' : policy === 'match' ? 'تطبیق سفارش‌ها' : 'بازنشانی سفارش‌ها',
    })
    toast('منوی جدید اعمال شد')
    return result
  }

  const value: StoreValue = {
    role,
    theme,
    page,
    collapsed,
    mobileNav,
    menuView,
    menuQuery,
    deadlineHour,
    monthTitle: MONTH_TITLE,
    today: TODAY,
    buildings,
    groups,
    employees,
    days,
    orders,
    guests,
    activity,
    notes,
    feed,
    past: initial.past,
    importedFile,
    toasts,
    personaId,
    personaName,
    buildingName,
    setRole,
    setTheme: setThemeState,
    setPage,
    setCollapsed,
    setMobileNav,
    setMenuView,
    setMenuQuery: (query) => setMenuQueryState((current) => ({ ...current, ...query })),
    clearMenuQuery: () => setMenuQueryState(emptyQuery),
    setDeadlineHour: setDeadlineHourState,
    selectMeal,
    rateMeal,
    saveEmployee,
    setEmployeeActive,
    saveBuilding,
    assignBuilding,
    saveGroup,
    setMembership,
    addGuest,
    removeGuest,
    updateDayOptions,
    setImportedFile,
    applyImport,
    previewImpact: impact,
    markNote: (id) => setNotes((list) => list.map((item) => (item.id === id ? { ...item, read: true } : item))),
    markAllNotes: () => setNotes((list) => list.map((item) => ({ ...item, read: true }))),
    logout: onLogout,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useApp() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('store')
  return value
}

export { ROLE_LABEL }
