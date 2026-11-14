import { useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Field, controlClass } from './primitives'

export function SecretField({
  label,
  value,
  onChange,
  error,
  autoComplete,
  actions,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  autoComplete?: string
  actions?: ReactNode
}) {
  const [visible, setVisible] = useState(false)
  return (
    <Field label={label}>
      <div className="flex gap-1">
        <input
          className={controlClass}
          dir="ltr"
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line bg-surface text-muted hover:bg-surface2"
          aria-label={visible ? 'پنهان کردن رمز' : 'نمایش رمز'}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        {actions}
      </div>
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </Field>
  )
}
