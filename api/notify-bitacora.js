// ─────────────────────────────────────────────────────────────────────────────
// Aviso a Discord de una bitácora de voluntariado (con sus fotos adjuntas)
//
// A diferencia de /api/notify (que reenvía lo que manda el navegador), este
// endpoint NO confía en el contenido que llega del cliente:
//   1. Exige la sesión del voluntario (Authorization: Bearer <jwt>).
//   2. Con ESA sesión lee su bitácora desde Supabase (obtener_bitacora_a_notificar:
//      solo si es suya, no se avisó antes y tiene menos de 3 días).
//   3. Descarga las fotos del bucket privado con la misma sesión y las adjunta.
//   4. Publica en el canal y marca la bitácora como avisada (una sola vez).
// No usa la service_role key: todo se hace con los permisos del propio voluntario.
//
// Variable en Vercel → Settings → Environment Variables (SIN prefijo VITE_):
//   DISCORD_WEBHOOK_BITACORAS   → canal de bitácoras
// Además usa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, que ya existen.
// Vuelve a desplegar tras añadirla. Sin webhook responde 200 sin enviar nada.
//
// ⚠️ Las fotos pueden mostrar a beneficiarios (incluso menores). Una vez en
// Discord, las ven todos los miembros del canal: mantenlo PRIVADO y reducido.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { describirActividad } from '../src/utils/bitacora.js';

const BUCKET = 'momentos-felices';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const clip = (v, max) => {
  const s = v == null ? '' : String(v);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
};

// Mensaje de Discord a partir de la fila que devuelve obtener_bitacora_a_notificar.
// `adjuntos` son los nombres de archivo ya descargados (el primero va dentro del embed).
export const componerMensaje = (b, adjuntos) => {
  const actividades = Array.isArray(b.actividades) ? b.actividades : [];
  const epoch = Math.floor(new Date(b.created_at).getTime() / 1000);

  const campos = [
    { name: 'Voluntario', value: `${b.voluntario_nombre || 'Voluntario'} · ${b.voluntario_rol || 'voluntario'}`, inline: true },
    { name: 'Líder responsable', value: b.lider_nombre || '—', inline: true },
    { name: 'Enviada', value: `<t:${epoch}:F>`, inline: true },
  ];
  if (b.formacion_continua) campos.push({ name: 'Formación continua', value: clip(b.formacion_continua, 1024), inline: false });
  campos.push({ name: 'Fotos', value: String(adjuntos.length), inline: true });

  return {
    username: 'MedTrack',
    allowed_mentions: { parse: [] }, // nunca @everyone/@here
    embeds: [{
      title: clip(`📝 Nueva bitácora: ${b.voluntario_nombre || 'Voluntario'}`, 240),
      description: clip(actividades.map((a) => `• ${describirActividad(a)}`).join('\n'), 4000) || undefined,
      color: 0x7c3aed,
      fields: campos,
      image: adjuntos.length ? { url: `attachment://${adjuntos[0]}` } : undefined,
      timestamp: b.created_at,
    }],
  };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const webhook = process.env.DISCORD_WEBHOOK_BITACORAS;
  if (!webhook) {
    res.status(200).json({ ok: false, reason: 'webhook_no_configurado' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    res.status(500).json({ ok: false, reason: 'supabase_no_configurado' });
    return;
  }

  const jwt = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    res.status(401).json({ ok: false, reason: 'sin_sesion' });
    return;
  }

  let p = req.body;
  if (typeof p === 'string') {
    try { p = JSON.parse(p); } catch { p = {}; }
  }
  const bitacoraId = p?.bitacoraId;
  if (!UUID.test(String(bitacoraId || ''))) {
    res.status(400).json({ ok: false, reason: 'bitacora_invalida' });
    return;
  }

  // Cliente que actúa COMO el voluntario: RLS y las funciones de la base aplican.
  const sb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: fila, error: rpcError } = await sb.rpc('obtener_bitacora_a_notificar', { p_id: bitacoraId });
    if (rpcError) {
      const sesion = rpcError.code === '28000' || /jwt/i.test(rpcError.message || '');
      res.status(sesion ? 401 : 500).json({ ok: false, reason: sesion ? 'sesion_invalida' : 'rpc_fallo', code: rpcError.code });
      return;
    }
    if (!fila) {
      // No es suya, ya se avisó, o es muy antigua: nada que hacer.
      res.status(200).json({ ok: true, omitida: true });
      return;
    }

    // Fotos del bucket privado, con la sesión del propio voluntario.
    const rutas = Array.isArray(fila.fotos) ? fila.fotos.slice(0, 3) : [];
    const archivos = [];
    for (const [i, ruta] of rutas.entries()) {
      const { data: blob, error: dlError } = await sb.storage.from(BUCKET).download(ruta);
      if (dlError || !blob) {
        console.error('No se pudo descargar una foto de la bitácora:', dlError?.message);
        continue; // se avisa igual, con las fotos que sí se pudieron leer
      }
      archivos.push({ nombre: `jornada-foto-${i + 1}.jpg`, blob });
    }

    const form = new FormData();
    form.append('payload_json', JSON.stringify(componerMensaje(fila, archivos.map((a) => a.nombre))));
    archivos.forEach((a, i) => form.append(`files[${i}]`, a.blob, a.nombre));

    const r = await fetch(webhook, { method: 'POST', body: form });
    if (!r.ok && r.status !== 204) {
      res.status(502).json({ ok: false, discord_status: r.status });
      return;
    }

    // Solo tras publicar: si Discord falla, el aviso se reintenta al volver a abrir la app.
    const { error: marcaError } = await sb.rpc('marcar_bitacora_notificada', { p_id: bitacoraId });
    if (marcaError) console.error('No se pudo marcar la bitácora como avisada:', marcaError.message);

    res.status(200).json({ ok: true, fotos: archivos.length });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e && e.message) });
  }
}
