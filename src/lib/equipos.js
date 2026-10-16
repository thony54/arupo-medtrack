import { supabase } from './supabase';

// Columnas de perfiles según lo que ya exista en la base: la app debe funcionar
// aunque falten schema_v22 (es_coordinador) o schema_v27 (es_lider, lider_id).
const COLUMNAS = [
  'id, nombre, email, rol, es_coordinador, es_lider, lider_id',
  'id, nombre, email, rol, es_coordinador',
  'id, nombre, email, rol'
];

// Devuelve { perfiles, liderazgo }. `liderazgo` es true cuando la base ya tiene
// es_lider / lider_id. No se usa select('*') porque perfiles guarda el avatar en base64.
export const cargarPerfiles = async () => {
  if (!supabase) return { perfiles: [], liderazgo: false };
  let ultimoError = null;
  for (const [i, columnas] of COLUMNAS.entries()) {
    const { data, error } = await supabase.from('perfiles').select(columnas);
    if (!error) return { perfiles: data || [], liderazgo: i === 0 };
    ultimoError = error;
  }
  throw ultimoError;
};

const mensajeDe = (error) => {
  switch (error?.code) {
    case 'PGRST202': return 'Falta activar esta función en la base de datos (schema_v27.sql).';
    case '42501': return 'No tienes permiso para hacer este cambio.';
    case '22023': return 'El líder elegido no es válido.';
    case 'P0002': return 'El usuario ya no existe. Recarga la lista.';
    default: return 'No se pudo guardar el cambio. Inténtalo de nuevo.';
  }
};

// Ambas funciones devuelven { ok: true } o { ok: false, mensaje } y nunca lanzan.
const llamar = async (funcion, argumentos) => {
  if (!supabase) return { ok: false, mensaje: 'No hay conexión con la base de datos.' };
  const { error } = await supabase.rpc(funcion, argumentos);
  if (!error) return { ok: true };
  console.error(`Error en ${funcion}:`, error);
  return { ok: false, mensaje: mensajeDe(error) };
};

export const designarLider = (usuarioId, esLider) =>
  llamar('asignar_lider', { p_user_id: usuarioId, p_es_lider: esLider });

// liderId = null deja al voluntario sin asignar.
export const asignarVoluntarioALider = (voluntarioId, liderId) =>
  llamar('asignar_voluntario_a_lider', { p_voluntario_id: voluntarioId, p_lider_id: liderId });

// Bitácoras de los últimos `dias` días, solo las columnas que hacen falta para el
// tablero. PostgREST devuelve como máximo 1000 filas por petición: se pagina.
const POR_LOTE = 1000;
const MAX_LOTES = 5;

export const cargarBitacorasRecientes = async (dias = 30) => {
  if (!supabase) return [];
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  let todas = [];
  for (let lote = 0; lote < MAX_LOTES; lote++) {
    const { data, error } = await supabase
      .from('bitacoras')
      .select('id, voluntario_id, lider_id, created_at, estado, actividades')
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .range(lote * POR_LOTE, (lote + 1) * POR_LOTE - 1);
    if (error) throw error;
    todas = todas.concat(data || []);
    if ((data || []).length < POR_LOTE) break;
  }
  return todas;
};
