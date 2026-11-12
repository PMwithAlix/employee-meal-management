import type { ImportedDayMenu, ImportedMenu } from '../types'

const LUNCH_SHEET = 'ناهار'
const DINNER_SHEET = 'شام'
const DATE = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/

export type MenuFileResult = { ok: true; menu: ImportedMenu } | { ok: false; error: string }

export async function readMenuFile(buffer: ArrayBuffer): Promise<MenuFileResult> {
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
  if (!lunchPath || !dinnerPath) {
    return { ok: false, error: 'فایل باید دقیقاً دو شیت به نام «ناهار» و «شام» داشته باشد.' }
  }
  const strings = sharedStrings(files.get('xl/sharedStrings.xml') ?? '')
  const lunch = readSheet(files.get(lunchPath) ?? '', strings, LUNCH_SHEET)
  if (!lunch.ok) return lunch
  const dinner = readSheet(files.get(dinnerPath) ?? '', strings, DINNER_SHEET)
  if (!dinner.ok) return dinner
  if (lunch.jy !== dinner.jy || lunch.jm !== dinner.jm) {
    return { ok: false, error: 'تاریخ ناهار و شام در یک ماه شمسی نیست.' }
  }
  const days = new Map<number, ImportedDayMenu>()
  for (const row of lunch.rows) days.set(row.jd, { jd: row.jd, lunch: row.foods, dinner: [] })
  for (const row of dinner.rows) {
    const current = days.get(row.jd) ?? { jd: row.jd, lunch: [], dinner: [] }
    current.dinner = row.foods
    days.set(row.jd, current)
  }
  const menuDays = [...days.values()].sort((a, b) => a.jd - b.jd)
  if (menuDays.length === 0) return { ok: false, error: 'در فایل هیچ روزی با تاریخ معتبر پیدا نشد.' }
  return { ok: true, menu: { jy: lunch.jy, jm: lunch.jm, days: menuDays } }
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

function readSheet(xml: string, strings: string[], sheet: string): { ok: true; jy: number; jm: number; rows: Array<{ jd: number; foods: string[] }> } | { ok: false; error: string } {
  if (!xml) return { ok: false, error: `شیت «${sheet}» در فایل پیدا نشد.` }
  const rows = new Map<number, Map<number, string>>()
  for (const cell of xml.matchAll(/<c\b(?![^>]*\/>)([^>]*)>([\s\S]*?)<\/c>/g)) {
    const ref = attr(cell[1], 'r')
    if (!ref) continue
    const column = columnIndex(ref)
    const row = Number(ref.replace(/[A-Z]/g, ''))
    const type = attr(cell[1], 't')
    const value = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1]
    const inline = [...cell[2].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1])).join('')
    const text = type === 's' ? strings[Number(value)] ?? '' : type === 'inlineStr' ? inline : decodeXml(value ?? inline)
    if (!rows.has(row)) rows.set(row, new Map())
    rows.get(row)?.set(column, text.trim())
  }
  const header = [...rows.entries()].find(([, cells]) => cells.get(0) === 'ردیف')
  if (!header) return { ok: false, error: `شیت «${sheet}» ستون‌های ردیف، روز، تاریخ و نوع غذا را ندارد.` }
  const labels = header[1]
  const dateCol = columnOf(labels, 'تاریخ')
  const foodCols = [...labels.entries()].filter(([, label]) => label.startsWith('نوع')).map(([index]) => index)
  if (dateCol === undefined || columnOf(labels, 'روز') === undefined || foodCols.length === 0) {
    return { ok: false, error: `شیت «${sheet}» باید ستون‌های روز، تاریخ و نوع اول را داشته باشد.` }
  }
  const parsed: Array<{ jd: number; foods: string[] }> = []
  let month: { jy: number; jm: number } | null = null
  for (const [index, cells] of rows) {
    if (index <= header[0]) continue
    const date = cells.get(dateCol) ?? ''
    if (!date) continue
    const match = DATE.exec(date)
    if (!match) return { ok: false, error: `تاریخ «${date}» در شیت «${sheet}» با قالب ۱۴۰۵/۰۶/۰۱ نیست.` }
    const jy = Number(match[1])
    const jm = Number(match[2])
    const jd = Number(match[3])
    if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return { ok: false, error: `تاریخ «${date}» در شیت «${sheet}» معتبر نیست.` }
    if (month && (month.jy !== jy || month.jm !== jm)) return { ok: false, error: `شیت «${sheet}» بیش از یک ماه شمسی دارد.` }
    month = { jy, jm }
    const foods = foodCols
      .map((column) => cells.get(column) ?? '')
      .map((item) => item.trim())
      .filter((item, position, list) => item && list.indexOf(item) === position)
    parsed.push({ jd, foods })
  }
  if (!month || parsed.length === 0) return { ok: false, error: `شیت «${sheet}» ردیف تاریخ ندارد.` }
  return { ok: true, jy: month.jy, jm: month.jm, rows: parsed }
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
