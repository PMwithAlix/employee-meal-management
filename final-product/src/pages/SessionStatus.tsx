import { BrandWordmark } from '../components/Brand'
import { Button } from '../components/ui'

export function SessionSplash({ title, body, action }: { title: string; body: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 text-ink">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface px-5 py-6 text-center shadow-card">
        <BrandWordmark className="mx-auto h-12" />
        <h1 className="mt-4 text-sm font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
        {action && (
          <Button type="button" className="mt-4 w-full rounded-full" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    </div>
  )
}
