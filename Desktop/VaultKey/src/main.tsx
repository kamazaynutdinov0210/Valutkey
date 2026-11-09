import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initInstall } from './pwa/install'
import { initServiceWorker } from './pwa/updates'
import { App } from './ui/App'
import { applyTheme, getTheme } from './ui/prefs'
import './index.css'

applyTheme(getTheme())

initInstall() // must run early: the browser fires its install event only once
initServiceWorker()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing #root element')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
