import type { ImportedDayMenu, ImportedMenu } from '../types'
import { isValidJalaliDate, jalaliMonthLength, weekdayName, type JalaliDate } from './jalali'
import { fa } from './text'

const LUNCH_SHEET = 'ناهار'
const DINNER_SHEET = 'شام'
const DATE = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/
const FOOD_COLUMNS = ['نوع اول', 'نوع دوم', 'نوع سوم']
const LUNCH_COLUMNS = ['ردیف', 'روز', 'تاریخ', 'نوع اول', 'نوع دوم', 'نوع سوم']
const DINNER_COLUMNS = ['ردیف', 'روز', 'تاریخ', 'نوع اول', 'نوع دوم']

export type MenuFileResult = { ok: true; menu: ImportedMenu } | { ok: false; error: string }

type ParsedRow = { jd: number; foods: string[] }

export async function readMenuFile(buffer: ArrayBuffer, month: Pick<JalaliDate, 'jy' | 'jm'>): Promise<MenuFileResult> {
  let files: Map<string, string>
  try {
    files = await unzipText(buffer)
  } catch {
    return { ok: false, error: 'این فایل اکسل قابل خواندن نیست. فایل xlsx با شیت‌های «ناهار» و «شام» لازم است.' }
  }
  const workbook = files.get('xl/workbook.xml')
  const rels = files.get('xl/_rels/workbook.xml.rels')
  if (!workbook || !rels) return { ok: false, error: 'ساختار فایل با نمونه منو یکی نیست. شیت‌های «ناهار» و «شام» پیدا نشد.' }
  const sheets = sheetPaths(workbook, rels)
  const lunchPath = sheets.get(LUNCH_SHEET)
  const dinnerPath = sheets.get(DINNER_SHEET)
  if (!lunchPath) return { ok: false, error: 'شیت «ناهار» در فایل نیست.' }
  if (!dinnerPath) return { ok: false, error: 'شیت «شام» در فایل نیست.' }
  const strings = sharedStrings(files.get('xl/sharedStrings.xml') ?? '')
  const lunch = readSheet(files.get(lunchPath) ?? '', strings, LUNCH_SHEET, LUNCH_COLUMNS, month)
  if (!lunch.ok) return lunch
  const dinner = readSheet(files.get(dinnerPath) ?? '', strings, DINNER_SHEET, DINNER_COLUMNS, month)
  if (!dinner.ok) return dinner
  for (const [jd, row] of lunch.rows) {
    if (!dinner.rows.has(jd)) return { ok: false, error: `تاریخ ${dateLabel(month.jy, month.jm, jd)} در شیت «ناهار»، سطر ${fa(row.excelRow)}، هست و در شیت «شام» نیست.` }
  }
  for (const [jd, row] of dinner.rows) {
    if (!lunch.rows.has(jd)) return { ok: false, error: `تاریخ ${dateLabel(month.jy, month.jm, jd)} در شیت «شام»، سطر ${fa(row.excelRow)}، هست و در شیت «ناهار» نیست.` }
  }
  const length = jalaliMonthLength(month.jy, month.jm)
  for (let jd = 1; jd <= length; jd += 1) {
    if (!lunch.rows.has(jd) || !dinner.rows.has(jd)) {
      return { ok: false, error: `تاریخ ${dateLabel(month.jy, month.jm, jd)} در هر دو شیت «ناهار» و «شام» نیست. همه روزهای ماه، حتی بدون غذا، باید باشند.` }
    }
  }
  const days: ImportedDayMenu[] = []
  for (let jd = 1; jd <= length; jd += 1) {
    days.push({ jd, lunch: lunch.rows.get(jd)?.foods ?? [], dinner: dinner.rows.get(jd)?.foods ?? [] })
  }
  return { ok: true, menu: { jy: month.jy, jm: month.jm, days } }
}

function sheetPaths(workbook: string, rels: string) {
  const targets = new Map<string, string>()
  for (const rel of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) targets.set(rel[1], rel[2])
  const sheets = new Map<string, string>()
  for (const sheet of workbook.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const target = targets.get(attr(sheet[1], 'r:id'))
    const name = decodeXml(attr(sheet[1], 'name'))
    if (target && name) sheets.set(name, `xl/${target.replace(/^\//, '')}`)
  }
  return sheets
}

function sharedStrings(xml: string) {
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((item) =>
    [...item[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1])).join(''),
  )
}

