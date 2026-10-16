import React, { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Protección de pantalla (MEJOR ESFUERZO)
//
// Una página web NO puede impedir que el sistema operativo capture o grabe la
// pantalla (eso solo lo logra una app nativa: FLAG_SECURE en Android, o un
// envoltorio con Capacitor). Lo que sí puede hacer es dificultarlo y reducir la
// exposición, ocultando el contenido con una cortina cuando:
//   · la pestaña/app pasa a segundo plano (cambio de app, minimizar; en iPhone
//     esto cubre el "blur guard" de la vista previa del selector de apps),
//   · la ventana pierde el foco (modo 'estricta': las herramientas de recorte
//     como Win+Shift+S lo provocan),
//   · se pulsa PrintScreen o un atajo de captura de macOS (además se vacía el
//     portapapeles),
//   · se intenta imprimir con Ctrl/Cmd+P (se bloquea el atajo). No se toca la
//     impresión desde botones: las actas y comprobantes se imprimen desde un
//     iframe propio y deben seguir funcionando, también en iPad.
//
// Se puede quitar con VITE_PROTECCION_PANTALLA=off, o relajar con =suave (solo
// segundo plano y atajos, sin ocultar por pérdida de foco). En desarrollo
// (npm run dev) está desactivada. Es un disuasivo, no una garantía.
// ─────────────────────────────────────────────────────────────────────────────

const MODO = (import.meta.env.VITE_PROTECCION_PANTALLA || 'estricta').toLowerCase();
const ACTIVA = import.meta.env.PROD && MODO !== 'off';
const ESTRICTA = MODO !== 'suave';

const esAtajoDeCaptura = (e) =>
  e.key === 'PrintScreen' ||
  (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key));

const esAtajoDeImpresion = (e) => (e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'p';

export const ProteccionPantalla = () => {
  const { session } = useAuth() || {};
  const protegiendo = ACTIVA && !!session;
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    if (!protegiendo) return;

    const ocultar = () => setOculto(true);
    const mostrar = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) setOculto(false);
    };

    const alCambiarVisibilidad = () => (document.visibilityState === 'hidden' ? ocultar() : mostrar());

    const alPulsarTecla = (e) => {
      if (esAtajoDeImpresion(e)) {
        e.preventDefault();
        ocultar();
        setTimeout(mostrar, 1200);
        return;
      }
      if (esAtajoDeCaptura(e)) {
        ocultar();
        // Vacía el portapapeles por si la captura quedó ahí (PrintScreen en Windows).
        if (e.key === 'PrintScreen') navigator.clipboard?.writeText('').catch(() => {});
        setTimeout(mostrar, 1500);
      }
    };

    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    window.addEventListener('keydown', alPulsarTecla);
    window.addEventListener('keyup', alPulsarTecla);
    window.addEventListener('focus', mostrar);
    if (ESTRICTA) window.addEventListener('blur', ocultar);

    return () => {
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      window.removeEventListener('keydown', alPulsarTecla);
      window.removeEventListener('keyup', alPulsarTecla);
      window.removeEventListener('focus', mostrar);
      if (ESTRICTA) window.removeEventListener('blur', ocultar);
    };
  }, [protegiendo]);

  if (!protegiendo || !oculto) return null;

  // Un clic descarta la cortina: evita que quede atascada si el navegador no avisa del foco.
  return (
    <div
      onClick={() => setOculto(false)}
      role="presentation"
      style={{
        position: 'fixed', inset: 0, zIndex: 2147483647,
        background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '0.75rem', color: '#fff', textAlign: 'center', padding: '2rem', cursor: 'pointer'
      }}
    >
      <ShieldAlert size={44} />
      <strong style={{ fontSize: '1.15rem' }}>Contenido protegido</strong>
      <span style={{ fontSize: '0.9rem', opacity: 0.8, maxWidth: '360px' }}>
        Por confidencialidad, la información se oculta cuando sales de la aplicación. Vuelve a MedTrack o toca la pantalla para continuar.
      </span>
    </div>
  );
};
