import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function KmScreen({ title, subtitle, children, actions }: { title: string; subtitle?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="km-screen">
      <header className="km-header">
        <div>
          <p className="km-kicker">خوان</p>
          <h1>{title}</h1>
          {subtitle ? <p className="km-sub">{subtitle}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  )
}

export function KmButton({
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'quiet' }) {
  return <button type="button" className={`km-btn km-btn-${variant}`} {...props} />
}

export function KmSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="km-stack" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className="km-skel" style={{ width: index === lines - 1 ? '64%' : '100%' }} />
      ))}
    </div>
  )
}

export function KmState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="km-state">
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  )
}

export function KmToast({ text }: { text: string }) {
  if (!text) return null
  return <div className="km-toast" role="status">{text}</div>
}
