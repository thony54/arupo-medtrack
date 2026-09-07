// ─────────────────────────────────────────────────────────────────────────────
// Reporter de errores → Discord (canal #errores-medtrack)
//
// Captura los errores de la app (no controlados, promesas rechazadas, crashes de
// React y todos los `console.error` que ya usan las páginas) y los envía al canal
// de errores vía el proxy serverless unificado `/api/notify` (evento: 'error').
//
// PRIVACIDAD (importante en esta app, ver SECURITY.local.md):
//   - Los webhooks NUNCA viven en el bundle del navegador. El cliente publica a
//     `/api/notify`, que guarda las URLs en env SIN prefijo VITE_ (secretas) y
//     enruta cada evento a su canal.
//   - Antes de enviar, cada texto pasa por `redactar()`: correos, cédulas,
//     teléfonos, JWT y claves `sb_...` se sustituyen por marcadores. Así un
//     error nunca filtra datos clínicos ni personales al canal de errores.
//     (Los canales de negocio SÍ envían datos completos a propósito; ver notify.js)
//   - Solo para pruebas locales sin Vercel se puede definir
//     VITE_DISCORD_WEBHOOK_URL y el cliente publicará el error directo a ese
//     webhook (modo directo, solo errores).
//
// El módulo es defensivo: si algo falla aquí, NUNCA debe romper la app ni
// entrar en bucle (usa la referencia original de console.error).
// ─────────────────────────────────────────────────────────────────────────────

const PROXY_ENDPOINT = '/api/notify';
const DIRECT_WEBHOOK = import.meta.env?.VITE_DISCORD_WEBHOOK_URL || '';
const APP_ENV = import.meta.env?.MODE || 'production';
const APP_VERSION = import.meta.env?.VITE_APP_VERSION || APP_ENV;

// Anti-spam
const DEDUPE_MS = 60_000;      // no repetir el mismo error dentro de 1 min
const MAX_PER_MINUTE = 12;     // tope de envíos por minuto (Discord limita ~30)
const QUEUE_KEY = 'medtrack_error_queue';
const QUEUE_MAX = 30;

const COLORES = { fatal: 0x991b1b, error: 0xef4444, warn: 0xf59e0b, info: 0x10b981 };
const EMOJI = { fatal: '💥', error: '🛑', warn: '⚠️', info: 'ℹ️' };

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
  s = s.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]');
  s = s.replace(/sb_[a-zA-Z0-9_-]{10,}/g, '[clave]');
  s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[correo]');
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
      .replace(/\/[0-9a-fA-F-]{16,}(?=\/|$)/g, '/:id')
      .replace(/\/\d+(?=\/|$)/g, '/:id');
  } catch {
    return '?';
  }
};

const rolActual = () => {
  try {
    return window.__MEDTRACK_ROLE__ || 'anon';
  } catch {
    return 'anon';
  }
};

// ── Cola offline ─────────────────────────────────────────────────────────────
const leerCola = () => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
};
const guardarCola = (arr) => {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(arr.slice(-QUEUE_MAX))); } catch { /* lleno */ }
};
const encolar = (info) => {
  const cola = leerCola();
  cola.push(info);
  guardarCola(cola);
};

// ── Mapeo a payload / embed ──────────────────────────────────────────────────
const campos = (info) => [
  { name: 'Ruta', value: info.route || '?', inline: true },
  { name: 'Rol', value: info.role || 'anon', inline: true },
  { name: 'Fuente', value: info.source || '?', inline: true },
  { name: 'Entorno', value: info.appVersion || '?', inline: true },
  { name: 'Online', value: info.online ? 'sí' : 'no', inline: true },
  { name: 'Navegador', value: clip(info.userAgent, 90), inline: false },
];

// Payload para el proxy unificado (/api/notify, evento: 'error').
const aPayloadNotify = (info) => ({
  evento: 'error',
  username: 'MedTrack · Errores',
  titulo: `${EMOJI[info.level] || EMOJI.error} ${clip(info.message, 240)}`,
  descripcion: info.stack ? '```\n' + clip(info.stack, 1800) + '\n```' : undefined,
  campos: campos(info),
  color: COLORES[info.level] ?? COLORES.error,
  timestamp: info.ts,
});

// Embed Discord para modo directo (solo pruebas locales).
const aEmbedDirecto = (info) => ({
  title: `${EMOJI[info.level] || EMOJI.error} ${clip(info.message, 240)}`,
  color: COLORES[info.level] ?? COLORES.error,
  description: info.stack ? '```\n' + clip(info.stack, 1800) + '\n```' : undefined,
  fields: campos(info),
  timestamp: info.ts,
});

// ── Envío ────────────────────────────────────────────────────────────────────
const despachar = async (info) => {
  try {
    let res;
    if (DIRECT_WEBHOOK) {
      res = await fetch(DIRECT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'MedTrack · Errores',
          allowed_mentions: { parse: [] },
          embeds: [aEmbedDirecto(info)],
        }),
        keepalive: true,
      });
    } else {
      res = await fetch(PROXY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aPayloadNotify(info)),
        keepalive: true,
      });
    }
    if (res && !res.ok && res.status !== 204) throw new Error('HTTP ' + res.status);
    ventana.enviados += 1;
  } catch {
    encolar(info); // sin red o webhook caído: reintentar al volver online
  }
};

const vaciarCola = async () => {
  const cola = leerCola();
  if (cola.length === 0) return;
  guardarCola([]);
  for (const info of cola) {
    await despachar(info);
  }
};

// ── API principal ────────────────────────────────────────────────────────────
export const reportError = (error, context = {}) => {
  if (reportando) return;
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

    const firma = level + '|' + String(message).slice(0, 120) + '|' + (context.source || '');
    const ahora = Date.now();
    const prev = vistosRecientes.get(firma);
    if (prev && ahora - prev < DEDUPE_MS) return;
    vistosRecientes.set(firma, ahora);
    if (vistosRecientes.size > 200) vistosRecientes.clear();

    if (ahora - ventana.inicio > 60_000) {
      ventana = { inicio: ahora, enviados: 0, omitidos: 0 };
    }
    if (ventana.enviados >= MAX_PER_MINUTE) {
      ventana.omitidos += 1;
      return;
    }

    const info = {
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

    void despachar(info);
  } catch (e) {
    originalConsoleError('[errorReporter] fallo interno:', e);
  } finally {
    reportando = false;
  }
};

export const reportEvent = (message, context = {}) =>
  reportError(message, { level: 'info', source: 'evento', ...context });

// ── Instalación de captadores globales ───────────────────────────────────────
export const initErrorReporting = () => {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;

  window.addEventListener('error', (e) => {
    if (!e.error && !e.message) return;
    reportError(e.error || e.message, { source: 'window.onerror', level: 'error' });
  });

  window.addEventListener('unhandledrejection', (e) => {
    reportError(e.reason, { source: 'unhandledrejection', level: 'error' });
  });

  window.addEventListener('online', () => { void vaciarCola(); });

  console.error = (...args) => {
    originalConsoleError(...args);
    try {
      const errArg = args.find((a) => a instanceof Error);
      const msg = args
        .map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : safeStringify(a)))
        .join(' ');
      reportError(errArg || msg, { source: 'console.error', level: 'error' });
    } catch {
      /* nunca romper por el interceptor */
    }
  };

  void vaciarCola();
};

const safeStringify = (obj) => {
  try { return JSON.stringify(obj); } catch { return String(obj); }
};