function readSheet(
  xml: string,
  strings: string[],
  sheet: string,
  required: string[],
  month: Pick<JalaliDate, 'jy' | 'jm'>,
): { ok: true; rows: Map<number, ParsedRow & { excelRow: number }> } | { ok: false; error: string } {
  if (!xml) return { ok: false, error: `شیت «${sheet}» در فایل پیدا نشد.` }
  const grid = new Map<number, Map<number, string>>()
  for (const cell of xml.matchAll(/<c\b(?![^>]*\/>)([^>]*)>([\s\S]*?)<\/c>/g)) {
    const ref = attr(cell[1], 'r')
    if (!ref) continue
    const column = columnIndex(ref)
    const row = Number(ref.replace(/[A-Z]/g, ''))
    const type = attr(cell[1], 't')
    const value = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1]
    const inline = [...cell[2].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1])).join('')
    const text = type === 's' ? strings[Number(value)] ?? '' : type === 'inlineStr' ? inline : decodeXml(value ?? inline)
    if (!grid.has(row)) grid.set(row, new Map())
    grid.get(row)?.set(column, text.trim())
  }
  const header = [...grid.entries()].find(([, cells]) => [...cells.values()].includes('ردیف'))
  if (!header) return { ok: false, error: `شیت «${sheet}» ستون‌های ردیف، روز، تاریخ و نوع غذا را ندارد.` }
  const labels = header[1]
  for (const name of required) {
    if (columnOf(labels, name) === undefined) return { ok: false, error: `شیت «${sheet}» ستون «${name}» را ندارد.` }
  }
  const indexCol = columnOf(labels, 'ردیف')
  const dayCol = columnOf(labels, 'روز')
  const dateCol = columnOf(labels, 'تاریخ')
  const foodCols = FOOD_COLUMNS.flatMap((name) => {
    const column = columnOf(labels, name)
    return column === undefined ? [] : [column]
  })
  if (indexCol === undefined || dayCol === undefined || dateCol === undefined) return { ok: false, error: `شیت «${sheet}» ستون‌های ردیف، روز و تاریخ را ندارد.` }
  const parsed = new Map<number, ParsedRow & { excelRow: number }>()
  for (const [index, cells] of grid) {
    if (index <= header[0]) continue
    const fields = [indexCol, dayCol, dateCol, ...foodCols].map((column) => cells.get(column) ?? '')
    if (fields.every((item) => !item.trim())) continue
    const dateText = latinDigits(cells.get(dateCol) ?? '').trim()
    if (!dateText) return { ok: false, error: `سطر ${fa(index)} در شیت «${sheet}» تاریخ ندارد.` }
    const match = DATE.exec(dateText)
    if (!match) return { ok: false, error: `تاریخ «${dateText}» در شیت «${sheet}»، سطر ${fa(index)}، با قالب ۱۴۰۵/۰۶/۰۱ نیست.` }
    const jy = Number(match[1])
    const jm = Number(match[2])
    const jd = Number(match[3])
    const label = dateLabel(jy, jm, jd)
    if (!isValidJalaliDate(jy, jm, jd)) return { ok: false, error: `تاریخ ${label} در شیت «${sheet}»، سطر ${fa(index)}، در تقویم شمسی وجود ندارد.` }
    if (jy !== month.jy || jm !== month.jm) return { ok: false, error: `تاریخ ${label} در شیت «${sheet}»، سطر ${fa(index)}، خارج از ماه انتخاب‌شده است.` }
    const weekday = cells.get(dayCol) ?? ''
    const expected = weekdayName({ jy, jm, jd })
    if (normalizeDay(weekday) !== normalizeDay(expected)) {
      return { ok: false, error: `در شیت «${sheet}»، سطر ${fa(index)}، تاریخ ${label} با روز «${weekday || 'خالی'}» هم‌خوان نیست. روز این تاریخ «${expected}» است.` }
    }
    if (parsed.has(jd)) return { ok: false, error: `تاریخ ${label} در شیت «${sheet}»، سطر ${fa(index)}، تکراری است. ردیف قبلی جایگزین نمی‌شود.` }
    const foods = foodCols
      .map((column) => cells.get(column) ?? '')
      .map((item) => item.trim())
      .filter((item, position, list) => item && list.indexOf(item) === position)
    parsed.set(jd, { jd, foods, excelRow: index })
  }
  return { ok: true, rows: parsed }
}

function dateLabel(jy: number, jm: number, jd: number) {
  return `${fa(jy)}/${fa(String(jm).padStart(2, '0'))}/${fa(String(jd).padStart(2, '0'))}`
}

function normalizeDay(value: string) {
  return value.replace(/\u200c/g, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک')
}

function latinDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (char) => {
    const persian = '۰۱۲۳۴۵۶۷۸۹'.indexOf(char)
    if (persian >= 0) return String(persian)
    return String('٠١٢٣٤٥٦٧٨٩'.indexOf(char))
  })
}

function columnOf(labels: Map<number, string>, name: string) {
  return [...labels.entries()].find(([, label]) => label === name)?.[0]
}

function columnIndex(ref: string) {
  let index = 0
  for (const char of ref.replace(/\d/g, '')) index = index * 26 + char.charCodeAt(0) - 64
  return index - 1
}

function attr(source: string, name: string) {
  return source.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? ''
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

async function unzipText(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  let eocd = -1
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 66000); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocd = index
      break
    }
  }
  if (eocd < 0) throw new Error('zip')
  const count = view.getUint16(eocd + 10, true)
  let cursor = view.getUint32(eocd + 16, true)
  const files = new Map<string, string>()
  const decoder = new TextDecoder()
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('zip')
    const method = view.getUint16(cursor + 10, true)
    const size = view.getUint32(cursor + 20, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const local = view.getUint32(cursor + 42, true)
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength))
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    const compressed = bytes.subarray(dataStart, dataStart + size)
    const raw = method === 0 ? compressed : method === 8 ? await inflate(compressed) : null
    if (!raw) throw new Error('zip')
    if (name.endsWith('.xml') || name.endsWith('.rels')) files.set(name, decoder.decode(raw))
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return files
}

async function inflate(data: Uint8Array) {
  const copy = new ArrayBuffer(data.byteLength)
  new Uint8Array(copy).set(data)
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
