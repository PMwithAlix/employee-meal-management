import { AuthProvider, useAuth } from './auth/AuthProvider'
import { StoreProvider } from './store'
import { Shell } from './components/Shell'
import { Login } from './pages/Login'
import { SessionSplash } from './pages/SessionStatus'

function AppShell() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return <SessionSplash title="در حال بررسی نشست" body="صبر کنید تا وضعیت ورود شما از سامانه خوانده شود." />
  }

  if (auth.status === 'unavailable') {
    return (
      <SessionSplash
        title="سامانه در دسترس نیست"
        body="ارتباط با سرور برقرار نشد. این به‌معنای خروج از حساب نیست؛ پس از برقراری ارتباط دوباره تلاش کنید."
        action={{ label: 'تلاش دوباره', onClick: auth.retrySession }}
      />
    )
  }

  if (auth.status === 'invalid-role') {
    return (
      <SessionSplash
        title="نقش این حساب پشتیبانی نمی‌شود"
        body="نقش دریافت‌شده از سرور در این نسخه سامانه تعریف نشده است. با پشتیبانی تماس بگیرید."
        action={{ label: 'خروج', onClick: () => void auth.logout() }}
      />
    )
  }

  if (auth.status !== 'authenticated' || !auth.user) {
    return <Login />
  }

  return (
    <StoreProvider session={auth.user} onLogout={auth.logout}>
      <Shell />
    </StoreProvider>
  )
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
