// Tiempo de estancia del voluntario en la Fundación (3 a 24 meses).
// Fuente de verdad para el perfil y, más adelante, para el plan formativo y la
// fecha del certificado. El rango debe coincidir con el CHECK de schema_v23.sql.

import { tEs } from '../i18n/tEs';

export const ESTANCIA_MIN_MESES = 3;
export const ESTANCIA_MAX_MESES = 24;

// 'La columna existe' se deduce de que select('*') la devuelve (aunque sea null).
// Así la app no muestra el campo ni el aviso hasta que se aplique schema_v23.sql.
export const estanciaDisponible = (perfil) =>
  !!perfil && Object.prototype.hasOwnProperty.call(perfil, 'tiempo_estancia_meses');

export const estanciaPendiente = (perfil) =>
  estanciaDisponible(perfil) && perfil.tiempo_estancia_meses == null;

// 3 → "3 meses" · 12 → "1 año" · 18 → "1 año y 6 meses" · 24 → "2 años"
// `t` es el traductor del idioma (por defecto español); las claves estancia.* llevan el plural.
export const formatEstancia = (meses, t = tEs) => {
  const m = Number(meses);
  if (!Number.isInteger(m) || m < 1) return '';
  const anios = Math.floor(m / 12);
  const resto = m % 12;
  const textoAnios = t(`estancia.anios_${anios === 1 ? 'uno' : 'otros'}`, { n: anios });
  const textoMeses = t(`estancia.meses_${resto === 1 ? 'uno' : 'otros'}`, { n: resto });
  if (anios === 0) return textoMeses;
  return resto === 0 ? textoAnios : `${textoAnios} ${t('estancia.y')} ${textoMeses}`;
};

export const opcionesEstancia = (t = tEs) =>
  Array.from({ length: ESTANCIA_MAX_MESES - ESTANCIA_MIN_MESES + 1 }, (_, i) => {
    const meses = ESTANCIA_MIN_MESES + i;
    return { value: meses, label: formatEstancia(meses, t) };
  });

// Fecha de fin = inicio + meses. `inicio` llega como 'YYYY-MM-DD' (columna DATE).
// Se construye con componentes locales para que la zona horaria no desplace el día.
export const fechaFinEstancia = (inicio, meses) => {
  if (!inicio || !meses) return null;
  const [anio, mes, dia] = String(inicio).split('-').map(Number);
  if (!anio || !mes || !dia) return null;
  const fin = new Date(anio, mes - 1 + Number(meses), dia);
  // Si el día no existe en el mes destino (31 ene + 1 mes), JS desborda al mes
  // siguiente: se retrocede al último día del mes buscado.
  if (fin.getDate() !== dia) fin.setDate(0);
  return fin;
};

// `local`: etiqueta BCP 47 del idioma (es-ES, en-GB, de-DE, ...).
export const formatFecha = (fecha, local = 'es-ES') =>
  fecha ? fecha.toLocaleDateString(local, { day: '2-digit', month: 'long', year: 'numeric' }) : '';
