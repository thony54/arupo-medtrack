// Contenido del curso: lecciones y ejercicios de cada unidad.
//
// CÓMO AÑADIR CONTENIDO
//   1. Crea (o edita) src/curso/contenido/unidadN.js con { id: N, lecciones: [...] }.
//   2. Impórtalo aquí y regístralo en CONTENIDO.
//   Cada lección: { id: 'uN-lM', titulo, ejercicios: [...] }. El id debe tener la forma
//   u<unidad>-l<lección> (p. ej. 'u3-l2'): es lo que se guarda en el progreso.
//   Las unidades sin lecciones aparecen como "contenido próximamente".
//
// TIPOS DE EJERCICIO (todos admiten `explicacion` opcional, que se muestra al responder)
//   opcion     { pregunta, opciones: [..], correcta: <índice> }
//   escuchar   { audio, opciones: [..], correcta: <índice> }      lee `audio` con la voz del navegador
//   completar  { frase: 'Buenos ___, señora.', opciones, correcta }  el hueco es "___"
//   emparejar  { pares: [[izquierda, derecha], ...] }              de 2 a 6 pares
//
// TEXTOS EN VARIOS IDIOMAS (opcional): en `pregunta`, `explicacion` y en cada opción se
// puede usar un objeto { es: '…', en: '…', de: '…', pt: '…', it: '…', fr: '…' }; se
// muestra el idioma del voluntario y, si falta, el español.

import unidad1 from './unidad1';
import unidad2 from './unidad2';

const CONTENIDO = { 1: unidad1, 2: unidad2 };

export const leccionesDe = (unidadId) => CONTENIDO[unidadId]?.lecciones ?? [];

export const todasLasLecciones = () => Object.values(CONTENIDO).flatMap((u) => u.lecciones);

// Texto que puede ser una cadena o un objeto por idioma.
export const textoLocal = (valor, idioma) =>
  valor && typeof valor === 'object' ? valor[idioma] ?? valor.es ?? '' : valor ?? '';
