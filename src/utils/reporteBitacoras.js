import * as XLSX from 'xlsx';
import { formatHora, horasDeActividad } from './bitacora';
import { formatEstancia } from './estancia';
import { avanceDeCurso } from '../curso/avance';

// Reporte Excel de bitácoras para la coordinación. Dos hojas:
//   · "Actividades": una fila por actividad (lo más útil para filtrar y sumar).
//   · "Resumen": una fila por voluntario con jornadas, actividades y horas.
// Campos según la tabla "Estructura del reporte Excel" de MedTrack Modulo por anadir.docx:
// ID & Voluntario, Tiempo Estancia, Timestamp Reporte (UTC), Detalle Actividades,
// Líder a Cargo, Evidencia / Foto (URL segura) y Avance Español.

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES') : '');
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '');
// "2026-10-15 14:03:22 UTC": el instante que fijó el servidor, sin zona horaria local de por medio.
const marcaUtc = (iso) => (iso ? `${new Date(iso).toISOString().slice(0, 19).replace('T', ' ')} UTC` : '');

const etiquetaEstado = (e) => (e === 'aprobada' ? 'Aprobada' : 'Pendiente');

// Código corto para identificar al voluntario sin exponer el UUID completo.
const codigoDe = (id) => String(id || '').slice(0, 8).toUpperCase();

// `voluntarios`: { id: { nombre, email, estanciaMeses } }.
// `fotos`: { ruta: urlFirmada } para las evidencias (si falta una ruta, la celda queda vacía).
// `curso`: Map<userId, lecciones completadas>, o null si el curso aún no está activo en la base.
export const construirHojas = (bitacoras, voluntarios, { fotos = {}, curso = null } = {}) => {
  const actividades = [];
  const resumen = new Map();

  const datosDe = (id) => {
    const vol = voluntarios[id] || {};
    const avance = curso ? avanceDeCurso(curso.get(id) || 0) : null;
    return {
      nombre: vol.nombre || 'Voluntario',
      email: vol.email || '',
      codigo: codigoDe(id),
      estancia: formatEstancia(vol.estanciaMeses),
      avancePct: avance ? avance.porcentaje : 'N/D',
      avanceNivel: avance ? avance.nivel : 'N/D'
    };
  };

  for (const b of bitacoras) {
    const v = datosDe(b.voluntario_id);
    const acts = Array.isArray(b.actividades) ? b.actividades : [];
    const evidencias = (Array.isArray(b.fotos) ? b.fotos : []).map((ruta) => fotos[ruta] || '');

    const r = resumen.get(b.voluntario_id) || {
      'ID': v.codigo, 'Voluntario': v.nombre, 'Correo': v.email, 'Tiempo de estancia': v.estancia,
      'Jornadas': 0, 'Actividades': 0, 'Horas totales': 0, 'Aprobadas': 0, 'Pendientes': 0,
      'Avance español (%)': v.avancePct, 'Nivel de español': v.avanceNivel
    };
    r['Jornadas'] += 1;
    r['Actividades'] += acts.length;
    r[b.estado === 'aprobada' ? 'Aprobadas' : 'Pendientes'] += 1;

    for (const a of acts) {
      const h = horasDeActividad(a);
      r['Horas totales'] = Math.round((r['Horas totales'] + h) * 100) / 100;
      actividades.push({
        'ID': v.codigo,
        'Voluntario': v.nombre,
        'Correo': v.email,
        'Tiempo de estancia': v.estancia,
        'Fecha': fecha(b.created_at),
        'Hora de envío': hora(b.created_at),
        'Timestamp (UTC)': marcaUtc(b.created_at),
        'Actividad': a.descripcion,
        'Hora inicio': formatHora(a.hora_inicio),
        'Hora fin': formatHora(a.hora_fin),
        'Horas': h,
        'Lugar': a.lugar || '',
        'Líder a cargo': b.lider_nombre,
        'Formación continua': b.formacion_continua || '',
        'Foto 1 (enlace seguro)': evidencias[0] || '',
        'Foto 2 (enlace seguro)': evidencias[1] || '',
        'Foto 3 (enlace seguro)': evidencias[2] || '',
        'Avance español (%)': v.avancePct,
        'Nivel de español': v.avanceNivel,
        'Estado': etiquetaEstado(b.estado),
        'Revisado por': b.revisado_por_nombre || '',
        'Fecha de revisión': fecha(b.revisado_en)
      });
    }
    resumen.set(b.voluntario_id, r);
  }

  return {
    actividades,
    resumen: [...resumen.values()].sort((x, y) => x['Voluntario'].localeCompare(y['Voluntario'], 'es'))
  };
};

const anchos = (filas) => {
  if (!filas.length) return [];
  return Object.keys(filas[0]).map(col => ({
    wch: Math.min(50, Math.max(col.length, ...filas.map(f => String(f[col] ?? '').length)) + 2)
  }));
};

// Convierte en hipervínculo las celdas con URL de las columnas "Foto N (enlace seguro)".
const enlazarFotos = (hoja, filas) => {
  const columnas = filas.length ? Object.keys(filas[0]) : [];
  columnas.forEach((col, c) => {
    if (!col.startsWith('Foto ')) return;
    filas.forEach((fila, i) => {
      const celda = hoja[XLSX.utils.encode_cell({ r: i + 1, c })];
      if (celda && fila[col]) celda.l = { Target: fila[col], Tooltip: 'Abrir la foto (el enlace caduca)' };
    });
  });
};

// Genera y descarga el archivo. Devuelve cuántas filas de actividades incluyó.
export const exportarBitacorasExcel = (bitacoras, voluntarios, opciones = {}) => {
  const { actividades, resumen } = construirHojas(bitacoras, voluntarios, opciones);

  const wb = XLSX.utils.book_new();
  const hojaAct = XLSX.utils.json_to_sheet(actividades);
  hojaAct['!cols'] = anchos(actividades);
  enlazarFotos(hojaAct, actividades);
  XLSX.utils.book_append_sheet(wb, hojaAct, 'Actividades');

  const hojaRes = XLSX.utils.json_to_sheet(resumen);
  hojaRes['!cols'] = anchos(resumen);
  XLSX.utils.book_append_sheet(wb, hojaRes, 'Resumen');

  const hoy = new Date();
  const yyyymmdd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(wb, `bitacoras_voluntariado_${yyyymmdd}.xlsx`);
  return actividades.length;
};
