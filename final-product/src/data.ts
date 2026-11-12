import type {
  ActivityItem,
  Building,
  DayMenu,
  Employee,
  FeedItem,
  Group,
  GuestOrder,
  MealKind,
  Note,
  Order,
  PastOrder,
  Role,
} from './types'
import { jalaliMonthLength, weekdayName } from './lib/jalali'

export const SEED_MONTH = { jy: 1405, jm: 8 }
const SEED_DAY = 21
export const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'] as const

export const ROLE_LABEL: Record<Role, string> = {
  employee: 'کارمند',
  hr: 'منابع انسانی',
  support: 'پشتیبان',
  management: 'مدیریت',
  admin: 'ادمین',
}

export const PERSONA_ID: Record<Role, string | null> = {
  employee: 'e1',
  hr: 'e4',
  support: 'e8',
  management: 'e3',
  admin: null,
}

export const PREVIEW_MENU = {
  lunch: ['خورشت بادمجان', 'چلوماهی', 'زرشک‌پلو با مرغ'],
  dinner: ['خوراک قارچ', 'نودل سبزیجات'],
}

const LUNCH_SETS = [
  ['چلوکباب کوبیده', 'زرشک‌پلو با مرغ', 'خورشت قیمه'],
  ['جوجه کباب', 'قرمه‌سبزی', 'خوراک مرغ'],
  ['فسنجان', 'عدس‌پلو', 'چلوکباب'],
  ['زرشک‌پلو با مرغ', 'کوفته تبریزی', 'خورشت کرفس'],
]

const DINNER_SETS = [
  ['کوکو سبزی', 'ماکارونی'],
  ['کتلت', 'سوپ جو'],
  ['املت گوجه', 'خوراک لوبیا'],
  ['ساندویچ مرغ', 'سالاد الویه'],
]

export function weekdayOf(month: { jy: number; jm: number }, jd: number) {
  return weekdayName({ ...month, jd })
}

function menuFor(month: { jy: number; jm: number }, jd: number, blankFridays: boolean): DayMenu {
  const weekday = weekdayOf(month, jd)
  if (blankFridays && weekday === 'جمعه') return { ...month, jd, weekday, lunch: null, dinner: null }
  return {
    ...month,
    jd,
    weekday,
    lunch: [...LUNCH_SETS[(jd - 1) % LUNCH_SETS.length]],
    dinner: [...DINNER_SETS[(jd - 1) % DINNER_SETS.length]],
  }
}

export function buildMonthMenu(month: { jy: number; jm: number }, blankFridays = false) {
  return Array.from({ length: jalaliMonthLength(month.jy, month.jm) }, (_, index) => menuFor(month, index + 1, blankFridays))
}

function pick(index: number, jd: number, meal: MealKind, options: string[]) {
  const n = (index + 1) * 13 + jd * 7 + (meal === 'dinner' ? 5 : 0)
  const bucket = n % 10
  if (jd >= SEED_DAY && bucket < 3) return null
  if (jd < SEED_DAY && bucket === 0) return null
  return options[n % options.length]
}

function force(orders: Order[], employeeId: string, jd: number, meal: MealKind, choice: string | null) {
  const order = orders.find((item) => item.employeeId === employeeId && item.jd === jd && item.meal === meal)
  if (order) order.choice = choice
}

export function fullName(employee: Pick<Employee, 'firstName' | 'lastName'>) {
  return `${employee.firstName} ${employee.lastName}`
}

export interface Snapshot {
  buildings: Building[]
  groups: Group[]
  employees: Employee[]
  days: DayMenu[]
  orders: Order[]
  guests: GuestOrder[]
  activity: ActivityItem[]
  notes: Note[]
  feed: FeedItem[]
  past: PastOrder[]
}

