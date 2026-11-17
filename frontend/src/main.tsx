import '@fontsource/vazirmatn/400.css'
import '@fontsource/vazirmatn/500.css'
import '@fontsource/vazirmatn/600.css'
import '@fontsource/vazirmatn/700.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { isBaleMiniAppEnabled, isMiniAppPath } from './mini-app/lib/flag'

const root = createRoot(document.getElementById('root')!)

if (isBaleMiniAppEnabled() && isMiniAppPath()) {
  void import('./mini-app/MiniApp').then(({ MiniApp }) => {
    root.render(
      <StrictMode>
        <MiniApp />
      </StrictMode>,
    )
  })
} else {
  void import('./app/App').then(({ App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
