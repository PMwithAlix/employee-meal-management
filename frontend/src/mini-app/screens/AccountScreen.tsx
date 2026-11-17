import { ROLE_LABEL } from '../../shared/fixtures/seed-data'
import { useMiniAuth } from '../auth/MiniAuth'
import { KmButton, KmScreen } from '../ui/primitives'

export function AccountScreen() {
  const { user, logout } = useMiniAuth()
  if (!user) return null
  return (
    <KmScreen title="حساب کاربری" subtitle="خروج فقط نشست همین دستگاه را می‌بندد.">
      <article className="km-card">
        <h2>{user.username}</h2>
        <p>{ROLE_LABEL[user.role]}</p>
      </article>
      <article className="km-card">
        <h2>تغییر رمز و تنظیمات سامانه</h2>
        <p>تغییر رمز، تنظیم وعده و عملیات سازمانی در نسخه وب انجام می‌شود تا مسیر موبایل ساده بماند.</p>
      </article>
      <KmButton variant="danger" onClick={() => void logout()}>خروج</KmButton>
    </KmScreen>
  )
}
