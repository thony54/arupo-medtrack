import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { IDIOMAS, CODIGOS, IDIOMA_POR_DEFECTO, detectarIdioma, infoIdioma } from './idiomas';
import { I18nContext } from './useI18n';
import es from './locales/es';
import en from './locales/en';
import de from './locales/de';
import pt from './locales/pt';
import it from './locales/it';
import fr from './locales/fr';

// ─────────────────────────────────────────────────────────────────────────────
// Idiomas de la app (es, en, de, pt, it, fr).
//
// Regla de producto: SOLO el voluntario y el brigadista (que comparten actividades,
// tareas y curso) ven la app en su idioma, y solo sus pantallas (inicio, perfil, cierre
// de jornada, curso, términos, ingreso). El resto (inventario, CRM, administración) está
// y seguirá en español: los componentes compartidos usan t() y, como el idioma efectivo
// del super_admin es siempre 'es', ven los mismos textos de siempre.
//
// Antes de iniciar sesión (login) todavía no hay rol: se usa el idioma elegido.
// La preferencia vive en localStorage con la clave `arupo_idioma` (NO empieza por
// `medtrack_`, para que no se borre al cerrar sesión y el ingreso siga en su idioma).
// ─────────────────────────────────────────────────────────────────────────────

const DICCIONARIOS = { es, en, de, pt, it, fr };
const CLAVE_IDIOMA = 'arupo_idioma';

const leerPreferido = () => {
  try {
    const guardado = localStorage.getItem(CLAVE_IDIOMA);
    if (guardado && CODIGOS.includes(guardado)) return guardado;
  } catch { /* sin almacenamiento */ }
  return detectarIdioma();
};

export const I18nProvider = ({ children }) => {
  const { role } = useAuth() || {};
  const [preferido, setPreferido] = useState(leerPreferido);

  // Quien ya inició sesión y no es voluntario ni brigadista ve siempre español.
  const selectorVisible = !role || role === 'voluntario' || role === 'brigadista';
  const idioma = selectorVisible ? preferido : IDIOMA_POR_DEFECTO;
  const info = infoIdioma(idioma);

  useEffect(() => {
    try { document.documentElement.lang = idioma; } catch { /* sin documento */ }
  }, [idioma]);

  const cambiarIdioma = useCallback((codigo) => {
    if (!CODIGOS.includes(codigo)) return;
    setPreferido(codigo);
    try { localStorage.setItem(CLAVE_IDIOMA, codigo); } catch { /* sin almacenamiento */ }
  }, []);

  const valor = useMemo(() => {
    const diccionario = DICCIONARIOS[idioma] || es;

    // t('clave', { nombre: 'Ana' }) reemplaza {nombre}. Si falta la clave en el
    // idioma, cae al español; si tampoco existe, devuelve la clave (se nota en pantalla).
    const t = (clave, variables) => {
      const texto = diccionario[clave] ?? es[clave] ?? clave;
      return variables
        ? texto.replace(/\{(\w+)\}/g, (m, k) => (variables[k] !== undefined ? variables[k] : m))
        : texto;
    };

    // tn('clave', 3) usa clave_uno si n === 1 y clave_otros en otro caso; {n} es el número.
    const tn = (clave, n, variables) => t(`${clave}_${n === 1 ? 'uno' : 'otros'}`, { n, ...variables });

    const formatearFecha = (fecha, opciones = { day: 'numeric', month: 'long', year: 'numeric' }) =>
      fecha ? new Date(fecha).toLocaleDateString(info.local, opciones) : '';
    const formatearFechaHora = (fecha, opciones) =>
      fecha ? new Date(fecha).toLocaleString(info.local, opciones) : '';

    return { idioma, local: info.local, reloj12h: info.reloj12h, idiomas: IDIOMAS, selectorVisible, cambiarIdioma, t, tn, formatearFecha, formatearFechaHora };
  }, [idioma, info, selectorVisible, cambiarIdioma]);

  return <I18nContext.Provider value={valor}>{children}</I18nContext.Provider>;
};
