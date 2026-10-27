import { supabase } from './supabase';

// Tareas que la coordinación asigna a los voluntarios (tabla tareas_voluntario,
// schema_v30.sql). Mientras esa tabla no exista, todo devuelve `activo: false` y la
// interfaz oculta el módulo en vez de mostrar errores.

const COLUMNAS = 'id, voluntario_id, titulo, descripcion, fecha_limite, asignada_por_nombre, estado, created_at, completada_en';

const tablaInexistente = (err) => err?.code === '42P01' || err?.code === 'PGRST205';

// { activo, tareas }. Sin `userId` carga todas (solo super_admin y coordinadores las ven);
// con `userId`, las de ese voluntario.
export const cargarTareas = async (userId) => {
  if (!supabase) return { activo: false, tareas: [] };
  let consulta = supabase.from('tareas_voluntario').select(COLUMNAS).order('created_at', { ascending: false }).limit(1000);
  if (userId) consulta = consulta.eq('voluntario_id', userId);
  const { data, error } = await consulta;
  if (error) {
    if (tablaInexistente(error)) return { activo: false, tareas: [] };
    throw error;
  }
  return { activo: true, tareas: data || [] };
};

// Cantidad de tareas pendientes del voluntario, o null si el módulo no está disponible.
export const contarPendientes = async (userId) => {
  if (!supabase || !userId) return null;
  const { count, error } = await supabase
    .from('tareas_voluntario')
    .select('id', { count: 'exact', head: true })
    .eq('voluntario_id', userId)
    .eq('estado', 'pendiente');
  if (error) {
    if (!tablaInexistente(error)) console.error('No se pudo contar las tareas pendientes:', error.message);
    return null;
  }
  return count || 0;
};

const mensajeDe = (error) => {
  switch (error?.code) {
    case 'PGRST202': return 'Falta activar las tareas en la base de datos (schema_v30.sql).';
    case '42501': return 'No tienes permiso para hacer este cambio: esa persona no es de tu equipo.';
    case '22023': return 'Revisa los datos: el título es obligatorio (máx. 120 caracteres), la descripción admite hasta 500 y la fecha límite no puede estar en el pasado.';
    case 'P0002': return 'La tarea o la persona ya no existe. Recarga la lista.';
    case '54000': return 'Esta persona ya tiene 50 tareas pendientes.';
    default: return 'No se pudo guardar el cambio. Inténtalo de nuevo.';
  }
};

// Todas devuelven { ok: true } o { ok: false, mensaje } y nunca lanzan.
const llamar = async (funcion, argumentos) => {
  if (!supabase) return { ok: false, mensaje: 'No hay conexión con la base de datos.' };
  const { error } = await supabase.rpc(funcion, argumentos);
  if (!error) return { ok: true };
  console.error(`Error en ${funcion}:`, error);
  return { ok: false, mensaje: mensajeDe(error) };
};

export const asignarTarea = ({ voluntarioId, titulo, descripcion, fechaLimite }) =>
  llamar('asignar_tarea', {
    p_voluntario_id: voluntarioId,
    p_titulo: titulo,
    p_descripcion: descripcion || null,
    p_fecha_limite: fechaLimite || null
  });

export const marcarTarea = (tareaId, completada) =>
  llamar('completar_tarea', { p_id: tareaId, p_completada: completada });

export const retirarTarea = (tareaId) => llamar('retirar_tarea', { p_id: tareaId });

// Una tarea pendiente está vencida si su fecha límite (AAAA-MM-DD) es anterior a hoy.
export const estaVencida = (tarea, hoy = new Date()) => {
  if (tarea.estado !== 'pendiente' || !tarea.fecha_limite) return false;
  const [a, m, d] = tarea.fecha_limite.split('-').map(Number);
  const limite = new Date(a, m - 1, d);
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return limite < inicioHoy;
};
