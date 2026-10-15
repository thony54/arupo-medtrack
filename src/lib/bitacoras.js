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
