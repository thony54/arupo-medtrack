import { supabase } from './supabase';

// Progreso del curso de español (tabla curso_progreso, schema_v29.sql).

const tablaInexistente = (err) => err?.code === '42P01' || err?.code === 'PGRST205';

// { activo, completadas: Set<leccionId>, puntajes: Map<leccionId, puntaje> }
// `activo` es false mientras no exista la tabla (falta aplicar schema_v29).
export const cargarProgreso = async (userId) => {
  const vacio = { activo: true, completadas: new Set(), puntajes: new Map() };
  if (!supabase || !userId) return { ...vacio, activo: false };

  const { data, error } = await supabase
    .from('curso_progreso')
    .select('leccion_id, puntaje')
    .eq('user_id', userId);

  if (error) {
    if (tablaInexistente(error)) return { ...vacio, activo: false };
    throw error;
  }
  const filas = data || [];
  return {
    activo: true,
    completadas: new Set(filas.map((f) => f.leccion_id)),
    puntajes: new Map(filas.map((f) => [f.leccion_id, f.puntaje]))
  };
};

// Ids de las lecciones que la persona trabajó desde `desdeISO` (la última vez que las
// hizo, aunque las repitiera). Para sugerirlas como formación continua en la bitácora.
// Devuelve [] si el curso aún no está activo o falla la consulta: es solo una ayuda.
export const cargarLeccionesDesde = async (userId, desdeISO) => {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('curso_progreso')
    .select('leccion_id, ultima_en')
    .eq('user_id', userId)
    .gte('ultima_en', desdeISO)
    .order('ultima_en', { ascending: true });
  if (error) {
    if (!tablaInexistente(error)) console.warn('No se pudieron leer las lecciones recientes:', error.message);
    return [];
  }
  return (data || []).map((f) => f.leccion_id);
};

// Guarda el resultado de una lección. Nunca lanza: { ok } o { ok: false }.
export const guardarLeccion = async (leccionId, puntaje) => {
  if (!supabase) return { ok: false };
  const { error } = await supabase.rpc('guardar_progreso_leccion', {
    p_leccion_id: leccionId,
    p_puntaje: Math.max(0, Math.min(100, Math.round(puntaje)))
  });
  if (error) {
    console.error('Error al guardar el progreso del curso:', error);
    return { ok: false };
  }
  return { ok: true };
};

// Para la coordinación: Map<userId, lecciones completadas>, o null si no está disponible.
export const cargarResumenCurso = async () => {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('curso_resumen');
  if (error) {
    if (error.code !== 'PGRST202' && !tablaInexistente(error)) console.warn('Resumen del curso no disponible:', error.message);
    return null;
  }
  return new Map((data || []).map((f) => [f.user_id, f.completadas]));
};
