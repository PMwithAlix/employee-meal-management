export type ClockParts = { hour: number; minute: number }

export function parseClock(value: string): ClockParts | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim())
  if (!match) return null
  return { hour: Number(match[1]), minute: Number(match[2]) }
}

export function formatClock(hour: number, minute: number): string | null {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function clockMinutes(step: number, current?: number) {
  const size = Number.isInteger(step) && step > 0 ? Math.min(step, 30) : 5
  const values = Array.from({ length: Math.ceil(60 / size) }, (_, index) => index * size).filter((minute) => minute < 60)
  if (current !== undefined && Number.isInteger(current) && current >= 0 && current <= 59 && !values.includes(current)) {
    return [...values, current].sort((left, right) => left - right)
  }
  return values
}

export const CLOCK_PRESETS = ['08:00', '10:00', '12:00', '13:00', '19:00', '21:00'] as const
