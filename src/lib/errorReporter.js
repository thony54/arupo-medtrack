// ─────────────────────────────────────────────────────────────────────────────
// Reporter de errores → Discord
//
// Captura los errores de la app (no controlados, promesas rechazadas, crashes de
// React y todos los `console.error` que ya usan las páginas) y los envía a un
// canal de Discord vía webhook.
//
// PRIVACIDAD (importante en esta app, ver SECURITY.local.md):
//   - El webhook NUNCA vive en el bundle del navegador. El cliente publica a
//     `/api/report-error` (proxy serverless en Vercel) que guarda la URL del
//     webhook en `DISCORD_WEBHOOK_URL` (env SIN prefijo VITE_, secreta).
//   - Antes de enviar, cada texto pasa por `redactar()`: correos, cédulas,
//     teléfonos, JWT y claves `sb_...` se sustituyen por marcadores. Así un
//     error nunca filtra datos clínicos ni personales al canal.
//   - Solo para pruebas locales sin Vercel se puede definir
//     VITE_DISCORD_WEBHOOK_URL y el cliente publicará directo al webhook.
//
// El módulo es defensivo: si algo falla aquí, NUNCA debe romper la app ni
// entrar en bucle (usa la referencia original de console.error).
// ─────────────────────────────────────────────────────────────────────────────

const PROXY_ENDPOINT = '/api/report-error';
const DIRECT_WEBHOOK = import.meta.env?.VITE_DISCORD_WEBHOOK_URL || '';
const APP_ENV = import.meta.env?.MODE || 'production';
const APP_VERSION = import.meta.env?.VITE_APP_VERSION || APP_ENV;

// Anti-spam
const DEDUPE_MS = 60_000;      // no repetir el mismo error dentro de 1 min
const MAX_PER_MINUTE = 12;     // tope de envíos por minuto (Discord limita ~30)
const QUEUE_KEY = 'medtrack_error_queue';
const QUEUE_MAX = 30;

// Referencias originales: reportar un fallo del reporter NO debe re-entrar.
const originalConsoleError =
  typeof console !== 'undefined' ? console.error.bind(console) : () => {};

let instalado = false;
let reportando = false;
const vistosRecientes = new Map(); // firma -> timestamp
let ventana = { inicio: Date.now(), enviados: 0, omitidos: 0 };

// ── Redacción de datos sensibles ─────────────────────────────────────────────
const redactar = (texto) => {
  if (texto == null) return '';
  let s = String(texto);
  // JWT (tokens de sesión de Supabase, cabeceras Bearer)
  s = s.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]');
  // Claves publishable/secret de Supabase
  s = s.replace(/sb_[a-zA-Z0-9_-]{10,}/g, '[clave]');
  // Correos
  s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[correo]');
  // Cédulas / teléfonos / secuencias largas de dígitos (7+)
  s = s.replace(/\b\d{7,}\b/g, '[num]');
  return s;
};

const clip = (texto, max) => {
  const s = redactar(texto);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
};

// Ruta actual sin IDs dinámicos: /lotes/abc-123 → /lotes/:id
const rutaSegura = () => {
  try {
    return (window.location.pathname || '/')
      .replace(/\/[0-9a-fA-F-]{16,}(?=\/|$)/g, '/:id') // UUIDs
      .replace(/\/\d+(?=\/|$)/g, '/:id');              // numéricos
  } catch {
    return '?';
  }
};

const rolActual = () => {
  // El rol se guarda en el perfil; lo exponemos vía window para el reporter sin
  // acoplar este módulo a React. AuthContext lo setea (ver más abajo el hook).
  try {
    return window.__MEDTRACK_ROLE__ || 'anon';
  } catch {
    return 'anon';
  }
};

// ── Cola offline ─────────────────────────────────────────────────────────────
const leerCola = () => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
};
const guardarCola = (arr) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(arr.slice(-QUEUE_MAX)));
  } catch {
    /* localStorage lleno o bloqueado: se descarta */
  }
};
const encolar = (payload) => {
  const cola = leerCola();
  cola.push(payload);
  guardarCola(cola);
};

// ── Envío ────────────────────────────────────────────────────────────────────
const enviar = async (payload) => {
  // Modo directo (solo pruebas locales): compone el embed en el navegador.
  if (DIRECT_WEBHOOK) {
    const body = JSON.stringify({
      username: 'MedTrack · Errores',
      allowed_mentions: { parse: [] },
      embeds: [componerEmbed(payload)],
    });
    return fetch(DIRECT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  }
  // Modo proxy (producción): el servidor tiene el webhook y compone el embed.
  return fetch(PROXY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  });
};

