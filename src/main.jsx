import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'
import { initErrorReporting } from './lib/errorReporter'
import { initNotifyFlush } from './lib/notify'
import { ErrorBoundary } from './components/ErrorBoundary'

// Captadores globales de errores → Discord (antes de renderizar nada).
initErrorReporting()
// Reintento de notificaciones de negocio encoladas offline.
initNotifyFlush()

// Registro del Service Worker (PWA / modo offline).
// `autoUpdate` aplica la versión nueva y recarga cuando el SW se actualiza, PERO
// el navegador solo busca actualizaciones al abrir o navegar. En una app que
// queda abierta horas (brigadistas), eso deja al usuario con el bundle viejo
// —y por tanto reenviando errores YA corregidos— hasta que recargue a mano.
// Forzamos la comprobación cada hora y cada vez que la pestaña recupera el foco,
// para que una corrección desplegada llegue a todos sin pedirles nada.
const INTERVALO_ACTUALIZACION_MS = 60 * 60 * 1000 // 1 hora
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registro) {
    if (!registro) return
    const buscarActualizacion = async () => {
      if (registro.installing || !navigator.onLine) return
      try { await registro.update() } catch { /* sin red o SW ocupado: reintentará */ }
    }
    setInterval(buscarActualizacion, INTERVALO_ACTUALIZACION_MS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') buscarActualizacion()
    })
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
