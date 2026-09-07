// ─────────────────────────────────────────────────────────────────────────────
// Proxy serverless (Vercel) → Discord — enrutador de notificaciones
//
// El navegador publica AQUÍ (no directo a Discord) para que las URLs de los
// webhooks NO viajen en el bundle público. Cada evento va a su propio canal.
//
// Configura en Vercel → Settings → Environment Variables (SIN prefijo VITE_):
//
//   DISCORD_WEBHOOK_ERRORES              → canal #errores-medtrack
//   DISCORD_WEBHOOK_NUEVO_MEDICAMENTO    → canal #nuevo-medicamento
//   DISCORD_WEBHOOK_NUEVO_ITEM           → canal #nuevo-item
//   DISCORD_WEBHOOK_NUEVO_BENEFICIARIO   → canal #nuevo-beneficiario
//   DISCORD_WEBHOOK_DONACION_ENTREGADA   → canal #donacion-entregada
//   DISCORD_WEBHOOK_NUEVO_DONANTE        → canal #nuevo-donante
//   DISCORD_WEBHOOK_DONACION_RECIBIDA    → canal #donacion-recibida
//
// Vuelve a desplegar tras añadirlas. Un evento sin su webhook configurado
// responde 200 sin enviar nada (no rompe la app).
// ─────────────────────────────────────────────────────────────────────────────

// evento → variable de entorno del webhook
const CANALES = {
  error: 'DISCORD_WEBHOOK_ERRORES',
  'nuevo-medicamento': 'DISCORD_WEBHOOK_NUEVO_MEDICAMENTO',
  'nuevo-item': 'DISCORD_WEBHOOK_NUEVO_ITEM',
  'nuevo-beneficiario': 'DISCORD_WEBHOOK_NUEVO_BENEFICIARIO',
  'donacion-entregada': 'DISCORD_WEBHOOK_DONACION_ENTREGADA',
  'nuevo-donante': 'DISCORD_WEBHOOK_NUEVO_DONANTE',
  'donacion-recibida': 'DISCORD_WEBHOOK_DONACION_RECIBIDA',
};

const clip = (v, max) => {
  const s = v == null ? '' : String(v);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
};

// Solo se redacta el canal de ERRORES (un stack puede arrastrar PII sin querer).
// Los canales de negocio envían datos completos a propósito (trazabilidad).
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

  let p = req.body;
  if (typeof p === 'string') {
    try { p = JSON.parse(p); } catch { p = {}; }
  }
  p = p || {};

  const evento = p.evento;
  const envVar = CANALES[evento];
  if (!envVar) {
    res.status(400).json({ ok: false, reason: 'evento_desconocido', evento });
    return;
  }

  const webhook = process.env[envVar];
  if (!webhook) {
    res.status(200).json({ ok: false, reason: 'webhook_no_configurado', canal: envVar });
    return;
  }

  const esError = evento === 'error';
  const limpiar = esError ? redactar : (v) => v;

  // Campos → embed fields de Discord (máx 25, value ≤ 1024)
  const campos = Array.isArray(p.campos) ? p.campos.slice(0, 25) : [];
  const fields = campos.map((c) => ({
    name: clip(limpiar(c.name), 240) || '—',
    value: clip(limpiar(c.value), 1024) || '—',
    inline: !!c.inline,
  }));

  const embed = {
    title: clip(limpiar(p.titulo), 240) || evento,
    color: typeof p.color === 'number' ? p.color : 0x10b981,
    description: p.descripcion ? clip(limpiar(p.descripcion), 4000) : undefined,
    fields: fields.length ? fields : undefined,
    timestamp: p.timestamp || new Date().toISOString(),
  };

  try {
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: clip(p.username, 80) || 'MedTrack',
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
