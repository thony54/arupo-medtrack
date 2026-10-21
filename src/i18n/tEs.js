import es from './locales/es.js'; // con `.js`: lo carga api/notify-bitacora.js (ver utils/bitacora.js)

// Traductor en español para código que no vive dentro de un componente (utilidades
// puras y pantallas de staff). Mismo contrato que t() de useI18n().
export const tEs = (clave, variables) => {
  const texto = es[clave] ?? clave;
  return variables
    ? texto.replace(/\{(\w+)\}/g, (m, k) => (variables[k] !== undefined ? variables[k] : m))
    : texto;
};
