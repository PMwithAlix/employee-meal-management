import type { ReactNode, MouseEvent } from 'react'
import { useApp } from '../app/providers/app-store'
import { isPlainLeftClick } from '../shared/config/app-routes'
import type { Page } from '../shared/types/domain'

export function AppNavLink({
  page,
  className,
  children,
  title,
  onNavigate,
}: {
  page: Page
  className?: string
  children: ReactNode
  title?: string
  onNavigate?: () => void
}) {
  const app = useApp()
  const active = app.routeStatus === 'ok' && app.page === page
  return (
    <a
      href={app.hrefFor(page)}
      title={title}
      aria-current={active ? 'page' : undefined}
      className={className}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (!isPlainLeftClick(event)) return
        event.preventDefault()
        app.setPage(page)
        onNavigate?.()
      }}
    >
      {children}
    </a>
  )
}
