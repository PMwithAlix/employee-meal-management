import { fa } from '../../../shared/lib/persian-text'
import { gregorianToJalali, JALALI_MONTHS } from '../../../shared/lib/jalali'
import type { AuditLogItem } from '../api/audit-api'

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  USER_CREATED: 'ایجاد کاربر',
  USER_UPDATED: 'ویرایش کاربر',
  USER_DEACTIVATED: 'غیرفعال‌سازی کاربر',
  USER_REACTIVATED: 'فعال‌سازی کاربر',
  USER_DELETED: 'حذف کاربر',
  PASSWORD_RESET: 'بازنشانی رمز عبور',
  BUILDING_CREATED: 'ایجاد ساختمان',
  BUILDING_UPDATED: 'ویرایش ساختمان',
  BUILDING_DEACTIVATED: 'غیرفعال‌سازی ساختمان',
  BUILDING_REACTIVATED: 'فعال‌سازی ساختمان',
  BUILDING_DELETED: 'حذف ساختمان',
  GROUP_CREATED: 'ایجاد گروه',
  GROUP_UPDATED: 'ویرایش گروه',
  GROUP_DEACTIVATED: 'غیرفعال‌سازی گروه',
  GROUP_DELETED: 'حذف گروه',
  USER_ADDED_TO_GROUP: 'افزودن عضو به گروه',
  USER_REMOVED_FROM_GROUP: 'حذف عضو از گروه',
  MENU_CREATED: 'ایجاد منوی ماهانه',
  DRAFT_VERSION_CREATED: 'ایجاد پیش‌نویس منو',
  DRAFT_VERSION_EDITED: 'ویرایش پیش‌نویس منو',
  MEAL_CONFIGURED: 'تنظیم وعده غذایی',
  MEAL_OPTION_ADDED: 'افزودن غذا به منو',
  MEAL_OPTION_UPDATED: 'ویرایش غذای منو',
  MEAL_OPTION_REMOVED: 'حذف غذا از منو',
  MEAL_OPTIONS_REORDERED: 'تغییر ترتیب غذاها',
  MENU_VERSION_PUBLISHED: 'انتشار منو',
  EXCEL_IMPORT_PREVIEW_CREATED: 'بررسی فایل اکسل منو',
  EXCEL_IMPORT_CONFIRMED: 'تأیید واردسازی منو از اکسل',
  EXCEL_IMPORT_REJECTED: 'رد واردسازی منو از اکسل',
  ORDER_CREATED: 'ثبت سفارش',
  ORDER_UPDATED: 'ویرایش سفارش',
  ORDER_CANCELLED: 'لغو سفارش',
  GUEST_ORDER_CREATED: 'ثبت سفارش مهمان',
  GUEST_ORDER_UPDATED: 'ویرایش سفارش مهمان',
  GUEST_ORDER_CANCELLED: 'لغو سفارش مهمان',
  ORDER_DEADLINES_UPDATED: 'به‌روزرسانی مهلت سفارش',
  MEAL_SETTINGS_UPDATED: 'به‌روزرسانی ساعت سرو',
  RATING_CREATED: 'ثبت امتیاز غذا',
  RATING_UPDATED: 'ویرایش امتیاز غذا',
}

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  User: 'کاربر',
  Building: 'ساختمان',
  Group: 'گروه',
  GroupMembership: 'عضویت گروه',
  Menu: 'منو',
  MenuVersion: 'نسخه منو',
  MenuItem: 'گزینه منو',
  MenuImport: 'واردسازی منو',
  Order: 'سفارش',
  GuestOrder: 'سفارش مهمان',
  OrderDeadline: 'مهلت سفارش',
  MealSetting: 'تنظیم وعده',
  Rating: 'امتیاز',
}

const FIELD_LABELS: Record<string, string> = {
  username: 'نام کاربری',
  role: 'نقش',
  buildingId: 'ساختمان',
  isActive: 'وضعیت فعال',
  name: 'نام',
  title: 'عنوان',
  year: 'سال',
  month: 'ماه',
  jalaliYear: 'سال',
  jalaliMonth: 'ماه',
  mealType: 'وعده',
  mealDate: 'تاریخ وعده',
  policy: 'سیاست جایگزینی',
  valid: 'اعتبار فایل',
  errorCount: 'تعداد خطا',
  optionCount: 'تعداد گزینه',
  lunchMealCount: 'وعده ناهار',
  dinnerMealCount: 'وعده شام',
  servingTime: 'ساعت سرو',
  quantity: 'تعداد',
  score: 'امتیاز',
  comment: 'نظر',
  reason: 'علت',
  via: 'روش',
}

const HIDDEN_FIELDS = new Set([
  'id',
  'actorId',
  'userId',
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'importId',
  'publishedVersionId',
  'menuId',
  'versionId',
])

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: 'کارمند',
  HR: 'منابع انسانی',
  SUPPORT: 'پشتیبانی',
  MANAGEMENT: 'مدیریت',
  ADMIN: 'مدیر سامانه',
}