// Embed usado solo en modo directo; el proxy tiene su propia copia (server-side).
const COLORES = { fatal: 0x991b1b, error: 0xef4444, warn: 0xf59e0b, info: 0x10b981 };
const componerEmbed = (p) => ({
  title: `${p.level === 'fatal' ? '💥' : p.level === 'warn' ? '⚠️' : '🛑'} ${clip(p.message, 240)}`,
  color: COLORES[p.level] ?? COLORES.error,
  description: p.stack ? '```\n' + clip(p.stack, 1800) + '\n```' : undefined,
  fields: [
    { name: 'Ruta', value: p.route || '?', inline: true },
    { name: 'Rol', value: p.role || 'anon', inline: true },
    { name: 'Fuente', value: p.source || '?', inline: true },
    { name: 'Entorno', value: p.appVersion || '?', inline: true },
    { name: 'Online', value: p.online ? 'sí' : 'no', inline: true },
    { name: 'Navegador', value: clip(p.userAgent, 90), inline: false },
  ],
  timestamp: p.ts,
});

const despachar = async (payload) => {
  try {
    const res = await enviar(payload);
    if (res && !res.ok && res.status !== 204) {
      throw new Error('HTTP ' + res.status);
    }
    ventana.enviados += 1;
  } catch {
    // Sin red o webhook caído: se encola para reintentar al volver online.
    encolar(payload);
  }
};

// Vacía la cola cuando vuelve la conexión.
const vaciarCola = async () => {
  const cola = leerCola();
  if (cola.length === 0) return;
  guardarCola([]); // se reencolan los que fallen dentro de despachar()
  for (const p of cola) {
    await despachar(p);
  }
};

// ── API principal ────────────────────────────────────────────────────────────
export const reportError = (error, context = {}) => {
  if (reportando) return; // corta cualquier recursión
  reportando = true;
  try {
    const level = context.level || 'error';
    const message =
      (error && (error.message || error.reason?.message)) ||
      (typeof error === 'string' ? error : '') ||
      context.message ||
      'Error desconocido';
    const stack =
      (error && (error.stack || error.reason?.stack)) || context.stack || '';

    // Dedupe por firma
    const firma = level + '|' + String(message).slice(0, 120) + '|' + (context.source || '');
    const ahora = Date.now();
    const prev = vistosRecientes.get(firma);
    if (prev && ahora - prev < DEDUPE_MS) return;
    vistosRecientes.set(firma, ahora);
    if (vistosRecientes.size > 200) vistosRecientes.clear();

    // Tope por minuto
    if (ahora - ventana.inicio > 60_000) {
      ventana = { inicio: ahora, enviados: 0, omitidos: 0 };
    }
    if (ventana.enviados >= MAX_PER_MINUTE) {
      ventana.omitidos += 1;
      return;
    }

    const payload = {
      level,
      message: clip(message, 240),
      stack: stack ? clip(stack, 1800) : '',
      source: context.source || 'manual',
      route: rutaSegura(),
      role: rolActual(),
      appVersion: APP_VERSION,
      userAgent: (navigator && navigator.userAgent) || '?',
      online: navigator ? navigator.onLine : true,
      ts: new Date().toISOString(),
    };

    // No bloquear el hilo; los fallos se tragan dentro de despachar().
    void despachar(payload);
  } catch (e) {
    originalConsoleError('[errorReporter] fallo interno:', e);
  } finally {
    reportando = false;
  }
};

// Evento/mensaje manual (no necesariamente un Error). Útil para avisos puntuales.
export const reportEvent = (message, context = {}) =>
  reportError(message, { level: 'info', source: 'evento', ...context });

// ── Instalación de captadores globales ───────────────────────────────────────
export const initErrorReporting = () => {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;

  // 1) Errores JS no controlados
  window.addEventListener('error', (e) => {
    // Errores de carga de recursos (img/script) no traen e.error; se ignoran.
    if (!e.error && !e.message) return;
    reportError(e.error || e.message, { source: 'window.onerror', level: 'error' });
  });

  // 2) Promesas rechazadas sin catch
  window.addEventListener('unhandledrejection', (e) => {
    reportError(e.reason, { source: 'unhandledrejection', level: 'error' });
  });

  // 3) Reintentar cola al recuperar red
  window.addEventListener('online', () => {
    void vaciarCola();
  });

  // 4) Interceptar console.error (todo el código ya reporta errores así)
  //    sin perder el log en la consola local.
  console.error = (...args) => {
    originalConsoleError(...args);
    try {
      const errArg = args.find((a) => a instanceof Error);
      const msg = args
        .map((a) =>
          a instanceof Error ? a.message : typeof a === 'string' ? a : safeStringify(a)
        )
        .join(' ');
      reportError(errArg || msg, { source: 'console.error', level: 'error' });
    } catch {
      /* nunca romper por el interceptor */
    }
  };

  // Enviar lo que quedó de sesiones anteriores.
  void vaciarCola();
};

const safeStringify = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
};
