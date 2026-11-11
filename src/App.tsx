import { useState } from 'react'
import { StoreProvider } from './store'
import { Shell } from './components/Shell'
import { Login } from './pages/Login'

export function App() {
  const [inApp, setInApp] = useState(false)
  if (!inApp) return <Login onSuccess={() => setInApp(true)} />
  return (
    <StoreProvider onLogout={() => setInApp(false)}>
      <Shell />
    </StoreProvider>
  )
}
