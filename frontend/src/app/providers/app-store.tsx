import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buildMonthMenu, createSnapshot, fullName, PERSONA_ID, ROLE_LABEL, SEED_MONTH } from '../../shared/fixtures/seed-data'
import { defaultMonthDeadlines, formatDeadline, isOrderingOpen, summarizeBackendDeadlines, type MealDeadline, type MonthDeadlines } from '../../shared/lib/deadlines'
import { addMonths, currentDateTime, JALALI_MONTHS, monthKey, type JalaliDate, type JalaliDateTime } from '../../shared/lib/jalali'
import { canGiveFeedback, isEmployeeDeadlineOpen, type MealDeadlineState } from '../../shared/lib/order-rules'
import { ADMIN_ACCOUNT_ID, normalizeUsername, passwordIssue, setSessionSecret, usernameIssue, verifySessionSecret } from '../../shared/lib/credentials'
import { fa } from '../../shared/lib/persian-text'
import type { SessionUser } from '../../features/auth/lib/session-roles'
import { AuthRequestError } from '../../features/auth/lib/auth-errors'
import { formatGregorianDate } from '../../features/menus/lib/menu-mapper'
import { orderApi } from '../../features/orders/api/orders-api'
import { mealDeadlineFromMap, mealServingsFromSettings, toDeadlineMap, uiRatingFromStaff } from '../../features/orders/lib/order-mapper'
import { can, canAccess, LANDING_PAGE } from '../../shared/config/permissions'
import type {
  ActivityItem,
  DayMenu,
  Employee,
  FeedItem,
  GuestOrder,
  ImportedFile,
  ImportedMenu,
  MealKind,
  MealServings,
  MenuQuery,
  MenuView,
  Note,
  Order,
  Page,
  ReplacePolicy,
  Role,
} from '../../shared/types/domain'

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
  mealServings: MealServings
  mealServingsStatus: 'loading' | 'ready' | 'unavailable' | 'error'
  mealServingsMessage: string
  deadlines: MonthDeadlines
  buildings: ReturnType<typeof createSnapshot>['buildings']
  groups: ReturnType<typeof createSnapshot>['groups']
  employees: Employee[]
  days: ReturnType<typeof createSnapshot>['days']
  orders: ReturnType<typeof createSnapshot>['orders']
  myOrders: Order[]
  myOrdersStatus: 'loading' | 'ready' | 'unavailable' | 'error'
  myOrdersMessage: string
  deadlineStatus: 'loading' | 'ready' | 'unavailable' | 'error'
  deadlineMessage: string
  orderingKey: string | null
  selfId: string
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
  setMealServing: (meal: MealKind, clock: string) => Promise<boolean>
  selectMeal: (employeeId: string, jd: number, meal: MealKind, choice: string | null, scope: 'self' | 'ops', menuItemId?: string | null) => Promise<boolean>
  mealDeadlineAt: (day: Pick<DayMenu, 'jy' | 'jm' | 'jd' | 'gregorianDate'>, meal: MealKind) => MealDeadlineState
  mealDeadlineSummary: (meal: MealKind, mealDates: string[]) => string
  retryMyOrders: () => void
  retryDeadlines: () => void
  retryMealServings: () => void
  syncOrderRating: (orderId: string, rating: { score: number; comment: string } | null) => void
  rateMeal: (orderId: string, score: number, comment: string) => Promise<{ ok: boolean; message?: string }>
  saveEmployee: (input: {
    id?: string
    firstName?: string
    lastName?: string
    username: string
    buildingId: string
    groupIds: string[]
    initialPassword?: string
  }) => string | null
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

