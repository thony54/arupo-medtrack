import React, { useState, useEffect, useMemo } from 'react';
import { ListChecks, CalendarClock, UserCheck, CheckCircle, RotateCcw, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cargarTareas, marcarTarea, estaVencida } from '../../lib/tareas';
import { useI18n } from '../../i18n/useI18n';

const MAX_COMPLETADAS = 5;

// 'AAAA-MM-DD' (fecha sin hora) → Date local; con mediodía para que la zona horaria no cambie el día.
const fechaLocal = (ymd) => new Date(`${ymd}T12:00:00`);

// Tareas que la coordinación le asignó al voluntario (schema_v30.sql). Va dentro de
// "Mis Actividades", encima de su historial de jornadas. Si el módulo aún no está
// activo en la base de datos, no muestra nada.
export const TareasAsignadas = () => {
  const { user } = useAuth() || {};
  const { t, formatearFecha } = useI18n();
  const userId = user?.id;
  const [cargando, setCargando] = useState(true);
  const [activo, setActivo] = useState(false);
  const [tareas, setTareas] = useState([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(null); // id de la tarea en proceso

  useEffect(() => {
    if (!userId) return;
    let cancelado = false;
    cargarTareas(userId)
      .then(res => {
        if (cancelado) return;
        setActivo(res.activo);
        setTareas(res.tareas);
      })
      .catch(err => {
        if (cancelado) return;
        console.error('Error al cargar las tareas asignadas:', err);
        setActivo(true);
        setError(t('tareas.err_cargar'));
      })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
    // `t` cambia al cambiar de idioma; no debe relanzar la carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Pendientes: las de fecha más próxima primero (las sin fecha, al final).
  const pendientes = useMemo(() => tareas
    .filter(x => x.estado === 'pendiente')
    .sort((a, b) => {
      if (a.fecha_limite && b.fecha_limite && a.fecha_limite !== b.fecha_limite) return a.fecha_limite < b.fecha_limite ? -1 : 1;
      if (a.fecha_limite !== b.fecha_limite) return a.fecha_limite ? -1 : 1;
      return a.created_at < b.created_at ? 1 : -1;
    }), [tareas]);
  const completadas = useMemo(() => tareas
    .filter(x => x.estado === 'completada')
    .sort((a, b) => ((a.completada_en || '') < (b.completada_en || '') ? 1 : -1))
    .slice(0, MAX_COMPLETADAS), [tareas]);

  const cambiarEstado = async (tarea, completada) => {
    setGuardando(tarea.id);
    setError('');
    const res = await marcarTarea(tarea.id, completada);
    if (res.ok) {
      setTareas(prev => prev.map(x => (x.id === tarea.id
        ? { ...x, estado: completada ? 'completada' : 'pendiente', completada_en: completada ? new Date().toISOString() : null }
        : x)));
    } else {
      setError(t('tareas.err_guardar'));
    }
    setGuardando(null);
  };

  if (!activo && !cargando) return null;

  const tarjeta = (tarea, hecha) => {
    const vencida = estaVencida(tarea);
    return (
      <li key={tarea.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', background: 'var(--bg-surface)', opacity: hecha ? 0.75 : 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 220px' }}>
            <div style={{ fontWeight: '700', fontSize: '0.92rem', textDecoration: hecha ? 'line-through' : 'none' }}>{tarea.titulo}</div>
            {tarea.descripcion && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>{tarea.descripcion}</p>
            )}
          </div>
          {hecha ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => cambiarEstado(tarea, false)} disabled={guardando === tarea.id}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
              <RotateCcw size={14} /> {t('tareas.deshacer')}
            </Button>
          ) : (
            <Button type="button" variant="primary" size="sm" onClick={() => cambiarEstado(tarea, true)} disabled={guardando === tarea.id}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
              <CheckCircle size={14} /> {t('tareas.marcar_hecha')}
            </Button>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 1.1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <UserCheck size={14} /> {t('tareas.asignada_por', { nombre: tarea.asignada_por_nombre })}
          </span>
          {hecha && tarea.completada_en ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle size={14} /> {t('tareas.completada_el', { fecha: formatearFecha(tarea.completada_en) })}
            </span>
          ) : tarea.fecha_limite ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CalendarClock size={14} /> {t('tareas.fecha_limite', { fecha: formatearFecha(fechaLocal(tarea.fecha_limite)) })}
            </span>
          ) : null}
          {vencida && <Badge variant="danger">{t('tareas.vencida')}</Badge>}
        </div>
      </li>
    );
  };

  return (
    <section aria-labelledby="tareas-titulo" style={{ marginBottom: '2rem' }}>
      <h4 id="tareas-titulo" style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ListChecks size={18} style={{ color: '#7c3aed' }} /> {t('tareas.titulo')}
        {pendientes.length > 0 && <Badge variant="warning">{pendientes.length}</Badge>}
      </h4>
      <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t('tareas.subtitulo')}</p>

      {error && (
        <div role="alert" style={{ padding: '0.75rem', marginBottom: '0.85rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <AlertCircle size={16} /> <span>{error}</span>
        </div>
      )}

      {cargando ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('tareas.cargando')}</p>
      ) : (
        <>
          {pendientes.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>{t('tareas.vacio')}</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {pendientes.map(x => tarjeta(x, false))}
            </ul>
          )}
          {completadas.length > 0 && (
            <>
              <h5 style={{ margin: '1.25rem 0 0.65rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
                {t('tareas.completadas')}
              </h5>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {completadas.map(x => tarjeta(x, true))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
};
