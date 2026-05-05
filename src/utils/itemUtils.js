/**
 * itemUtils.js
 * Utilidades centralizadas para determinar el tipo de ítem (Médico vs. General).
 * Esta es la ÚNICA fuente de verdad para la lógica condicional FEFO vs. FIFO.
 *
 * REGLA DE ORO: No modifica la base de datos. Solo interpreta las categorías
 * existentes para aplicar el flujo correcto en el frontend.
 */

/**
 * Nombres de categorías que se consideran NO médicas.
 * Los ítems con estas categorías usan flujo FIFO y no requieren
 * fecha de vencimiento real ni número de lote estricto.
 */
export const CATEGORIAS_GENERALES = [
  'Ropa',
  'Higiene',
  'Alimentos',
  'Herramientas',
  'Juguetes',
  'Calzado',
  'Útiles Escolares',
  'Insumos Generales',
  'Otros',
];

/**
 * Fecha especial usada para lotes de ítems generales que "no vencen".
 * Internamente almacenada en la BD, externamente mostrada como "N/A".
 */
export const FECHA_NO_VENCE = '2099-12-31';

/**
 * Prefijo para auto-generar el número de lote de ítems generales.
 */
export const PREFIJO_LOTE_GENERAL = 'LOTE-GENERAL';

/**
 * Determina si una categoría (por nombre) es de tipo médico.
 * Retorna true si ES médica (requiere FEFO), false si es general (usa FIFO).
 *
 * @param {string} categoriaNombre - Nombre de la categoría
 * @returns {boolean}
 */
export const esCategoriaMediaca = (categoriaNombre) => {
  if (!categoriaNombre) return true; // Por defecto, asumir médico (más seguro)
  const nombreNorm = categoriaNombre.trim().toLowerCase();
  return !CATEGORIAS_GENERALES.some(c => c.toLowerCase() === nombreNorm);
};

/**
 * Determina si un producto es médico basándose en el objeto categoría anidado.
 * Compatible con el formato que retorna Supabase: { categorias: { nombre } }
 *
 * @param {object} producto - Objeto medicinas/productos con join de categorias
 * @returns {boolean}
 */
export const esProductoMedico = (producto) => {
  const cat = producto?.categorias?.nombre || producto?.categoria_nombre || '';
  return esCategoriaMediaca(cat);
};

/**
 * Genera el número de lote automático para ítems generales.
 * Formato: LOTE-GENERAL-2025-<timestamp_corto>
 *
 * @returns {string}
 */
export const generarLoteGeneral = () => {
  const year = new Date().getFullYear();
  const ts = Date.now().toString().slice(-5); // 5 últimos dígitos del timestamp
  return `${PREFIJO_LOTE_GENERAL}-${year}-${ts}`;
};

/**
 * Retorna una representación legible de la fecha de vencimiento.
 * Si es la fecha "no vence" (2099), retorna 'N/A'.
 *
 * @param {string} fechaStr - Fecha ISO string
 * @returns {string}
 */
export const formatFechaVenc = (fechaStr) => {
  if (!fechaStr) return '—';
  if (fechaStr.startsWith('2099')) return 'N/A';
  return new Date(fechaStr).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Filtra las alertas de vencimiento para excluir ítems generales
 * (cuya fecha_vencimiento sea >= 2099).
 *
 * @param {Array} alertas - Array de alertas desde la vista alertas_vencimiento
 * @returns {Array}
 */
export const filtrarAlertasMedicas = (alertas = []) => {
  return alertas.filter(a => {
    // Si la alerta tiene una fecha de vencimiento de 2099+, es un ítem general → excluir
    if (a.fecha_vencimiento && a.fecha_vencimiento.startsWith('2099')) return false;
    return true;
  });
};
