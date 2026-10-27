import { supabase } from './supabase';

// Columnas de perfiles que necesita Gestión de Personal, de la más completa a la mínima, según
// qué schemas estén aplicados (v22 es_coordinador, v33 es_coordinador_brigadas, v36 es_gestor_personal).
// No se usa select('*'): perfiles guarda el avatar en base64 y traer el de todo el personal
// hace pesada la carga de una pantalla que ni siquiera lo muestra.
const COLUMNAS = [
  'id, nombre, email, rol, created_at, es_coordinador, es_coordinador_brigadas, es_gestor_personal',
  'id, nombre, email, rol, created_at, es_coordinador, es_coordinador_brigadas',
  'id, nombre, email, rol, created_at, es_coordinador',
  'id, nombre, email, rol, created_at'
];

export const cargarPersonal = async () => {
  if (!supabase) return [];
  let ultimoError = null;
  for (const columnas of COLUMNAS) {
    const { data, error } = await supabase
      .from('perfiles')
      .select(columnas)
      .order('created_at', { ascending: false });
    if (!error) return data || [];
    ultimoError = error;
  }
  throw ultimoError;
};
