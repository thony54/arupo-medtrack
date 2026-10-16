// Estructura del Curso de Español Dinámico (según "MedTrack Modulo por anadir.docx").
//
// 12 unidades en 4 bloques. `peso` es cuántos MESES ocupa cada unidad en el plan
// de referencia de 24 meses (suman 24): Inicial = meses 1–3, Intermedio = 4–8,
// Avanzado = 9–12, Superior = 13–24. Para estancias más cortas el calendario
// reparte esos mismos pesos proporcionalmente (ver calendario.js), de modo que la
// última unidad termine justo cuando termina el voluntariado.
//
// Los TÍTULOS de bloques y unidades se traducen en los diccionarios de idioma
// (curso.bloque_* y curso.u1 … curso.u12). El CONTENIDO de cada unidad (lecciones y
// ejercicios) vive en src/curso/contenido/.

export const BLOQUES = [
  { id: 'inicial', unidades: [1, 2, 3] },
  { id: 'intermedio', unidades: [4, 5, 6] },
  { id: 'avanzado', unidades: [7, 8, 9] },
  { id: 'superior', unidades: [10, 11, 12] }
];

export const UNIDADES = [
  { id: 1, bloque: 'inicial', peso: 1 },
  { id: 2, bloque: 'inicial', peso: 1 },
  { id: 3, bloque: 'inicial', peso: 1 },
  { id: 4, bloque: 'intermedio', peso: 5 / 3 },
  { id: 5, bloque: 'intermedio', peso: 5 / 3 },
  { id: 6, bloque: 'intermedio', peso: 5 / 3 },
  { id: 7, bloque: 'avanzado', peso: 4 / 3 },
  { id: 8, bloque: 'avanzado', peso: 4 / 3 },
  { id: 9, bloque: 'avanzado', peso: 4 / 3 },
  { id: 10, bloque: 'superior', peso: 4 },
  { id: 11, bloque: 'superior', peso: 4 },
  { id: 12, bloque: 'superior', peso: 4 }
];

// Meses del plan de referencia (suma de los pesos).
export const MESES_PLAN = 24;

// Nota mínima para dar una lección por aprobada: no hay; la lección se completa
// cuando todos los ejercicios quedan bien (los fallados se repiten al final). El
// puntaje guardado es el porcentaje respondido bien al primer intento.
