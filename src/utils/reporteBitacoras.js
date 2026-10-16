import * as XLSX from 'xlsx';
import { formatHora, horasDeActividad } from './bitacora';

// Reporte Excel de bitácoras para la coordinación. Dos hojas:
//   · "Actividades": una fila por actividad (lo más útil para filtrar y sumar).
//   · "Resumen": una fila por voluntario con jornadas, actividades y horas.
// Las columnas son una propuesta: el documento de módulos no las especifica.

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES') : '');
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '');

const etiquetaEstado = (e) => (e === 'aprobada' ? 'Aprobada' : 'Pendiente');

// `voluntarios` es un objeto { id: { nombre, email } }.
export const construirHojas = (bitacoras, voluntarios) => {
  const actividades = [];
  const resumen = new Map();

  for (const b of bitacoras) {
    const vol = voluntarios[b.voluntario_id] || {};
    const nombre = vol.nombre || 'Voluntario';
    const acts = Array.isArray(b.actividades) ? b.actividades : [];

    const r = resumen.get(b.voluntario_id) || {
      'Voluntario': nombre, 'Correo': vol.email || '', 'Jornadas': 0, 'Actividades': 0,
      'Horas totales': 0, 'Aprobadas': 0, 'Pendientes': 0
    };
    r['Jornadas'] += 1;
    r['Actividades'] += acts.length;
    r[b.estado === 'aprobada' ? 'Aprobadas' : 'Pendientes'] += 1;

    for (const a of acts) {
      const h = horasDeActividad(a);
      r['Horas totales'] = Math.round((r['Horas totales'] + h) * 100) / 100;
      actividades.push({
        'Fecha': fecha(b.created_at),
        'Hora de envío': hora(b.created_at),
        'Voluntario': nombre,
        'Correo': vol.email || '',
        'Actividad': a.descripcion,
        'Hora inicio': formatHora(a.hora_inicio),
        'Hora fin': formatHora(a.hora_fin),
        'Horas': h,
        'Lugar': a.lugar || '',
        'Líder responsable': b.lider_nombre,
        'Formación continua': b.formacion_continua || '',
        'Fotos': Array.isArray(b.fotos) ? b.fotos.length : 0,
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

// Genera y descarga el archivo. Devuelve cuántas filas de actividades incluyó.
export const exportarBitacorasExcel = (bitacoras, voluntarios) => {
  const { actividades, resumen } = construirHojas(bitacoras, voluntarios);

  const wb = XLSX.utils.book_new();
  const hojaAct = XLSX.utils.json_to_sheet(actividades);
  hojaAct['!cols'] = anchos(actividades);
  XLSX.utils.book_append_sheet(wb, hojaAct, 'Actividades');

  const hojaRes = XLSX.utils.json_to_sheet(resumen);
  hojaRes['!cols'] = anchos(resumen);
  XLSX.utils.book_append_sheet(wb, hojaRes, 'Resumen');

  const hoy = new Date();
  const yyyymmdd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(wb, `bitacoras_voluntariado_${yyyymmdd}.xlsx`);
  return actividades.length;
};