export function createSnapshot(): Snapshot {
  const buildings: Building[] = [
    { id: 'b1', name: 'ساختمان مرکزی' },
    { id: 'b2', name: 'ساختمان شمال' },
    { id: 'b3', name: 'مرکز پشتیبانی' },
  ]
  const groups: Group[] = [
    { id: 'g1', name: 'محصول' },
    { id: 'g2', name: 'مالی' },
    { id: 'g3', name: 'شیفت صبح' },
  ]
  const employees: Employee[] = [
    { id: 'e1', firstName: 'نیما', lastName: 'احمدی', username: 'nahmadi', buildingId: 'b1', groupIds: ['g1'], active: true, created: '۱۲ مهر ۱۴۰۵' },
    { id: 'e2', firstName: 'سارا', lastName: 'کریمی', username: 'skarimi', buildingId: 'b1', groupIds: ['g1'], active: true, created: '۱۸ مهر ۱۴۰۵' },
    { id: 'e3', firstName: 'کامران', lastName: 'شریفی', username: 'ksharifi', buildingId: 'b1', groupIds: ['g2'], active: true, created: '۳ شهریور ۱۴۰۵' },
    { id: 'e4', firstName: 'مریم', lastName: 'حسینی', username: 'mhosseini', buildingId: 'b1', groupIds: ['g2'], active: true, created: '۹ شهریور ۱۴۰۵' },
    { id: 'e5', firstName: 'رضا', lastName: 'نوری', username: 'rnoori', buildingId: 'b2', groupIds: ['g3'], active: true, created: '۲۱ مهر ۱۴۰۵' },
    { id: 'e6', firstName: 'فاطمه', lastName: 'اکبری', username: 'fakbari', buildingId: 'b2', groupIds: ['g3'], active: true, created: '۱۴ مهر ۱۴۰۵' },
    { id: 'e7', firstName: 'حسین', lastName: 'مرادی', username: 'hmoradi', buildingId: 'b3', groupIds: ['g1', 'g3'], active: true, created: '۲۷ شهریور ۱۴۰۵' },
    { id: 'e8', firstName: 'الهام', lastName: 'عباسی', username: 'eabbasi', buildingId: 'b2', groupIds: ['g3'], active: true, created: '۵ مهر ۱۴۰۵' },
    { id: 'e9', firstName: 'پارسا', lastName: 'کیانی', username: 'pkiani', buildingId: 'b3', groupIds: [], active: true, created: '۱ آبان ۱۴۰۵' },
    { id: 'e10', firstName: 'ندا', lastName: 'صالحی', username: 'nsalehi', buildingId: 'b1', groupIds: ['g2'], active: false, created: '۱۱ مرداد ۱۴۰۵' },
  ]

  const days = buildMonthMenu(SEED_MONTH, true)
  const orders: Order[] = []
  employees.forEach((employee, index) => {
    days.forEach((day) => {
      ;(['lunch', 'dinner'] as const).forEach((meal) => {
        const options = day[meal]
        if (!options) return
        let choice = pick(index, day.jd, meal, options)
        if (!employee.active && day.jd >= SEED_DAY) choice = null
        orders.push({
          id: `${employee.id}-${day.jd}-${meal}`,
          employeeId: employee.id,
          buildingId: employee.buildingId,
          jy: day.jy,
          jm: day.jm,
          jd: day.jd,
          meal,
          choice,
          rating: null,
        })
      })
    })
  })

  ;[
    [21, 'lunch'],
    [21, 'dinner'],
    [23, 'lunch'],
    [23, 'dinner'],
    [24, 'dinner'],
    [26, 'lunch'],
    [18, 'dinner'],
    [20, 'lunch'],
    [20, 'dinner'],
    [16, 'lunch'],
  ].forEach(([jd, meal]) => force(orders, 'e1', Number(jd), meal as MealKind, null))

  const ratings: Array<[string, number, string]> = [
    ['e1-7-lunch', 4, 'برنج خوب بود، خورشت کمی شور بود.'],
    ['e1-14-dinner', 5, ''],
    ['e2-9-lunch', 5, 'کیفیت جوجه بهتر از هفته قبل بود.'],
    ['e6-12-dinner', 3, 'سالاد سرد رسیده بود.'],
  ]
  ratings.forEach(([id, score, comment]) => {
    const order = orders.find((item) => item.id === id)
    if (!order) return
    if (!order.choice) {
      const day = days.find((item) => item.jd === order.jd)
      const options = day?.[order.meal]
      if (options?.[0]) order.choice = options[0]
    }
    if (order.choice) order.rating = { score, comment }
  })

  const guests: GuestOrder[] = [
    { id: 'gu1', buildingId: 'b1', jy: SEED_MONTH.jy, jm: SEED_MONTH.jm, jd: 23, meal: 'lunch', count: 4, note: 'جلسه هیئت‌مدیره' },
    { id: 'gu2', buildingId: 'b2', jy: SEED_MONTH.jy, jm: SEED_MONTH.jm, jd: 25, meal: 'dinner', count: 2, note: 'مهمان پیمانکار' },
  ]

  const activity: ActivityItem[] = [
    { id: 'a1', actor: 'الهام عباسی', action: 'تغییر سفارش', target: 'نیما احمدی · ناهار ۲۸ مهر', at: '۱۱ آبان، ۱۶:۲۰', before: 'قرمه‌سبزی', after: 'جوجه کباب', result: 'موفق' },
    { id: 'a2', actor: 'الهام عباسی', action: 'انتشار منو', target: 'منوی آبان ۱۴۰۵', at: '۱ آبان، ۰۹:۰۵', before: '—', after: 'ناهار و شام ۲۶ روز', result: 'موفق' },
    { id: 'a3', actor: 'مریم حسینی', action: 'غیرفعال‌سازی حساب', target: 'ندا صالحی', at: '۸ آبان، ۱۱:۴۰', before: 'فعال', after: 'غیرفعال', result: 'موفق' },
    { id: 'a4', actor: 'نیما احمدی', action: 'ثبت سفارش', target: 'شام ۱۹ آبان', at: '۱۸ آبان، ۱۳:۱۲', before: 'انتخاب نشده', after: 'کتلت', result: 'موفق' },
    { id: 'a5', actor: 'مریم حسینی', action: 'انتقال ساختمان', target: 'پارسا کیانی', at: '۲ آبان، ۱۰:۱۸', before: 'ساختمان مرکزی', after: 'مرکز پشتیبانی', result: 'موفق' },
    { id: 'a6', actor: 'الهام عباسی', action: 'ثبت سفارش مهمان', target: 'ساختمان مرکزی · ۲۳ آبان', at: '۱۹ آبان، ۱۵:۰۲', before: '—', after: '۴ پرس ناهار', result: 'موفق' },
  ]

  const notes: Note[] = [
    { id: 'n1', title: 'سفارش شما تغییر کرد', body: 'پشتیبان، ناهار ۲۸ مهر را از قرمه‌سبزی به جوجه کباب تغییر داد.', at: '۱۱ آبان، ۱۶:۲۲', read: false, page: 'orders' },
    { id: 'n2', title: 'منوی آبان آماده است', body: 'ناهار و شام روزهای کاری آبان برای انتخاب باز است.', at: '۱ آبان، ۰۹:۱۰', read: false, page: 'menu' },
    { id: 'n3', title: 'مهلت نزدیک', body: 'ناهار و شام امروز تا ساعت ۱۰ باز است.', at: '۲۱ آبان، ۰۷:۳۰', read: true, page: 'menu' },
    { id: 'n4', title: 'سفارش شام ثبت شد', body: 'شام ۱۹ آبان برای شما ثبت شد.', at: '۱۸ آبان، ۱۳:۱۲', read: true, page: 'orders' },
  ]

  const feed: FeedItem[] = [
    { id: 'f1', employeeId: 'e1', at: 'دیروز', meal: 'lunch', jd: 19, text: 'ناهار ۱۹ آبان به زرشک‌پلو با مرغ تغییر کرد' },
    { id: 'f2', employeeId: 'e1', at: '۲ روز پیش', meal: 'dinner', jd: 17, text: 'شام ۱۷ آبان ثبت شد: کتلت' },
    { id: 'f3', employeeId: 'e1', at: '۱۱ آبان', meal: 'lunch', jd: 28, text: 'پشتیبان ناهار ۲۸ مهر را تغییر داد' },
  ]

  const past: PastOrder[] = [
    { employeeId: 'e1', date: '۲۸ مهر', weekday: 'سه‌شنبه', meal: 'lunch', choice: 'جوجه کباب', status: 'تغییر توسط پشتیبان' },
    { employeeId: 'e1', date: '۲۷ مهر', weekday: 'دوشنبه', meal: 'dinner', choice: 'کوکو سبزی', status: 'ثبت شده' },
    { employeeId: 'e1', date: '۲۶ مهر', weekday: 'یکشنبه', meal: 'lunch', choice: 'چلوکباب کوبیده', status: 'ثبت شده' },
    { employeeId: 'e4', date: '۲۸ مهر', weekday: 'سه‌شنبه', meal: 'lunch', choice: 'فسنجان', status: 'ثبت شده' },
    { employeeId: 'e4', date: '۲۷ مهر', weekday: 'دوشنبه', meal: 'dinner', choice: 'املت گوجه', status: 'ثبت شده' },
    { employeeId: 'e8', date: '۲۸ مهر', weekday: 'سه‌شنبه', meal: 'dinner', choice: 'سوپ جو', status: 'ثبت شده' },
    { employeeId: 'e8', date: '۲۵ مهر', weekday: 'شنبه', meal: 'lunch', choice: 'خورشت قیمه', status: 'ثبت شده' },
  ]

  return { buildings, groups, employees, days, orders, guests, activity, notes, feed, past }
}
