import { supabase } from './supabase';
import { VERSION_TERMINOS } from '../legal/terminos';

// Aceptación de términos (audit trail en aceptaciones_terminos, schema_v28.sql).
//
// La compuerta es un trámite legal, no un control de acceso: si la verificación
// falla (sin red, o aún no existe la tabla) NO se bloquea a nadie. Así la PWA
// sigue funcionando en campo sin señal y la app se puede desplegar antes que el SQL.

// La clave empieza por `medtrack_`: se borra al cerrar sesión (purgarDatosLocales),
// de modo que en cada inicio de sesión se vuelve a comprobar contra la base.
const claveLocal = (userId) => `medtrack_terminos_${VERSION_TERMINOS}_${userId}`;

const recordarLocal = (userId) => {
  try { localStorage.setItem(claveLocal(userId), '1'); } catch { /* sin almacenamiento */ }
};

const aceptadosLocal = (userId) => {
  try { return localStorage.getItem(claveLocal(userId)) === '1'; } catch { return false; }
};

// Devuelve 'aceptados' o 'pendientes'.
export const consultarTerminos = async (userId) => {
  if (!supabase || !userId) return 'aceptados';
  if (aceptadosLocal(userId)) return 'aceptados';

  const { data, error } = await supabase
    .from('aceptaciones_terminos')
    .select('id')
    .eq('user_id', userId)
    .eq('version', VERSION_TERMINOS)
    .limit(1);

  if (error) {
    // console.warn (no error): un fallo de red u omitir el SQL no debe llenar el canal de errores.
    console.warn('No se pudo verificar la aceptación de términos:', error.message);
    return 'aceptados';
  }
  if (data && data.length > 0) {
    recordarLocal(userId);
    return 'aceptados';
  }
  return 'pendientes';
};

// Registra la aceptación (el servidor pone fecha, IP y navegador). Nunca lanza.
// Devuelve { ok: true } o { ok: false, codigo } con codigo 'sin_conexion' | 'sin_funcion' | 'error'
// (el componente lo traduce con terminos.error_<codigo>).
export const registrarAceptacion = async (userId) => {
  if (!supabase) return { ok: false, codigo: 'sin_conexion' };
  const { error } = await supabase.rpc('aceptar_terminos', { p_version: VERSION_TERMINOS });
  if (error) {
    console.error('Error al registrar la aceptación de términos:', error);
    return { ok: false, codigo: error.code === 'PGRST202' ? 'sin_funcion' : 'error' };
  }
  recordarLocal(userId);
  return { ok: true };
};
