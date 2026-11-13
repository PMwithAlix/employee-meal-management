import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buildMonthMenu, createSnapshot, fullName, PERSONA_ID, ROLE_LABEL, SEED_MONTH } from './data'
import { defaultMonthDeadlines, formatDeadline, isOrderingOpen, type MealDeadline, type MonthDeadlines } from './lib/deadlines'
import { addMonths, currentDateTime, isPastDate, JALALI_MONTHS, monthKey, type JalaliDate, type JalaliDateTime } from './lib/jalali'
import { ADMIN_ACCOUNT_ID, normalizeUsername, passwordIssue, setSessionSecret, verifySessionSecret } from './lib/credentials'
import { fa } from './lib/text'
import { can, canAccess, LANDING_PAGE } from './permissions'
import type {
  ActivityItem,
  DayMenu,
  Employee,
  FeedItem,
  GuestOrder,
  ImportedFile,
  ImportedMenu,
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
  selectedMonth: Pick<JalaliDate, 'jy' | 'jm'>
  monthTitle: string
  now: JalaliDateTime
  deadlines: MonthDeadlines
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
  importedMenu: ImportedMenu | null
  toasts: Toast[]
  personaId: string | null
  personaName: string
  personaUsername: string
  buildingName: string
  setRole: (role: Role) => void
  setTheme: (theme: 'light' | 'dark') => void
  setPage: (page: Page) => void
  setCollapsed: (value: boolean) => void
  setMobileNav: (value: boolean) => void
  setMenuView: (view: MenuView) => void
  setMenuQuery: (query: Partial<MenuQuery>) => void
  clearMenuQuery: () => void
  shiftMonth: (delta: number) => void
  setMealDeadline: (meal: MealKind, patch: Partial<Pick<MealDeadline, 'relation' | 'hour' | 'minute'>>) => void
  selectMeal: (employeeId: string, jd: number, meal: MealKind, choice: string | null, scope: 'self' | 'ops') => boolean
  rateMeal: (orderId: string, score: number, comment: string) => boolean
  saveEmployee: (input: Omit<Employee, 'id' | 'created' | 'active'> & { id?: string; initialPassword?: string }) => string | null
  changePassword: (current: string, next: string) => string | null
  resetEmployeePassword: (employeeId: string, password: string) => string | null
  setEmployeeActive: (id: string, active: boolean) => void
  saveBuilding: (name: string, id?: string) => string | undefined
  assignBuilding: (employeeId: string, buildingId: string) => void
  saveGroup: (name: string, id?: string) => void
  setMembership: (groupId: string, employeeId: string, member: boolean) => void
  addGuest: (guest: Omit<GuestOrder, 'id' | 'jy' | 'jm'>) => void
  removeGuest: (id: string) => void
  updateDayOptions: (jd: number, meal: MealKind, options: string[]) => void
  setImportedFile: (file: ImportedFile | null, menu?: ImportedMenu | null) => void
  applyImport: (policy: ReplacePolicy) => ImportImpact
  previewImpact: (policy: ReplacePolicy) => ImportImpact
  markNote: (id: string) => void
  markAllNotes: () => void
  logout: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export interface ImportImpact {
  affected: number
  keptOutside: number
  lunch: number
  dinner: number
}
const emptyQuery: MenuQuery = { meal: 'all', status: 'all', q: '' }

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
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = currentDateTime()
    return { jy: today.jy, jm: today.jm }
  })
  const [menus, setMenus] = useState<Record<string, DayMenu[]>>(() => ({ [monthKey(SEED_MONTH)]: initial.days }))
  const [deadlinesByMonth, setDeadlinesByMonth] = useState<Record<string, MonthDeadlines>>({})
  const [now, setNow] = useState(() => currentDateTime())
  const [buildings, setBuildings] = useState(initial.buildings)
  const [groups, setGroups] = useState(initial.groups)
  const [employees, setEmployees] = useState(initial.employees)
  const [orders, setOrders] = useState(initial.orders)
  const [guests, setGuests] = useState(initial.guests)
  const [activity, setActivity] = useState(initial.activity)
  const [notes, setNotes] = useState(initial.notes)
  const [feed, setFeed] = useState(initial.feed)
  const [importedFile, setImportedFileState] = useState<ImportedFile | null>(null)
  const [importedMenu, setImportedMenu] = useState<ImportedMenu | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('meal-theme', theme)
  }, [theme])

  useEffect(() => {
    const id = window.setInterval(() => setNow(currentDateTime()), 15000)
    return () => window.clearInterval(id)
  }, [])

  const monthId = monthKey(selectedMonth)
  const days = menus[monthId] ?? buildMonthMenu(selectedMonth)
  const deadlines = deadlinesByMonth[monthId] ?? defaultMonthDeadlines()
  const monthName = JALALI_MONTHS[selectedMonth.jm - 1]

  const personaId = PERSONA_ID[role]
  const persona = employees.find((item) => item.id === personaId) ?? null
  const personaName = persona ? fullName(persona) : 'مدیر سامانه'
  const personaUsername = persona?.username ?? 'admin'
  const buildingName = persona ? buildings.find((item) => item.id === persona.buildingId)?.name ?? '—' : 'بدون ساختمان'

  function clockStamp() {
    const hour = String(now.hour).padStart(2, '0')
    const minute = String(now.minute).padStart(2, '0')
    return `${fa(now.jd)} ${JALALI_MONTHS[now.jm - 1]} ${fa(now.jy)}، ساعت ${fa(hour)}:${fa(minute)}`
  }

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
    setPageState((current) => (canAccess(next, current) ? current : LANDING_PAGE))
    setMobileNav(false)
  }

  function setPage(next: Page) {
    if (!canAccess(role, next)) return
    setPageState(next)
    setMobileNav(false)
  }

  function selectMeal(employeeId: string, jd: number, meal: MealKind, choice: string | null, scope: 'self' | 'ops') {
    const mealDate = { ...selectedMonth, jd }
    const locked = !isOrderingOpen(mealDate, deadlines[meal], now)
    if (scope === 'self') {
      if (!can(role, 'order.self') || employeeId !== personaId) return false
      if (locked && !can(role, 'order.ops')) return false
    } else if (!can(role, 'order.ops')) {
      return false
    }
    const current = orders.find((item) => item.employeeId === employeeId && item.jy === selectedMonth.jy && item.jm === selectedMonth.jm && item.jd === jd && item.meal === meal)
    const employee = employees.find((item) => item.id === employeeId)
    if (!employee || (current && current.choice === choice) || (!current && choice === null)) return false
    const before = current?.choice ?? 'انتخاب نشده'
    const after = choice ?? 'انتخاب نشده'
    if (!current) {
      setOrders((list) => [...list, { id: uid('o'), employeeId, buildingId: employee.buildingId, jy: selectedMonth.jy, jm: selectedMonth.jm, jd, meal, choice, rating: null }])
    } else {
      setOrders((list) => list.map((item) => (item.id === current.id ? { ...item, choice } : item)))
    }
    pushActivity({
      actor: personaName,
      action: scope === 'ops' || (locked && role === 'support') ? 'تغییر سفارش پس از مهلت' : 'ثبت سفارش',
      target: `${fullName(employee)} · ${meal === 'lunch' ? 'ناهار' : 'شام'} ${fa(jd)} ${monthName}`,
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
          text: `${meal === 'lunch' ? 'ناهار' : 'شام'} ${fa(jd)} ${monthName}: ${after}`,
        },
        ...list,
      ])
    } else if (employee) {
      setNotes((list) => [
        {
          id: uid('n'),
          title: 'سفارش شما تغییر کرد',
          body: `${personaName} ${meal === 'lunch' ? 'ناهار' : 'شام'} ${fa(jd)} ${monthName} را به «${after}» تغییر داد.`,
          at: 'همین حالا',
          read: false,
          page: 'orders',
          employeeId,
        },
        ...list,
      ])
    }
    toast('ذخیره شد')
    return true
  }

  function rateMeal(orderId: string, score: number, comment: string) {
    const order = orders.find((item) => item.id === orderId)
    if (!can(role, 'order.rate') || !order || order.employeeId !== personaId || !isPastDate(order, now) || !order.choice) return false
    setOrders((list) => list.map((item) => (item.id === orderId ? { ...item, rating: { score, comment: comment.trim() } } : item)))
    pushActivity({
      actor: personaName,
      action: order.rating ? 'ویرایش دیدگاه' : 'ثبت دیدگاه',
      target: `${order.meal === 'lunch' ? 'ناهار' : 'شام'} ${fa(order.jd)} ${JALALI_MONTHS[order.jm - 1]}`,
      at: 'همین حالا',
      before: order.rating ? `${order.rating.score} از ۵` : '—',
      after: `${score} از ۵`,
    })
    toast('ذخیره شد')
    return true
  }

  function saveEmployee(input: Omit<Employee, 'id' | 'created' | 'active'> & { id?: string; initialPassword?: string }) {
    if (!can(role, 'employee.edit')) return 'اجازه این کار را ندارید.'
    const username = normalizeUsername(input.username)
    const duplicate = employees.some((item) => normalizeUsername(item.username) === username && item.id !== input.id)
    if (!input.firstName.trim() || !input.lastName.trim() || !username || !input.buildingId || duplicate) return 'نام، نام خانوادگی، نام کاربری یکتا و ساختمان لازم است.'
    if (input.id) {
      const previous = employees.find((item) => item.id === input.id)
      setEmployees((list) => list.map((item) => (item.id === input.id ? {
        ...item,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        username,
        buildingId: input.buildingId,
        groupIds: input.groupIds,
      } : item)))
      pushActivity({
        actor: personaName,
        action: 'ویرایش کارمند',
        target: `${input.firstName.trim()} ${input.lastName.trim()}`,
        at: 'همین حالا',
        before: previous ? fullName(previous) : '—',
        after: `${input.firstName.trim()} ${input.lastName.trim()}`,
      })
    } else {
      const passwordError = passwordIssue(input.initialPassword ?? '')
      if (passwordError) return passwordError
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
      setSessionSecret(id, input.initialPassword ?? '')
      pushActivity({
        actor: personaName,
        action: 'ایجاد حساب کارمند',
        target: `${input.firstName.trim()} ${input.lastName.trim()}`,
        at: 'همین حالا',
        before: '—',
        after: username,
      })
    }
    toast('ذخیره شد')
    return null
  }

  function changePassword(current: string, next: string) {
    const accountId = personaId ?? ADMIN_ACCOUNT_ID
    if (!verifySessionSecret(accountId, current)) return 'رمز فعلی درست نیست.'
    const issue = passwordIssue(next)
    if (issue) return issue
    if (next === current) return 'رمز جدید باید با رمز فعلی متفاوت باشد.'
    setSessionSecret(accountId, next)
    pushActivity({
      actor: personaName,
      action: 'تغییر رمز عبور',
      target: personaUsername,
      at: clockStamp(),
      before: 'رمز قبلی',
      after: 'رمز جدید در نشست نمایشی',
    })
    toast('رمز عبور به‌روز شد')
    return null
  }

  function resetEmployeePassword(employeeId: string, password: string) {
    if (!can(role, 'employee.edit')) return 'اجازه بازنشانی رمز را ندارید.'
    const employee = employees.find((item) => item.id === employeeId)
    if (!employee) return 'کارمند پیدا نشد.'
    const issue = passwordIssue(password)
    if (issue) return issue
    setSessionSecret(employeeId, password)
    const at = clockStamp()
    pushActivity({
      actor: personaName,
      action: 'بازنشانی رمز عبور',
      target: fullName(employee),
      at,
      before: 'رمز قبلی',
      after: 'رمز جدید در نشست نمایشی',
    })
    setNotes((list) => [
      {
        id: uid('n'),
        title: 'رمز عبور حساب شما بازنشانی شد',
        body: `رمز عبور حساب شما توسط منابع انسانی بازنشانی شد. زمان عملیات: ${at}. رمز جدید از همین اعلان ارسال نشده است.`,
        at,
        read: false,
        page: 'settings',
        employeeId,
      },
      ...list,
    ])
    toast('رمز عبور بازنشانی شد')
    return null
  }

  function setEmployeeActive(id: string, active: boolean) {
    if (!can(role, 'employee.edit')) return
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
    if (!can(role, 'building.edit')) return
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
    if (!can(role, 'building.edit')) return
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
    if (!can(role, 'group.edit')) return
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
    if (!can(role, 'group.edit')) return
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

  function addGuest(guest: Omit<GuestOrder, 'id' | 'jy' | 'jm'>) {
    if (!can(role, 'guest.edit')) return
    setGuests((list) => [{ ...guest, jy: selectedMonth.jy, jm: selectedMonth.jm, id: uid('gu') }, ...list])
    const building = buildings.find((item) => item.id === guest.buildingId)?.name ?? 'ساختمان'
    pushActivity({
      actor: personaName,
      action: 'ثبت سفارش مهمان',
      target: `${building} · ${fa(guest.jd)} ${monthName}`,
      at: 'همین حالا',
      before: '—',
      after: `${guest.count} پرس ${guest.meal === 'lunch' ? 'ناهار' : 'شام'}`,
    })
    toast('سفارش مهمان ثبت شد')
  }

  function removeGuest(id: string) {
    if (!can(role, 'guest.edit')) return
    const guest = guests.find((item) => item.id === id)
    if (!guest) return
    setGuests((list) => list.filter((item) => item.id !== id))
    pushActivity({
      actor: personaName,
      action: 'حذف سفارش مهمان',
      target: `${fa(guest.jd)} ${JALALI_MONTHS[guest.jm - 1]}`,
      at: 'همین حالا',
      before: `${guest.count} پرس`,
      after: 'حذف شد',
    })
  }

  function updateDayOptions(jd: number, meal: MealKind, options: string[]) {
    if (!can(role, 'menu.edit')) return
    const previous = days.find((day) => day.jd === jd)?.[meal] ?? []
    if (previous.join('\0') === options.join('\0')) return
    setMenus((map) => {
      const list = map[monthId] ?? days
      return { ...map, [monthId]: list.map((day) => (day.jd === jd ? { ...day, [meal]: options.length ? options : null } : day)) }
    })
    pushActivity({
      actor: personaName,
      action: meal === 'lunch' ? 'ویرایش گزینه‌های ناهار' : 'ویرایش گزینه‌های شام',
      target: `${fa(jd)} ${monthName}`,
      at: 'همین حالا',
      before: previous.length ? previous.join('، ') : 'بدون گزینه',
      after: options.length ? options.join('، ') : 'بدون گزینه',
    })
    toast('ذخیره شد')
  }

  function monthOrders<T extends { jy: number; jm: number }>(list: T[]) {
    return list.filter((item) => item.jy === selectedMonth.jy && item.jm === selectedMonth.jm)
  }

  function importedOptions(jd: number, meal: MealKind) {
    const day = importedMenu?.days.find((item) => item.jd === jd)
    if (!day) return null
    return meal === 'lunch' ? day.lunch : day.dinner
  }

  function impact(policy: ReplacePolicy): ImportImpact {
    const empty = { affected: 0, keptOutside: 0, lunch: 0, dinner: 0 }
    if (!importedMenu || importedMenu.jy !== selectedMonth.jy || importedMenu.jm !== selectedMonth.jm) return empty
    const chosen = monthOrders(orders).filter((order) => order.choice)
    if (policy === 'reset') {
      return { affected: chosen.length, keptOutside: 0, lunch: chosen.filter((order) => order.meal === 'lunch').length, dinner: chosen.filter((order) => order.meal === 'dinner').length }
    }
    const outside = chosen.filter((order) => {
      const options = importedOptions(order.jd, order.meal)
      return options !== null && !options.includes(order.choice ?? '')
    })
    const lunch = outside.filter((order) => order.meal === 'lunch').length
    const dinner = outside.filter((order) => order.meal === 'dinner').length
    if (policy === 'match') return { affected: outside.length, keptOutside: 0, lunch, dinner }
    return { affected: 0, keptOutside: outside.length, lunch, dinner }
  }

  function applyImport(policy: ReplacePolicy) {
    const result = impact(policy)
    if (!can(role, 'menu.edit') || !importedMenu || importedMenu.jy !== selectedMonth.jy || importedMenu.jm !== selectedMonth.jm) {
      return { affected: 0, keptOutside: 0, lunch: 0, dinner: 0 }
    }
    setMenus((map) => {
      const list = map[monthId] ?? days
      return {
        ...map,
        [monthId]: list.map((day) => {
          const incoming = importedMenu.days.find((item) => item.jd === day.jd)
          if (!incoming) return day
          return { ...day, lunch: incoming.lunch.length ? [...incoming.lunch] : null, dinner: incoming.dinner.length ? [...incoming.dinner] : null }
        }),
      }
    })
    const inMonth = (order: { jy: number; jm: number }) => order.jy === selectedMonth.jy && order.jm === selectedMonth.jm
    if (policy === 'reset') {
      setOrders((list) => list.map((order) => (inMonth(order) ? { ...order, choice: null, rating: null } : order)))
    } else if (policy === 'match') {
      setOrders((list) =>
        list.map((order) => {
          if (!inMonth(order) || !order.choice) return order
          const options = importedMenu.days.find((item) => item.jd === order.jd)?.[order.meal]
          if (options && !options.includes(order.choice)) return { ...order, choice: null, rating: null }
          return order
        }),
      )
    }
    pushActivity({
      actor: personaName,
      action: 'جایگزینی منو',
      target: `${monthName} ${fa(selectedMonth.jy)}`,
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
    selectedMonth,
    monthTitle: `${monthName} ${fa(selectedMonth.jy)}`,
    now,
    deadlines,
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
    importedMenu,
    toasts,
    personaId,
    personaName,
    personaUsername,
    buildingName,
    setRole,
    setTheme: setThemeState,
    setPage,
    setCollapsed,
    setMobileNav,
    setMenuView,
    setMenuQuery: (query) => setMenuQueryState((current) => ({ ...current, ...query })),
    clearMenuQuery: () => setMenuQueryState(emptyQuery),
    shiftMonth: (delta) => setSelectedMonth((month) => addMonths(month, delta)),
    setMealDeadline: (meal, patch) => {
      if (!can(role, 'menu.edit')) return
      const current = deadlines[meal]
      const next = { ...current, ...patch, meal }
      if (next.relation === current.relation && next.hour === current.hour && next.minute === current.minute) return
      setDeadlinesByMonth((map) => {
        const monthDeadlines = map[monthId] ?? defaultMonthDeadlines()
        return { ...map, [monthId]: { ...monthDeadlines, [meal]: next } }
      })
      pushActivity({
        actor: personaName,
        action: meal === 'lunch' ? 'تغییر مهلت ناهار' : 'تغییر مهلت شام',
        target: `${monthName} ${fa(selectedMonth.jy)}`,
        at: 'همین حالا',
        before: formatDeadline(current),
        after: formatDeadline(next),
      })
    },
    selectMeal,
    rateMeal,
    saveEmployee,
    changePassword,
    resetEmployeePassword,
    setEmployeeActive,
    saveBuilding,
    assignBuilding,
    saveGroup,
    setMembership,
    addGuest,
    removeGuest,
    updateDayOptions,
    setImportedFile: (file, menu = null) => {
      if (!can(role, 'menu.edit')) return
      setImportedFileState(file)
      setImportedMenu(file ? menu : null)
    },
    applyImport,
    previewImpact: impact,
    markNote: (id) => setNotes((list) => list.map((item) => (item.id === id ? { ...item, read: true } : item))),
    markAllNotes: () => setNotes((list) => list.map((item) => (!item.employeeId || item.employeeId === personaId ? { ...item, read: true } : item))),
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
