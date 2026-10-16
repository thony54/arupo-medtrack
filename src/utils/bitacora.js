// Bitácora de cierre de jornada del voluntario: constantes y utilidades puras.
// Los límites deben coincidir con los de la función registrar_bitacora
// (supabase/schema_v24.sql y v26), que es quien las hace valer en el servidor.

export const BUCKET_FOTOS = 'momentos-felices';
export const MAX_ACTIVIDADES = 20;
export const MIN_FOTOS = 1;
export const MAX_FOTOS = 3;

export const MENSAJE_CIERRE =
  '¡Muchas gracias por compartir tu experiencia y dedicar tu corazón a transformar vidas en la Fundación Arupo!';

export const nuevaActividad = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  descripcion: '',
  hora_inicio: '',
  hora_fin: '',
  lugar: ''
});

// '10:00' → '10:00 am' · '12:00' → '12:00 pm' · '00:30' → '12:30 am' · '15:05' → '3:05 pm'
export const formatHora = (hhmm) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm || '');
  if (!m) return '';
  const h = Number(m[1]);
  const sufijo = h >= 12 ? 'pm' : 'am';
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${sufijo}`;
};

// "Capacitación Unidad Educativa de 10:00 am a 12:00 pm - Alpachaca/Ecuador"
export const describirActividad = (a) => {
  const base = `${a.descripcion} de ${formatHora(a.hora_inicio)} a ${formatHora(a.hora_fin)}`;
  return a.lugar ? `${base} - ${a.lugar}` : base;
};

// Devuelve el mensaje del primer problema, o '' si todo está bien.
export const validarActividades = (lista) => {
  if (!lista.length) return 'Registra al menos una actividad.';
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    const n = `Actividad ${i + 1}`;
    if (!a.descripcion.trim()) return `${n}: describe qué hiciste.`;
    if (!a.hora_inicio || !a.hora_fin) return `${n}: indica la hora de inicio y la de fin.`;
    if (a.hora_fin <= a.hora_inicio) return `${n}: la hora de fin debe ser posterior a la de inicio.`;
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
export const etiquetaEstado = (estado) =>
  estado === 'aprobada'
    ? { label: 'Aprobada', variant: 'success' }
    : { label: 'Pendiente de revisión', variant: 'warning' };

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
