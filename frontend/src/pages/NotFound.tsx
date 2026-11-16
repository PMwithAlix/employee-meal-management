import { AppNavLink } from '../layouts/AppNavLink'
import { Empty } from '../shared/ui/primitives'

export function NotFoundPage() {
  return (
    <div className="space-y-3">
      <Empty title="این مسیر در سامانه نیست" body="آدرس واردشده با هیچ صفحه‌ای مطابقت ندارد. از منو یک صفحه معتبر را انتخاب کنید." />
      <AppNavLink page="overview" className="inline-flex min-h-11 items-center rounded-md border border-line px-3 text-sm text-link">
        رفتن به نمای کلی
      </AppNavLink>
    </div>
  )
}

export function ForbiddenPage() {
  return (
    <Empty
      title="به این صفحه دسترسی ندارید"
      body="حساب شما مجوز مشاهده این مسیر را ندارد. مسیر در نوار آدرس باقی می‌ماند تا پس از ورود با حساب مناسب همان صفحه باز شود."
    />
  )
}
