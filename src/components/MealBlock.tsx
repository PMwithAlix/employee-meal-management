import { Check, Lock, Moon, Sun, Minus } from 'lucide-react'
import { cn } from '../lib/text'
import type { MealKind } from '../types'

export function MealBlock({
  kind,
  choice,
  locked,
  defined,
  orphan,
  onSelect,
  dense,
}: {
  kind: MealKind
  choice: string | null
  locked: boolean
  defined: boolean
  orphan?: boolean
  onSelect?: () => void
  dense?: boolean
}) {
  const lunch = kind === 'lunch'
  const Icon = lunch ? Sun : Moon
  const label = lunch ? 'ناهار' : 'شام'
  const body = !defined ? (
    <span className="text-muted">منو تعریف نشده</span>
  ) : choice ? (
    <span className="font-medium text-ink">{choice}</span>
  ) : (
    <span className="text-muted">انتخاب نشده</span>
  )

  const inner = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className={cn('inline-flex items-center gap-1 text-xs font-medium', lunch ? 'text-lunch' : 'text-dinner')}>
          <Icon size={13} aria-hidden />
          {label}
        </span>
        {defined && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted">
            {locked ? <Lock size={11} aria-hidden /> : null}
            {locked ? 'مهلت تمام' : 'باز'}
          </span>
        )}
      </span>
      <span className={cn('mt-1 flex items-start gap-1 text-sm', dense && 'text-[13px]')}>
        {defined && choice ? <Check size={14} className="mt-0.5 shrink-0 text-ok" aria-hidden /> : null}
        {defined && !choice ? <Minus size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden /> : null}
        <span>
          {body}
          {orphan && <span className="mt-0.5 block text-[11px] text-warn">در منوی فعلی نیست</span>}
        </span>
      </span>
    </>
  )

  const className = cn(
    'block w-full rounded-md border px-2.5 py-2 text-start',
    !defined && 'border-line bg-surface2 text-muted',
    defined && !choice && lunch && 'border-dashed border-lunchline bg-lunchbg',
    defined && !choice && !lunch && 'border-dashed border-dinnerline bg-dinnerbg',
    defined && choice && !locked && lunch && 'border-lunchlinesel bg-lunchbgsel',
    defined && choice && !locked && !lunch && 'border-dinnerlinesel bg-dinnerbgsel',
    defined && choice && locked && lunch && 'border-lunchline bg-lunchbg',
    defined && choice && locked && !lunch && 'border-dinnerline bg-dinnerbg',
    onSelect && !choice && 'hover:border-linestrong',
  )

  if (!onSelect) return <div className={className}>{inner}</div>
  return (
    <button type="button" onClick={onSelect} className={className}>
      {inner}
    </button>
  )
}
