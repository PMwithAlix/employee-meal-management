export type Role = 'employee' | 'hr' | 'support' | 'management' | 'admin'

export type Page =
  | 'overview'
  | 'menu'
  | 'orders'
  | 'menuMgmt'
  | 'employees'
  | 'buildings'
  | 'groups'
  | 'reports'
  | 'activity'
  | 'settings'

export type MealKind = 'lunch' | 'dinner'
export type MenuView = 'list' | 'calendar'
export type MealFilter = 'all' | MealKind
export type StatusFilter = 'all' | 'selected' | 'unselected' | 'open'
export type ReplacePolicy = 'keep' | 'match' | 'reset'

export interface MenuQuery {
  meal: MealFilter
  status: StatusFilter
  q: string
}

export interface Building {
  id: string
  name: string
}

export interface Group {
  id: string
  name: string
}

export interface Employee {
  id: string
  firstName: string
  lastName: string
  username: string
  buildingId: string
  groupIds: string[]
  active: boolean
  created: string
}

export interface DayMenu {
  jd: number
  jy: number
  jm: number
  weekday: string
  lunch: string[] | null
  dinner: string[] | null
}

export interface Rating {
  score: number
  comment: string
}

export interface Order {
  id: string
  employeeId: string
  buildingId: string
  jy: number
  jm: number
  jd: number
  meal: MealKind
  choice: string | null
  rating: Rating | null
}

export interface GuestOrder {
  id: string
  buildingId: string
  jy: number
  jm: number
  jd: number
  meal: MealKind
  count: number
  note: string
}

export interface ActivityItem {
  id: string
  actor: string
  action: string
  target: string
  at: string
  before: string
  after: string
  result: string
}

export interface Note {
  id: string
  title: string
  body: string
  at: string
  read: boolean
  page?: Page
  employeeId?: string
}

export interface FeedItem {
  id: string
  employeeId: string
  at: string
  meal: MealKind
  jd: number
  text: string
}

export interface PastOrder {
  employeeId: string
  date: string
  weekday: string
  meal: MealKind
  choice: string
  status: string
}

export interface ImportedFile {
  name: string
  size: number
}

export interface ImportedDayMenu {
  jd: number
  lunch: string[]
  dinner: string[]
}

export interface ImportedMenu {
  jy: number
  jm: number
  days: ImportedDayMenu[]
}