export function StoreProvider({
  children,
  session,
  onLogout,
}: {
  children: ReactNode
  session: SessionUser
  onLogout: () => Promise<void>
}) {
  const initial = useMemo(() => createSnapshot(), [])
  const [role, setRoleState] = useState<Role>(session.role)

  useEffect(() => {
    setRoleState(session.role)
  }, [session.id, session.role])
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
  const [mealServings, setMealServings] = useState<MealServings>({ lunch: '', dinner: '' })
  const [mealServingsStatus, setMealServingsStatus] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading')
  const [mealServingsMessage, setMealServingsMessage] = useState('')
  const [mealServingsBoot, setMealServingsBoot] = useState(0)
  const [ratingKey, setRatingKey] = useState<string | null>(null)
  const [buildings, setBuildings] = useState(initial.buildings)
  const [groups, setGroups] = useState(initial.groups)
  const [employees, setEmployees] = useState(initial.employees)
  const [orders, setOrders] = useState(initial.orders)
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [myOrdersStatus, setMyOrdersStatus] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading')
  const [myOrdersMessage, setMyOrdersMessage] = useState('')
  const [myOrdersBoot, setMyOrdersBoot] = useState(0)
  const [orderingKey, setOrderingKey] = useState<string | null>(null)
  const [deadlineMap, setDeadlineMap] = useState<Record<string, string | null>>({})
  const [deadlineStatus, setDeadlineStatus] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading')
  const [deadlineMessage, setDeadlineMessage] = useState('')
  const [deadlineBoot, setDeadlineBoot] = useState(0)
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

  useEffect(() => {
    const controller = new AbortController()
    setMyOrdersStatus('loading')
    setMyOrdersMessage('')
    void orderApi.listAllMine(controller.signal).then((listed) => {
      if (controller.signal.aborted) return
      setMyOrders(listed.orders)
      setMyOrdersStatus('ready')
      setMyOrdersMessage('')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      if (error instanceof AuthRequestError && error.kind === 'network') {
        setMyOrdersStatus('unavailable')
        setMyOrdersMessage(error.message)
      } else {
        setMyOrdersStatus('error')
        setMyOrdersMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری سفارش‌ها انجام نشد.')
      }
    })
    return () => controller.abort()
  }, [myOrdersBoot, selectedMonth.jy, selectedMonth.jm, session.id])

  useEffect(() => {
    const controller = new AbortController()
    setDeadlineStatus('loading')
    setDeadlineMessage('')
    void orderApi.deadlines(selectedMonth.jy, selectedMonth.jm, controller.signal).then((rows) => {
      if (controller.signal.aborted) return
      setDeadlineMap(toDeadlineMap(rows))
      setDeadlineStatus('ready')
      setDeadlineMessage('')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setDeadlineMap({})
      setDeadlineStatus(error instanceof AuthRequestError && error.kind === 'network' ? 'unavailable' : 'error')
      setDeadlineMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری مهلت سفارش انجام نشد.')
    })
    return () => controller.abort()
  }, [deadlineBoot, selectedMonth.jy, selectedMonth.jm, session.id])

  useEffect(() => {
    const controller = new AbortController()
    setMealServingsStatus('loading')
    setMealServingsMessage('')
    void orderApi.mealSettings(controller.signal).then((rows) => {
      if (controller.signal.aborted) return
      setMealServings(mealServingsFromSettings(rows))
      setMealServingsStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setMealServings({ lunch: '', dinner: '' })
      if (error instanceof AuthRequestError && error.kind === 'network') {
        setMealServingsStatus('unavailable')
        setMealServingsMessage(error.message)
        return
      }
      setMealServingsStatus('error')
      setMealServingsMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری ساعت وعده انجام نشد.')
    })
    return () => controller.abort()
  }, [mealServingsBoot, session.id])

  const monthId = monthKey(selectedMonth)
  const days = menus[monthId] ?? buildMonthMenu(selectedMonth)
  const deadlines = deadlinesByMonth[monthId] ?? defaultMonthDeadlines()
  const monthName = JALALI_MONTHS[selectedMonth.jm - 1]

  const personaId = PERSONA_ID[role]
  const personaName = session.username
  const personaUsername = session.username
  const buildingName = session.buildingId ? 'دارای ساختمان سازمانی' : 'بدون ساختمان'

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
    if (!import.meta.env.DEV) return
    setRoleState(next)
    setPageState((current) => (canAccess(next, current) ? current : LANDING_PAGE))
    setMobileNav(false)
  }

  function setPage(next: Page) {
    if (!canAccess(role, next)) return
    setPageState(next)
    setMobileNav(false)
  }

  function mealDeadlineAt(day: Pick<DayMenu, 'jy' | 'jm' | 'jd' | 'gregorianDate'>, meal: MealKind): MealDeadlineState {
    const date = day.gregorianDate ?? formatGregorianDate(day.jy, day.jm, day.jd)
    return mealDeadlineFromMap(deadlineMap, deadlineStatus === 'ready', date, meal)
  }

  function mealDeadlineSummary(meal: MealKind, mealDates: string[]) {
    if (deadlineStatus === 'loading') return 'در حال خواندن'
    if (deadlineStatus !== 'ready') return 'خوانده نشد'
    return summarizeBackendDeadlines(deadlineMap, meal, mealDates)
  }

  function upsertMyOrder(next: Order) {
    setMyOrders((list) => {
      const rest = list.filter((item) => item.id !== next.id)
      return [...rest, next]
    })
  }

  async function selectMeal(employeeId: string, jd: number, meal: MealKind, choice: string | null, scope: 'self' | 'ops', menuItemId?: string | null) {
    const mealDate = { ...selectedMonth, jd }
    const gregorian = formatGregorianDate(selectedMonth.jy, selectedMonth.jm, jd)
    const locked = scope === 'self'
      ? !isEmployeeDeadlineOpen(mealDeadlineAt({ ...selectedMonth, jd, gregorianDate: gregorian }, meal))
      : !isOrderingOpen(mealDate, deadlines[meal], now)
    if (scope === 'self') {
      if (!can(role, 'order.self') || employeeId !== session.id) return false
      if (locked && !can(role, 'order.ops')) return false
      const key = `${jd}-${meal}`
      if (orderingKey) return false
      const current = myOrders.find((item) => item.employeeId === session.id && item.jy === selectedMonth.jy && item.jm === selectedMonth.jm && item.jd === jd && item.meal === meal && item.cycleStatus !== 'CANCELLED')
      if (menuItemId === undefined) return false
      if (!current && menuItemId === null) return false
      if (current && current.menuItemId === menuItemId) return true
      setOrderingKey(key)
      try {
        let saved: Order
        if (menuItemId === null && current) {
          saved = await orderApi.cancel(current.id)
        } else if (current && menuItemId) {
          saved = await orderApi.update(current.id, menuItemId)
        } else if (menuItemId) {
          saved = await orderApi.create({
            mealDate: gregorian,
            mealType: meal === 'lunch' ? 'LUNCH' : 'DINNER',
            menuItemId,
          })
        } else {
          return false
        }
        upsertMyOrder(saved)
        toast(menuItemId === null ? 'انتخاب حذف شد' : 'سفارش ذخیره شد')
        return true
      } catch (error) {
        toast(error instanceof AuthRequestError ? error.message : 'ذخیره سفارش انجام نشد.')
        return false
      } finally {
        setOrderingKey(null)
      }
    }
    if (!can(role, 'order.ops')) return false
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

  async function rateMeal(orderId: string, score: number, comment: string) {
    const order = myOrders.find((item) => item.id === orderId)
    if (!can(role, 'order.rate') || !order || order.employeeId !== session.id) {
      return { ok: false, message: 'اجازه ثبت دیدگاه برای این سفارش را ندارید.' }
    }
    if (mealServingsStatus !== 'ready' || !canGiveFeedback(order, now, mealServings)) {
      return { ok: false, message: 'ثبت نظرسنجی فقط پس از پایان زمان وعده مجاز است.' }
    }
    if (ratingKey) return { ok: false, message: 'در حال ذخیره دیدگاه قبلی هستید.' }
    setRatingKey(orderId)
    try {
      const saved = await orderApi.upsertRating(orderId, { score, comment: comment.trim() || undefined })
      const patch = uiRatingFromStaff(saved)
      setMyOrders((list) => list.map((item) => (item.id === orderId ? { ...item, rating: patch } : item)))
      pushActivity({
        actor: personaName,
        action: order.rating ? 'ویرایش دیدگاه' : 'ثبت دیدگاه',
        target: `${order.meal === 'lunch' ? 'ناهار' : 'شام'} ${fa(order.jd)} ${JALALI_MONTHS[order.jm - 1]}`,
        at: 'همین حالا',
        before: order.rating ? `${order.rating.score} از ۵` : '—',
        after: `${saved.score} از ۵`,
      })
      toast('ذخیره شد')
      return { ok: true }
    } catch (error: unknown) {
      return { ok: false, message: error instanceof AuthRequestError ? error.message : 'دیدگاه ذخیره نشد.' }
    } finally {
      setRatingKey(null)
    }
  }

  function saveEmployee(input: {
    id?: string
    firstName?: string
    lastName?: string
    username: string
    buildingId: string
    groupIds: string[]
    initialPassword?: string
  }) {
    if (!can(role, 'employee.edit')) return 'اجازه این کار را ندارید.'
    const username = normalizeUsername(input.username)
    const nameError = usernameIssue(username)
    if (nameError) return nameError
    const duplicate = employees.some((item) => normalizeUsername(item.username) === username && item.id !== input.id)
    if (duplicate) return 'این نام کاربری قبلاً ثبت شده است.'
    if (!input.buildingId) return 'ساختمان را انتخاب کنید.'
    const previous = input.id ? employees.find((item) => item.id === input.id) : undefined
    const firstName = (input.firstName ?? previous?.firstName ?? '').trim()
    const lastName = (input.lastName ?? previous?.lastName ?? '').trim()
    if (input.id) {
      if (!previous) return 'کارمند پیدا نشد.'
      setEmployees((list) => list.map((item) => (item.id === input.id ? {
        ...item,
        firstName,
        lastName,
        username,
        buildingId: input.buildingId,
        groupIds: input.groupIds,
      } : item)))
      pushActivity({
        actor: personaName,
        action: 'ویرایش کارمند',
        target: username,
        at: 'همین حالا',
        before: previous.username,
        after: username,
      })
    } else {
      const passwordError = passwordIssue(input.initialPassword ?? '')
      if (passwordError) return passwordError
      const id = uid('e')
      setEmployees((list) => [
        {
          id,
          firstName,
          lastName,
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
        target: username,
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
    mealServings,
    mealServingsStatus,
    mealServingsMessage,
    deadlines,
    buildings,
    groups,
    employees,
    days,
    orders,
    myOrders,
    myOrdersStatus,
    myOrdersMessage,
    deadlineStatus,
    deadlineMessage,
    orderingKey,
    selfId: session.id,
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
    setMealServing: async (meal, clock) => {
      if (!can(role, 'settings.meals')) return false
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(clock)) return false
      const next = { ...mealServings, [meal]: clock }
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(next.lunch) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(next.dinner)) return false
      try {
        const rows = await orderApi.replaceMealSettings({
          items: [
            { mealType: 'LUNCH', servingTime: next.lunch },
            { mealType: 'DINNER', servingTime: next.dinner },
          ],
        })
        setMealServings(mealServingsFromSettings(rows))
        setMealServingsStatus('ready')
        return true
      } catch (error: unknown) {
        setMealServingsMessage(error instanceof AuthRequestError ? error.message : 'ذخیره ساعت وعده انجام نشد.')
        return false
      }
    },
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
    mealDeadlineAt,
    mealDeadlineSummary,
    retryMyOrders: () => setMyOrdersBoot((value) => value + 1),
    retryDeadlines: () => setDeadlineBoot((value) => value + 1),
    retryMealServings: () => setMealServingsBoot((value) => value + 1),
    syncOrderRating: (orderId, rating) => {
      setMyOrders((list) => list.map((item) => (item.id === orderId ? { ...item, rating } : item)))
    },
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
    logout: () => {
      void onLogout()
    },
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useApp() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('store')
  return value
}

export { ROLE_LABEL }
