// ─────────────────────────────────────────────────────────────────────────────
// Proxy serverless (Vercel) → Discord
//
// El navegador publica AQUÍ, no directo a Discord, para que la URL del webhook
// NO viaje en el bundle público. Configura en Vercel:
//
//   Settings → Environment Variables
//   DISCORD_WEBHOOK_URL = https://discord.com/api/webhooks/XXXX/YYYY
//   (SIN prefijo VITE_ → queda solo en el servidor)
//
// Vuelve a desplegar tras añadirla. Sin la variable, el endpoint responde 200
// pero no envía nada (no rompe la app).
// ─────────────────────────────────────────────────────────────────────────────

const COLORES = { fatal: 0x991b1b, error: 0xef4444, warn: 0xf59e0b, info: 0x10b981 };
const EMOJI = { fatal: '💥', error: '🛑', warn: '⚠️', info: 'ℹ️' };

const clip = (v, max) => {
  const s = v == null ? '' : String(v);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
};

// Defensa en profundidad: el cliente ya redacta, pero el servidor vuelve a
// tapar correos, cédulas, JWT y claves por si acaso.
const redactar = (texto) =>
  clip(texto, 4000)
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]')
    .replace(/sb_[a-zA-Z0-9_-]{10,}/g, '[clave]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[correo]')
    .replace(/\b\d{7,}\b/g, '[num]');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    // No configurado todavía: no es un error del cliente.
    res.status(200).json({ ok: false, reason: 'webhook_no_configurado' });
    return;
  }

  let p = req.body;
  if (typeof p === 'string') {
    try { p = JSON.parse(p); } catch { p = {}; }
  }
  p = p || {};

  const level = ['fatal', 'error', 'warn', 'info'].includes(p.level) ? p.level : 'error';

  const embed = {
    title: `${EMOJI[level]} ${clip(redactar(p.message) || 'Error desconocido', 240)}`,
    color: COLORES[level],
    description: p.stack ? '```\n' + redactar(p.stack).slice(0, 1800) + '\n```' : undefined,
    fields: [
      { name: 'Ruta', value: clip(p.route, 200) || '?', inline: true },
      { name: 'Rol', value: clip(p.role, 40) || 'anon', inline: true },
      { name: 'Fuente', value: clip(p.source, 60) || '?', inline: true },
      { name: 'Entorno', value: clip(p.appVersion, 60) || '?', inline: true },
      { name: 'Online', value: p.online ? 'sí' : 'no', inline: true },
      { name: 'Navegador', value: clip(redactar(p.userAgent), 120) || '?', inline: false },
    ],
    timestamp: p.ts || new Date().toISOString(),
  };

  try {
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'MedTrack · Errores',
        allowed_mentions: { parse: [] }, // nunca @everyone/@here
        embeds: [embed],
      }),
    });

    if (!r.ok && r.status !== 204) {
      res.status(502).json({ ok: false, discord_status: r.status });
      return;
    }
    res.status(204).end();
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e && e.message) });
  }
}
