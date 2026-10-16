// Idiomas disponibles para las pantallas del voluntario.
// `local` es la etiqueta BCP 47 que usan Intl y toLocaleDateString.
// `reloj12h`: en español e inglés la hora se escribe 10:00 am; en el resto, 24 h.

export const IDIOMAS = [
  { codigo: 'es', nombre: 'Español', local: 'es-ES', reloj12h: true },
  { codigo: 'en', nombre: 'English', local: 'en-GB', reloj12h: true },
  { codigo: 'de', nombre: 'Deutsch', local: 'de-DE', reloj12h: false },
  { codigo: 'pt', nombre: 'Português', local: 'pt-BR', reloj12h: false },
  { codigo: 'it', nombre: 'Italiano', local: 'it-IT', reloj12h: false },
  { codigo: 'fr', nombre: 'Français', local: 'fr-FR', reloj12h: false }
];

export const IDIOMA_POR_DEFECTO = 'es';

export const CODIGOS = IDIOMAS.map(i => i.codigo);

export const infoIdioma = (codigo) => IDIOMAS.find(i => i.codigo === codigo) || IDIOMAS[0];

// Idioma del navegador si está soportado; si no, español.
export const detectarIdioma = () => {
  try {
    const candidatos = [...(navigator.languages || []), navigator.language];
    for (const c of candidatos) {
      const base = String(c || '').slice(0, 2).toLowerCase();
      if (CODIGOS.includes(base)) return base;
    }
  } catch { /* sin navigator */ }
  return IDIOMA_POR_DEFECTO;
};
