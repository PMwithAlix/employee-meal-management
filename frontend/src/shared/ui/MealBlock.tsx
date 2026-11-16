import { memo } from 'react'
import { Check, Lock, Moon, Sun, Minus } from 'lucide-react'
import { cn } from '../lib/persian-text'
import type { MealKind } from '../types/domain'

export const MealBlock = memo(function MealBlock({
  kind,
  choice,
  locked,
  defined,
  orphan,
  onSelect,
  dense,
  expanded,
}: {
  kind: MealKind
  choice: string | null
  locked: boolean
  defined: boolean
  orphan?: boolean
  onSelect?: () => void
  dense?: boolean
  expanded?: boolean
}) {
  const lunch = kind === 'lunch'
  const Icon = lunch ? Sun : Moon
  const label = lunch ? 'ناهار' : 'شام'
  const state = !defined ? 'منو تعریف نشده' : choice ? choice : 'انتخاب نشده'
  const deadline = !defined ? '' : locked ? 'مهلت تمام' : 'باز'
  const action = onSelect ? (choice ? 'تغییر یا حذف' : 'انتخاب غذا') : 'انتخاب غذا'
  const title = !defined ? 'منو تعریف نشده' : choice ? choice : 'انتخاب نشده'

  const inner = (
    <>
      <span className="flex h-4 items-center justify-between gap-2">
        <span className={cn('inline-flex min-w-0 items-center gap-1 text-xs font-medium', lunch ? 'text-lunch' : 'text-dinner')}>
          <Icon size={13} className="shrink-0" aria-hidden />
          {label}
        </span>
        <span className={cn('inline-flex h-4 shrink-0 items-center gap-1 text-[11px] text-muted', !defined && 'invisible')}>
          <Lock size={11} className={cn('shrink-0', locked ? 'visible' : 'invisible')} aria-hidden />
          {deadline || 'باز'}
        </span>
      </span>
      <span className={cn('mt-1 flex min-h-10 items-start gap-1 text-sm', dense && 'min-h-8 text-[13px]')}>
        <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center">
          {defined && choice ? <Check size={14} className="text-ok" aria-hidden /> : null}
          {defined && !choice ? <Minus size={14} className="text-muted" aria-hidden /> : null}
        </span>
        <span className={cn('min-w-0 flex-1 break-words', dense ? 'line-clamp-2 min-h-8 leading-4' : 'line-clamp-2 min-h-10 leading-5', defined && choice ? 'font-medium text-ink' : 'text-muted')}>
          {title}
          {orphan ? ' · در منوی فعلی نیست' : ''}
        </span>
      </span>
      {!dense && (
        <span className={cn('mt-2 block h-5 truncate text-sm font-medium text-link', !onSelect && 'invisible')}>
          {action}
        </span>
      )}
    </>
  )

  const className = cn(
    'box-border block w-full min-w-0 overflow-hidden rounded-md border px-2.5 py-2 text-start',
    onSelect && 'min-h-11',
    !defined && 'border-line bg-surface2 text-muted',
    defined && !choice && lunch && 'border-dashed border-lunchline bg-lunchbg',
    defined && !choice && !lunch && 'border-dashed border-dinnerline bg-dinnerbg',
    defined && choice && !locked && lunch && 'border-lunchlinesel bg-lunchbgsel',
    defined && choice && !locked && !lunch && 'border-dinnerlinesel bg-dinnerbgsel',
    defined && choice && locked && lunch && 'border-lunchline bg-lunchbg',
    defined && choice && locked && !lunch && 'border-dinnerline bg-dinnerbg',
  )
  const accessible = [label, state, deadline, onSelect ? action : ''].filter(Boolean).join('، ')

  if (!onSelect) return <div className={className}>{inner}</div>
  return (
    <button
      type="button"
      onClick={onSelect}
      className={className}
      aria-label={accessible}
      aria-haspopup="listbox"
      aria-expanded={expanded ?? false}
    >
      {inner}
    </button>
  )
})
