import { supabase } from './supabase';
import { BUCKET_FOTOS } from '../utils/bitacora';

const POR_TANDA_FIRMA = 200;

// URLs firmadas de las fotos privadas del bucket `momentos-felices` (por defecto, una
// hora). Devuelve { ruta: urlFirmada }. Si una tanda falla, esas fotos quedan fuera y
// se deja el error en consola: una foto que no carga no debe impedir ver la bitácora.
export const firmarFotos = async (rutas, segundos = 3600) => {
  const unicas = [...new Set(rutas.filter(Boolean))];
  if (!supabase || unicas.length === 0) return {};
  const firmadas = {};
  for (let i = 0; i < unicas.length; i += POR_TANDA_FIRMA) {
    const { data, error } = await supabase.storage
      .from(BUCKET_FOTOS)
      .createSignedUrls(unicas.slice(i, i + POR_TANDA_FIRMA), segundos);
    if (error) {
      console.error('No se pudieron firmar las fotos:', error.message);
      continue;
    }
    for (const f of data || []) if (f.signedUrl) firmadas[f.path] = f.signedUrl;
  }
  return firmadas;
};

// Pide al servidor que avise a Discord de una bitácora (con sus fotos). Es
// fire-and-forget: nunca lanza y nunca debe bloquear ni romper el cierre de
// jornada. El servidor comprueba que la bitácora sea de quien llama y que no se
// haya avisado ya, así que repetir la llamada es inofensivo.
const enCurso = new Set(); // bitácoras con un aviso en vuelo: no se repiten en paralelo

export const notificarBitacora = async (bitacoraId) => {
  if (enCurso.has(bitacoraId)) return false;
  enCurso.add(bitacoraId);
  try {
    if (!supabase) return false;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return false;
    const res = await fetch('/api/notify-bitacora', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bitacoraId }),
      keepalive: true
    });
    return res.ok;
  } catch {
    return false; // sin red: se reintenta al volver a abrir Mis Actividades
  } finally {
    enCurso.delete(bitacoraId);
  }
};
