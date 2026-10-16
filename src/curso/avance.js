// Avance de un voluntario en el curso de español, para el reporte de la coordinación
// (campo "Avance Español": % de progreso y nivel en el curso adaptativo).

import { UNIDADES } from './plan';
import { leccionesDe, todasLasLecciones } from './contenido';

const NIVELES = { inicial: 'Inicial', intermedio: 'Intermedio', avanzado: 'Avanzado', superior: 'Superior' };

// `completadas` es cuántas lecciones terminó. Como las lecciones se desbloquean en
// orden, ese número basta para ubicarlo: el nivel es el bloque de la unidad en la que
// está. El porcentaje es sobre las lecciones que existen hoy (las unidades sin
// contenido todavía no cuentan).
export const avanceDeCurso = (completadas) => {
  const total = todasLasLecciones().length;
  if (total === 0) return { porcentaje: 0, nivel: 'Sin contenido' };

  const hechas = Math.max(0, Math.min(total, Number(completadas) || 0));
  const porcentaje = Math.round((100 * hechas) / total);
  if (hechas === 0) return { porcentaje, nivel: 'Sin iniciar' };

  const conContenido = UNIDADES.filter((u) => leccionesDe(u.id).length > 0);
  let acumuladas = 0;
  for (const u of conContenido) {
    acumuladas += leccionesDe(u.id).length;
    if (hechas < acumuladas) return { porcentaje, nivel: `${NIVELES[u.bloque]} · Unidad ${u.id}` };
  }

  // Terminó todo lo que hay: "Completado" solo si el curso ya tiene las 12 unidades.
  if (conContenido.length === UNIDADES.length) return { porcentaje, nivel: 'Completado' };
  const ultima = conContenido[conContenido.length - 1];
  return { porcentaje, nivel: `${NIVELES[ultima.bloque]} · Unidad ${ultima.id} (terminada)` };
};
