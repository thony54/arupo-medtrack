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

// ── Filtro de ruido: errores benignos que NO deben llegar al canal ────────────
// No son bugs accionables, solo generan spam en #errores-medtrack:
//   - Token de refresco de Supabase caducado/ausente → la sesión expiró y la app
//     manda al login sola. Es lo esperado, no un fallo.
//   - "Auth session missing" → no hay sesión (usuario deslogueado). Benigno.
//   - "ResizeObserver loop…" → ruido clásico del navegador, sin efecto real.
//   - Fetch fallido mientras se está SIN conexión → esperado (lo gestiona el offline).
// La lista es fácil de ampliar si aparece otro ruido recurrente.
const PATRONES_RUIDO = [
  /invalid refresh token/i,
  /refresh token not found/i,
  /auth session missing/i,
  /resizeobserver loop (?:limit exceeded|completed)/i,
];

const esRuido = (message, stack, online) => {
  const texto = `${message}\n${stack}`;
  if (PATRONES_RUIDO.some((re) => re.test(texto))) return true;
  // Sin conexión, un fetch fallido es lo esperado (la cola offline se encarga).
  if (!online && /failed to fetch|networkerror|network request failed|load failed/i.test(texto)) {
    return true;
  }
  return false;
};

// ── Presentación legible ──────────────────────────────────────────────────────
// Tipo de error (TypeError, AuthApiError, PostgrestError…) para el título.
const tipoError = (name, stack) => {
  if (name && name !== 'Error') return name;
  const primera = String(stack || '').split('\n')[0] || '';
  const m = primera.match(/^\s*([A-Z][A-Za-z0-9_]*(?:Error|Exception))\b/);
  return m ? m[1] : '';
};

// Stack minificado y ruidoso → primeras líneas útiles, sin repetir el mensaje.
const limpiarStack = (stack, message) => {
  if (!stack) return '';
  let lineas = String(stack).split('\n');
  // La 1ª línea suele ser "TipoError: <mensaje>", que ya va en el título.
  if (lineas[0] && message && lineas[0].includes(String(message).slice(0, 60))) {
    lineas = lineas.slice(1);
  }
  const utiles = lineas.map((l) => l.trim()).filter(Boolean).slice(0, 8);
  return clip(utiles.join('\n'), 1200);
};

// Pista en español para quien lee el canal (solo patrones de alta confianza).
const pistaHumana = (name, message, stack) => {
  const t = `${name} ${message} ${stack}`.toLowerCase();
  if (/postgrest|pgrst|violates|duplicate key|constraint|does not exist|row-level security|\brls\b|jwt expired/.test(t))
    return 'Fallo al leer o guardar en la base de datos (Supabase).';
  if (/failed to fetch|networkerror|network request failed|load failed|err_internet|err_network/.test(t))
    return 'Problema de conexión al contactar el servidor.';
  if (/is not a function|cannot read propert|undefined is not|null is not an object|is not defined|cannot access/.test(t))
    return 'Error de programación en la app (revisar la pantalla de la ruta indicada).';
  if (/chunk|dynamically imported module|importing a module script failed/.test(t))
    return 'La app quedó desactualizada tras un despliegue; recargar la página suele resolverlo.';
  return '';
};

// Navegador + SO en corto, en vez del User-Agent completo (ilegible).
const navegadorCorto = (ua) => {
  if (!ua) return '?';
  const nav = /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari' : 'Otro';
  const so = /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod|iOS/.test(ua) ? 'iOS'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux' : '';
  return so ? `${nav} · ${so}` : nav;
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
  { name: 'Conexión', value: info.online ? '🟢 online' : '🔴 offline', inline: true },
  { name: 'Navegador', value: navegadorCorto(info.userAgent), inline: true },
];

// Título: emoji + tipo de error + mensaje (sin duplicar lo que va en el stack).
const construirTitulo = (info) => {
  const emoji = EMOJI[info.level] || EMOJI.error;
  const tipo = info.tipo ? `${info.tipo} · ` : '';
  return clip(`${emoji} ${tipo}${info.message}`, 240);
};

// Descripción: pista en lenguaje llano (si la hay) + stack ya recortado.
const construirDescripcion = (info) => {
  const partes = [];
  if (info.pista) partes.push(`💡 ${info.pista}`);
  if (info.stack) partes.push('```\n' + info.stack + '\n```');
  return partes.length ? partes.join('\n\n') : undefined;
};

// Payload para el proxy unificado (/api/notify, evento: 'error').
const aPayloadNotify = (info) => ({
  evento: 'error',
  username: 'MedTrack · Errores',
  titulo: construirTitulo(info),
  descripcion: construirDescripcion(info),
  campos: campos(info),
  color: COLORES[info.level] ?? COLORES.error,
  timestamp: info.ts,
});

// Embed Discord para modo directo (solo pruebas locales).
const aEmbedDirecto = (info) => ({
  title: construirTitulo(info),
  color: COLORES[info.level] ?? COLORES.error,
  description: construirDescripcion(info),
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
    const name = (error && (error.name || error.reason?.name)) || '';
    const online = navigator ? navigator.onLine : true;

    // Ruido benigno (token caducado, sesión ausente, red offline…): ni se envía.
    if (esRuido(message, stack, online)) return;

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
      tipo: tipoError(name, stack),
      message: clip(message, 240),
      stack: limpiarStack(stack, message),
      pista: pistaHumana(name, message, stack),
      source: context.source || 'manual',
      route: rutaSegura(),
      role: rolActual(),
      appVersion: APP_VERSION,
      userAgent: (navigator && navigator.userAgent) || '?',
      online,
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