const MEAL_LABELS: Record<string, string> = {
  LUNCH: 'ناهار',
  DINNER: 'شام',
  lunch: 'ناهار',
  dinner: 'شام',
}

export const AUDIT_ACTION_FILTERS = [
  { value: '', label: 'همه عملیات‌ها' },
  ...Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({ value, label })),
]

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function formatActivityTime(value: string) {
  const instant = Date.parse(value)
  if (!Number.isFinite(instant)) return value || '—'
  const date = new Date(instant)
  const jalali = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate())
  return `${fa(jalali.jy)}/${fa(pad(jalali.jm))}/${fa(pad(jalali.jd))}، ${fa(pad(date.getHours()))}:${fa(pad(date.getMinutes()))}`
}

export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? action
}

export function auditEntityLabel(entityType: string) {
  return AUDIT_ENTITY_LABELS[entityType] ?? entityType
}

function displayValue(key: string, value: unknown): string | null {
  if (value == null || value === '') return null
  if (HIDDEN_FIELDS.has(key)) return null
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر'
  if (typeof value === 'number') {
    if (key === 'month' || key === 'jalaliMonth') return JALALI_MONTHS[value - 1] ?? fa(value)
    return fa(value)
  }
  if (typeof value !== 'string') return null
  if (ROLE_LABELS[value]) return ROLE_LABELS[value]
  if (MEAL_LABELS[value]) return MEAL_LABELS[value]
  if (value === 'KEEP_EXISTING_ORDERS') return 'حفظ سفارش‌های قبلی'
  if (value === 'EXACT_MATCH_ONLY') return 'تطبیق دقیق با منوی جدید'
  if (value === 'RESET') return 'بازنشانی سفارش‌ها'
  if (value === 'stale') return 'منو از زمان پیش‌نمایش تغییر کرده بود'
  if (value === 'excel-import') return 'واردسازی اکسل'
  if (value === 'transaction-failed') return 'خطای ذخیره'
  if (/^[0-9a-f-]{32,}$/i.test(value)) return null
  if (value.trim().startsWith('{') || value.trim().startsWith('[')) return null
  if (value.includes('<') && value.includes('>')) return null
  return value
}

function collectPairs(value: unknown): Array<{ label: string; text: string }> {
  const record = asRecord(value)
  if (!record) return []
  const pairs: Array<{ label: string; text: string }> = []
  for (const [key, raw] of Object.entries(record)) {
    if (HIDDEN_FIELDS.has(key) || key.endsWith('Id') || key.endsWith('Hash')) continue
    const text = displayValue(key, raw)
    if (!text) continue
    pairs.push({ label: FIELD_LABELS[key] ?? key, text })
  }
  return pairs
}

function formatPairs(pairs: Array<{ label: string; text: string }>) {
  if (!pairs.length) return '—'
  return pairs.map((item) => `${item.label}: ${item.text}`).join('؛ ')
}

function subjectFromData(item: AuditLogItem) {
  const after = asRecord(item.afterData)
  const before = asRecord(item.beforeData)
  const username = typeof after?.username === 'string' ? after.username : typeof before?.username === 'string' ? before.username : ''
  const name = typeof after?.name === 'string' ? after.name : typeof before?.name === 'string' ? before.name : ''
  const title = typeof after?.title === 'string' ? after.title : typeof before?.title === 'string' ? before.title : ''
  const year = typeof after?.jalaliYear === 'number' ? after.jalaliYear : typeof after?.year === 'number' ? after.year : null
  const month = typeof after?.jalaliMonth === 'number' ? after.jalaliMonth : typeof after?.month === 'number' ? after.month : null
  if (username) return username
  if (name) return name
  if (title) return title
  if (year && month) return `${JALALI_MONTHS[month - 1] ?? month} ${fa(year)}`
  return `${auditEntityLabel(item.entityType)}`
}

export type ActivityView = {
  action: string
  target: string
  detail: string
  before: string
  after: string
  at: string
}

export function describeAuditEvent(item: AuditLogItem): ActivityView {
  const beforePairs = collectPairs(item.beforeData)
  const afterPairs = collectPairs(item.afterData)
  const changed = afterPairs.filter((pair) => {
    const previous = beforePairs.find((item) => item.label === pair.label)
    return !previous || previous.text !== pair.text
  })
  const detail = changed.length
    ? changed.map((pair) => {
        const previous = beforePairs.find((item) => item.label === pair.label)
        return previous ? `${pair.label} از «${previous.text}» به «${pair.text}»` : `${pair.label}: ${pair.text}`
      }).join('؛ ')
    : afterPairs.length
      ? formatPairs(afterPairs)
      : beforePairs.length
        ? formatPairs(beforePairs)
        : 'جزئیات بیشتری ثبت نشده است.'

  return {
    action: auditActionLabel(item.action),
    target: subjectFromData(item),
    detail,
    before: formatPairs(beforePairs),
    after: formatPairs(afterPairs),
    at: formatActivityTime(item.createdAt),
  }
}
