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

// Dirección de la pantalla de revisión de bitácoras, a partir del host de la petición.
// null si el host no tiene la forma esperada (no se enlaza nada en ese caso).
const enlaceDeRevision = (req) => {
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
  return /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? `https://${host}/bitacoras` : null;
};

// Mensaje de Discord a partir de la fila que devuelve obtener_bitacora_a_notificar.
// `adjuntos` son los nombres de archivo ya descargados, en el orden en que se tomaron.
// Con `enlace`, todas las fotos salen juntas dentro de la tarjeta, en una galería: Discord
// agrupa los embeds que comparten la misma `url`. Sin eso, la primera foto iba dentro de la
// tarjeta y las demás como adjuntos sueltos, fuera de ella y en otro orden.
export const componerMensaje = (b, adjuntos, enlace = null) => {
  const actividades = Array.isArray(b.actividades) ? b.actividades : [];
  const epoch = Math.floor(new Date(b.created_at).getTime() / 1000);

  const campos = [
    { name: 'Voluntario', value: `${b.voluntario_nombre || 'Voluntario'} · ${b.voluntario_rol || 'voluntario'}`, inline: true },
    { name: 'Líder responsable', value: b.lider_nombre || '—', inline: true },
    { name: 'Enviada', value: `<t:${epoch}:F>`, inline: true },
  ];
  if (b.formacion_continua) campos.push({ name: 'Formación continua', value: clip(b.formacion_continua, 1024), inline: false });
  campos.push({ name: 'Fotos', value: String(adjuntos.length), inline: true });

  const imagen = (nombre) => ({ url: `attachment://${nombre}` });
  const tarjeta = {
    title: clip(`📝 Nueva bitácora: ${b.voluntario_nombre || 'Voluntario'}`, 240),
    description: clip(actividades.map((a) => `• ${describirActividad(a)}`).join('\n'), 4000) || undefined,
    color: 0x7c3aed,
    fields: campos,
    image: adjuntos.length ? imagen(adjuntos[0]) : undefined,
    timestamp: b.created_at,
  };
  const galeria = enlace && adjuntos.length > 1;
  if (galeria) tarjeta.url = enlace;

  return {
    username: 'MedTrack',
    allowed_mentions: { parse: [] }, // nunca @everyone/@here
    embeds: [tarjeta, ...(galeria ? adjuntos.slice(1).map((n) => ({ url: enlace, image: imagen(n) })) : [])],
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
    form.append('payload_json', JSON.stringify(componerMensaje(fila, archivos.map((a) => a.nombre), enlaceDeRevision(req))));
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
