import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'
import { initErrorReporting } from './lib/errorReporter'
import { ErrorBoundary } from './components/ErrorBoundary'

// Captadores globales de errores → Discord (antes de renderizar nada).
initErrorReporting()

// Registro automático del Service Worker para modo offline
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
