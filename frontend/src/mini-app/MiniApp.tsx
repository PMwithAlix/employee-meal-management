import { useEffect, useMemo, useState } from 'react'
import { MiniAuthProvider, useMiniAuth } from './auth/MiniAuth'
import { baleApi } from './api/bale-api'
import { isBaleMiniAppEnabled } from './lib/flag'
import { tabsForRole, type MiniTab } from './nav/routes'
import { AccountScreen } from './screens/AccountScreen'
import { HomeScreen } from './screens/HomeScreen'
import { LoginScreen } from './screens/LoginScreen'
import { MenuScreen } from './screens/MenuScreen'
import { ActivityScreen, OrgOrdersScreen, ReportsScreen, StaffScreen } from './screens/OpsScreens'
import { OrdersScreen } from './screens/OrdersScreen'
import { bootBaleWebApp, getBaleWebApp } from './sdk/bale-webapp'
import { KmButton, KmScreen, KmSkeleton, KmState, KmToast } from './ui/primitives'
import './styles.css'

function MiniAppShell() {
  const auth = useMiniAuth()
  const [tab, setTab] = useState<MiniTab>('home')
  const [toast, setToast] = useState('')
  const [backendEnabled, setBackendEnabled] = useState<boolean | null>(null)
  const tabs = useMemo(() => (auth.user ? tabsForRole(auth.user.role) : []), [auth.user])

  useEffect(() => {
    const webApp = bootBaleWebApp()
    const onBack = () => {
      if (tab !== 'home') {
        setTab('home')
        return
      }
      webApp?.close?.()
    }
    webApp?.BackButton.onClick(onBack)
    if (tab === 'home') webApp?.BackButton.hide()
    else webApp?.BackButton.show()
    return () => webApp?.BackButton.offClick(onBack)
  }, [tab])

  useEffect(() => {
    const controller = new AbortController()
    void baleApi
      .status(controller.signal)
      .then((status) => setBackendEnabled(status.enabled))
      .catch(() => setBackendEnabled(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!isBaleMiniAppEnabled()) {
    return (
      <div className="km-app">
        <main className="km-main">
          <KmState title="مینی‌اپ غیرفعال است" body="این مسیر در این استقرار روشن نشده و روی سامانه اصلی اثری ندارد." />
        </main>
      </div>
    )
  }

  if (auth.status === 'loading' || backendEnabled === null) {
    return (
      <div className="km-app">
        <main className="km-main">
          <KmScreen title="خوان">
            <KmSkeleton lines={4} />
          </KmScreen>
        </main>
      </div>
    )
  }

  if (auth.status === 'unavailable') {
    return (
      <div className="km-app">
        <main className="km-main">
          <KmState title="سامانه در دسترس نیست" body="ارتباط با سرور برقرار نشد." action={<KmButton onClick={auth.retry}>تلاش دوباره</KmButton>} />
        </main>
      </div>
    )
  }

  if (auth.status === 'invalid-role') {
    return (
      <div className="km-app">
        <main className="km-main">
          <KmState title="نقش پشتیبانی نمی‌شود" body="با پشتیبانی تماس بگیرید." action={<KmButton onClick={() => void auth.logout()}>خروج</KmButton>} />
        </main>
      </div>
    )
  }

  if (auth.status !== 'authenticated' || !auth.user) {
    return (
      <div className="km-app">
        <main className="km-main">
          <LoginScreen />
          {!getBaleWebApp()?.initData && backendEnabled === false ? (
            <p className="km-muted">بازوی بله روی سرور هنوز فعال نیست. ورود آزمایشی از حساب خوان ممکن است.</p>
          ) : null}
        </main>
      </div>
    )
  }

  const active = tabs.some((item) => item.id === tab) ? tab : 'home'

  return (
    <div className="km-app">
      <main className="km-main">
        {active === 'home' ? <HomeScreen onOpen={setTab} /> : null}
        {active === 'menu' ? <MenuScreen toast={setToast} /> : null}
        {active === 'orders' ? <OrdersScreen toast={setToast} /> : null}
        {active === 'staff' ? <StaffScreen /> : null}
        {active === 'org-orders' ? <OrgOrdersScreen /> : null}
        {active === 'reports' ? <ReportsScreen /> : null}
        {active === 'activity' ? <ActivityScreen /> : null}
        {active === 'account' ? <AccountScreen /> : null}
      </main>
      <nav className="km-tabs" aria-label="ناوبری مینی‌اپ">
        {tabs.map((item) => (
          <button key={item.id} className={item.id === active ? 'km-tab is-on' : 'km-tab'} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>
      <KmToast text={toast} />
    </div>
  )
}

export function MiniApp() {
  return (
    <MiniAuthProvider>
      <MiniAppShell />
    </MiniAuthProvider>
  )
}
