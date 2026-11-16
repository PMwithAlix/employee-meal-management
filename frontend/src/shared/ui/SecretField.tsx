import { useId, useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '../lib/persian-text'
import { Field, controlClass } from './primitives'

export function SecretField({
  label,
  value,
  onChange,
  onBlur,
  error,
  autoComplete,
  actions,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  autoComplete?: string
  actions?: ReactNode
}) {
  const [visible, setVisible] = useState(false)
  const errorId = useId()
  const invalid = Boolean(error)
  return (
    <Field label={label}>
      <div className="flex gap-1">
        <input
          className={cn(controlClass, invalid && 'border-danger')}
          dir="ltr"
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
        <button
          type="button"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line bg-surface text-muted hover:bg-surface2"
          aria-label={visible ? 'پنهان کردن رمز' : 'نمایش رمز'}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        {actions}
      </div>
      {error ? <p id={errorId} className="mt-1 text-sm text-danger" role="alert">{error}</p> : null}
    </Field>
  )
}
