import { UNIDADES, MESES_PLAN } from './plan';
import { fechaFinEstancia } from '../utils/estancia';

// Calendario adaptativo del curso.
//
// El curso dura EXACTAMENTE lo que dura la estancia del voluntario (3 a 24 meses):
// empieza en `fecha_inicio_estancia` y termina en la fecha de fin del voluntariado,
// que es también la fecha de emisión del certificado. Cada unidad ocupa una franja
// de ese intervalo proporcional a su `peso` en el plan de referencia de 24 meses.
//
// Todo son funciones puras (reciben la fecha "de hoy"), así se pueden probar.

const aFechaLocal = (iso) => {
  const [anio, mes, dia] = String(iso).split('-').map(Number);
  return new Date(anio, mes - 1, dia);
};

// Devuelve null si faltan datos; si no: { inicio, fin, unidades: [{...unidad, desde, hasta}] }.
export const calcularCalendario = (fechaInicio, meses) => {
  if (!fechaInicio || !meses) return null;
  const inicio = aFechaLocal(fechaInicio);
  const fin = fechaFinEstancia(fechaInicio, meses);
  if (!fin || Number.isNaN(inicio.getTime())) return null;

  const total = fin.getTime() - inicio.getTime();
  let acumulado = 0;
  const unidades = UNIDADES.map((u) => {
    const desde = new Date(inicio.getTime() + (total * acumulado) / MESES_PLAN);
    acumulado += u.peso;
    const hasta = new Date(inicio.getTime() + (total * acumulado) / MESES_PLAN);
    return { ...u, desde, hasta };
  });
  return { inicio, fin, unidades };
};

// 'completada' | 'sin_contenido' | 'atrasada' | 'en_curso' | 'proxima'
export const estadoUnidad = ({ unidad, lecciones, completadas, ahora }) => {
  if (lecciones.length === 0) return 'sin_contenido';
  if (lecciones.every((l) => completadas.has(l.id))) return 'completada';
  if (ahora > unidad.hasta) return 'atrasada';
  if (ahora >= unidad.desde) return 'en_curso';
  return 'proxima';
};

// Cuántas unidades con contenido ya debieron terminarse y no lo están.
export const contarAtrasadas = (estados) => estados.filter((e) => e === 'atrasada').length;

// El certificado exige TODAS las unidades con contenido completo y, además, haber
// llegado a la fecha de fin del voluntariado (esa es la fecha de emisión).
export const certificadoDisponible = ({ estados, fin, ahora }) =>
  estados.length > 0 && estados.every((e) => e === 'completada') && ahora >= fin;

export const cursoCompleto = (estados) => estados.length > 0 && estados.every((e) => e === 'completada');
