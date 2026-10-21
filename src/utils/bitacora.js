// Bitácora de cierre de jornada del voluntario: constantes y utilidades puras.
// Los límites deben coincidir con los de la función registrar_bitacora
// (supabase/schema_v24.sql y v26), que es quien las hace valer en el servidor.

import { tEs } from '../i18n/tEs';

export const BUCKET_FOTOS = 'momentos-felices';
export const MAX_ACTIVIDADES = 20;
export const MIN_FOTOS = 1;
export const MAX_FOTOS = 3;

// El mensaje traducido está en la clave cierre.mensaje de cada idioma; este es el original en español.
export const MENSAJE_CIERRE =
  '¡Muchas gracias por compartir tu experiencia y dedicar tu corazón a transformar vidas en la Fundación Arupo!';

// Máximo del campo "formación continua" (igual que registrar_bitacora).
export const MAX_FORMACION = 1000;
// Las lecciones sugeridas son las trabajadas desde la última jornada, hasta este tope de días atrás.
export const DIAS_LECCIONES_SUGERIDAS = 7;

// Texto de "formación continua" que se guarda en la bitácora. Lo lee la coordinación (y va
// al Excel), así que las lecciones se escriben siempre en español, con su unidad.
//   lecciones: [{ titulo, unidadId }]   otra: texto libre del voluntario
export const armarFormacionContinua = (lecciones, otra = '') => {
  const partes = [];
  if (lecciones.length) {
    partes.push(`Curso de español: ${lecciones.map((l) => `${l.titulo} (U${l.unidadId})`).join('; ')}.`);
  }
  const extra = otra.trim();
  if (extra) partes.push(lecciones.length ? `Otra formación: ${extra}` : extra);
  return partes.join(' ');
};

export const nuevaActividad = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  descripcion: '',
  hora_inicio: '',
  hora_fin: '',
  lugar: ''
});

// reloj12h (es/en): '10:00' → '10:00 am' · '12:00' → '12:00 pm' · '00:30' → '12:30 am' · '15:05' → '3:05 pm'
// sin reloj12h (de/pt/it/fr): '15:05' → '15:05'
export const formatHora = (hhmm, reloj12h = true) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm || '');
  if (!m) return '';
  if (!reloj12h) return `${m[1]}:${m[2]}`;
  const h = Number(m[1]);
  const sufijo = h >= 12 ? 'pm' : 'am';
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${sufijo}`;
};

// "Capacitación Unidad Educativa de 10:00 am a 12:00 pm - Alpachaca/Ecuador"
export const describirActividad = (a, t = tEs, reloj12h = true) => {
  const base = t('bitacora.actividad_formato', {
    descripcion: a.descripcion,
    inicio: formatHora(a.hora_inicio, reloj12h),
    fin: formatHora(a.hora_fin, reloj12h)
  });
  return a.lugar ? `${base} - ${a.lugar}` : base;
};

// Devuelve el mensaje del primer problema, o '' si todo está bien.
export const validarActividades = (lista, t = tEs) => {
  if (!lista.length) return t('bitacora.val_minimo');
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    const n = i + 1;
    if (!a.descripcion.trim()) return t('bitacora.val_descripcion', { n });
    if (!a.hora_inicio || !a.hora_fin) return t('bitacora.val_horas', { n });
    if (a.hora_fin <= a.hora_inicio) return t('bitacora.val_fin', { n });
  }
  return '';
};

const minutosDe = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
};

// Horas de una actividad con dos decimales (90 min → 1.5).
export const horasDeActividad = (a) =>
  Math.round(Math.max(0, minutosDe(a.hora_fin) - minutosDe(a.hora_inicio)) / 60 * 100) / 100;

// Horas totales de una bitácora.
export const horasDeBitacora = (b) =>
  Math.round((Array.isArray(b.actividades) ? b.actividades : []).reduce((t, a) => t + horasDeActividad(a), 0) * 100) / 100;

// Estado de revisión de una bitácora → texto y variante de <Badge>.
export const etiquetaEstado = (estado, t = tEs) => {
  if (estado === 'aprobada') return { label: t('bitacora.estado_aprobada'), variant: 'success' };
  if (estado === 'rechazada') return { label: t('bitacora.estado_rechazada'), variant: 'danger' };
  return { label: t('bitacora.estado_pendiente'), variant: 'warning' };
};

// Reduce la foto antes de subirla: lado mayor ≤ maxLado, JPEG. Una foto de
// celular ronda los 4–8 MB; así queda en unos 150–400 KB y sube aun con poca señal.
export const comprimirImagen = (file, maxLado = 1280, calidad = 0.8) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen.'))),
        'image/jpeg',
        calidad
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('El archivo no es una imagen válida.'));
    };
    img.src = url;
  });
