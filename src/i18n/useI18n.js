import { createContext, useContext } from 'react';
import { IDIOMAS } from './idiomas';
import es from './locales/es';

// Contexto del idioma y hook para leerlo. El proveedor está en I18nProvider.jsx
// (separado para que cada archivo exporte solo componentes o solo funciones).
export const I18nContext = createContext(null);

// Fuera del proveedor devuelve un traductor en español (útil en pruebas y rutas sueltas).
const RESPALDO = {
  idioma: 'es', local: 'es-ES', reloj12h: true, idiomas: IDIOMAS, selectorVisible: true, cambiarIdioma: () => {},
  t: (clave, variables) => {
    const texto = es[clave] ?? clave;
    return variables ? texto.replace(/\{(\w+)\}/g, (m, k) => (variables[k] !== undefined ? variables[k] : m)) : texto;
  },
  tn: (clave, n, variables) => RESPALDO.t(`${clave}_${n === 1 ? 'uno' : 'otros'}`, { n, ...variables }),
  formatearFecha: (f, o = { day: 'numeric', month: 'long', year: 'numeric' }) => (f ? new Date(f).toLocaleDateString('es-ES', o) : ''),
  formatearFechaHora: (f, o) => (f ? new Date(f).toLocaleString('es-ES', o) : '')
};

export const useI18n = () => useContext(I18nContext) || RESPALDO;
