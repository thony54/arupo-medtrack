import { supabase } from './supabase';
import { BUCKET_FOTOS } from '../utils/bitacora';

// URLs firmadas de una hora para las fotos privadas del bucket `momentos-felices`.
// Devuelve { ruta: urlFirmada }. Si falla, devuelve {} y deja el error en consola:
// una foto que no carga no debe impedir ver la bitácora.
export const firmarFotos = async (rutas) => {
  const unicas = [...new Set(rutas.filter(Boolean))];
  if (!supabase || unicas.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrls(unicas, 3600);
  if (error) {
    console.error('No se pudieron firmar las fotos:', error.message);
    return {};
  }
  return Object.fromEntries((data || []).filter(f => f.signedUrl).map(f => [f.path, f.signedUrl]));
};

// Pide al servidor que avise a Discord de una bitácora (con sus fotos). Es
// fire-and-forget: nunca lanza y nunca debe bloquear ni romper el cierre de
// jornada. El servidor comprueba que la bitácora sea de quien llama y que no se
// haya avisado ya, así que repetir la llamada es inofensivo.
export const notificarBitacora = async (bitacoraId) => {
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
  }
};
