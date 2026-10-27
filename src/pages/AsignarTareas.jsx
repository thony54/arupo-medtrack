import React, { useState, useEffect, useMemo } from 'react';
import { ListPlus, Plus, Trash2, CalendarClock, UserCheck, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cargarPerfiles } from '../lib/equipos';
import { cargarTareas, asignarTarea, retirarTarea, estaVencida } from '../lib/tareas';
import { etiquetasPersonal } from '../utils/roles';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import './pages.css';

const labelStyle = { fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' };
const campoStyle = { display: 'flex', flexDirection: 'column', gap: '0.4rem' };
const bannerStyle = { padding: '0.75rem 1rem', marginBottom: '1.25rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', display: 'flex', gap: '0.5rem', alignItems: 'center' };

const nombreDe = (p) => p?.nombre || p?.email || 'Sin nombre';

const fechaCorta = (ymd) =>
  new Date(`${ymd}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

const hoyYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Pendientes primero (la fecha límite más próxima arriba, las sin fecha al final) y luego las hechas, la más reciente primero.
const ordenar = (a, b) => {
  if (a.estado !== b.estado) return a.estado === 'pendiente' ? -1 : 1;
  if (a.estado === 'completada') return (a.completada_en || '') < (b.completada_en || '') ? 1 : -1;
  if (a.fecha_limite && b.fecha_limite && a.fecha_limite !== b.fecha_limite) return a.fecha_limite < b.fecha_limite ? -1 : 1;
  if (a.fecha_limite !== b.fecha_limite) return a.fecha_limite ? -1 : 1;
  return a.created_at < b.created_at ? 1 : -1;
};

// Pantalla de la coordinación (super_admin y coordinadores): todo lo referente a las tareas
// de su gente (voluntarios o brigadistas, según el rol). Asignar una tarea nueva, ver cuáles
// siguen pendientes o ya se hicieron y retirar las asignadas por error (schema_v30.sql, v33).
export const AsignarTareas = () => {
  const { cohortes } = useAuth() || {};
  const etiq = etiquetasPersonal(cohortes || []);
  const [perfiles, setPerfiles] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [activo, setActivo] = useState(true); // false si falta schema_v30
  const [cargando, setCargando] = useState(!!supabase);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [voluntarioId, setVoluntarioId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [retirando, setRetirando] = useState(null);

  const [filtroVoluntario, setFiltroVoluntario] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('pendiente');

  useEffect(() => {
    if (!supabase) return;
    let cancelado = false;
    Promise.all([cargarPerfiles(), cargarTareas()])
      .then(([resPerfiles, resTareas]) => {
        if (cancelado) return;
        setPerfiles(resPerfiles.perfiles);
        setActivo(resTareas.activo);
        setTareas(resTareas.tareas);
      })
      .catch(err => {
        if (cancelado) return;
        console.error('Error al cargar las tareas de los voluntarios:', err);
        setError('No se pudo cargar la información. Inténtalo de nuevo.');
      })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, []);

  const voluntarios = useMemo(
    () => perfiles.filter(p => (cohortes || []).includes(p.rol)).sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es')),
    [perfiles, cohortes]
  );
  const nombrePorId = useMemo(() => Object.fromEntries(perfiles.map(p => [p.id, nombreDe(p)])), [perfiles]);

  const pendientes = tareas.filter(x => x.estado === 'pendiente').length;
  const hechas = tareas.length - pendientes;
  const visibles = useMemo(
    () => tareas
      .filter(x => (!filtroVoluntario || x.voluntario_id === filtroVoluntario) && (!filtroEstado || x.estado === filtroEstado))
      .sort(ordenar),
    [tareas, filtroVoluntario, filtroEstado]
  );

  const recargar = async () => {
    try {
      const r = await cargarTareas();
      setActivo(r.activo);
      setTareas(r.tareas);
    } catch (err) {
      console.error('No se pudieron recargar las tareas:', err);
      setError('No se pudo actualizar la lista de tareas. Recarga la página.');
    }
  };

  const asignar = async (e) => {
    e.preventDefault();
    setError('');
    setAviso('');
    if (!voluntarioId) return setError(`Elige ${etiq.elige} para asignarle la tarea.`);
    if (!titulo.trim()) return setError('Escribe el título de la tarea.');
    setGuardando(true);
    const res = await asignarTarea({ voluntarioId, titulo: titulo.trim(), descripcion: descripcion.trim(), fechaLimite });
    if (res.ok) {
      // Se conserva el voluntario elegido: lo habitual es asignarle varias seguidas.
      setAviso(`Tarea asignada a ${nombrePorId[voluntarioId] || 'la persona'}.`);
      setTitulo('');
      setDescripcion('');
      setFechaLimite('');
      await recargar();
    } else {
      setError(res.mensaje);
    }
    setGuardando(false);
  };

  const retirar = async (tarea) => {
    if (!window.confirm(`¿Retirar la tarea "${tarea.titulo}"? Dejará de aparecerle a ${nombrePorId[tarea.voluntario_id] || 'la persona'}.`)) return;
    setError('');
    setAviso('');
    setRetirando(tarea.id);
    const res = await retirarTarea(tarea.id);
    if (res.ok) {
      setAviso('Tarea retirada.');
      await recargar();
    } else {
      setError(res.mensaje);
    }
    setRetirando(null);
  };

  const fila = (tarea) => (
    <li key={tarea.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.8rem 1rem', background: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: '700', fontSize: '0.92rem', textDecoration: tarea.estado === 'completada' ? 'line-through' : 'none' }}>{tarea.titulo}</div>
        {tarea.descripcion && (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line', marginTop: '0.2rem' }}>{tarea.descripcion}</div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 1rem', marginTop: '0.45rem', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
            <UserCheck size={13} /> {nombrePorId[tarea.voluntario_id] || etiq.singular}
          </span>
          {tarea.fecha_limite && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CalendarClock size={13} /> Para el {fechaCorta(tarea.fecha_limite)}</span>
          )}
          <span>Asignada por {tarea.asignada_por_nombre}</span>
          {tarea.estado === 'completada' ? (
            <>
              <Badge variant="success">Hecha</Badge>
              {tarea.completada_en && <span>el {new Date(tarea.completada_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
            </>
          ) : (
            estaVencida(tarea) ? <Badge variant="danger">Vencida</Badge> : <Badge variant="warning">Pendiente</Badge>
          )}
        </div>
      </div>
      <button type="button" onClick={() => retirar(tarea)} disabled={retirando === tarea.id} aria-label={`Retirar la tarea ${tarea.titulo}`} title="Retirar tarea"
        style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '2px', display: 'flex', flexShrink: 0 }}>
        <Trash2 size={17} />
      </button>
    </li>
  );

  return (
    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '900px', margin: '0 auto', paddingBottom: '3rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
            <ListPlus size={28} style={{ color: '#7c3aed' }} /> Asignar tareas
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Asigna tareas a {etiq.quienes} y sigue cuáles están pendientes o ya se hicieron. Ellos las ven en su sección “Tareas”.
          </p>
        </div>
      </div>

      {aviso && (
        <div role="status" style={{ ...bannerStyle, background: 'var(--success-bg)', color: 'var(--success-color)' }}>
          <CheckCircle size={16} /> <span>{aviso}</span>
        </div>
      )}
      {error && (
        <div role="alert" style={{ ...bannerStyle, background: 'var(--danger-bg)', color: 'var(--danger-color)' }}>
          <AlertCircle size={16} /> <span>{error}</span>
        </div>
      )}

      {cargando ? (
        <div className="card glass" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Cargando...</div>
      ) : !activo ? (
        <div className="card" style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>
          Las tareas aún no están activas en la base de datos (falta aplicar schema_v30.sql).
        </div>
      ) : (
        <>
          {/* Nueva tarea */}
          <section className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: '700', margin: '0 0 1rem' }}>Nueva tarea</h2>
            <form onSubmit={asignar} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={campoStyle}>
                <label htmlFor="at-voluntario" style={labelStyle}>{etiq.singular} <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                <select id="at-voluntario" className="input-field" style={{ marginBottom: 0 }} value={voluntarioId} disabled={guardando}
                  onChange={e => setVoluntarioId(e.target.value)}>
                  <option value="">Elige {etiq.elige}...</option>
                  {voluntarios.map(v => <option key={v.id} value={v.id}>{nombreDe(v)}</option>)}
                </select>
              </div>
              <div style={campoStyle}>
                <label htmlFor="at-titulo" style={labelStyle}>Tarea <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                <input id="at-titulo" className="input-field" style={{ marginBottom: 0 }} value={titulo} maxLength={120} disabled={guardando}
                  onChange={e => setTitulo(e.target.value)} placeholder="Ej.: Preparar la charla de salud para la brigada del sábado" />
              </div>
              <div style={campoStyle}>
                <label htmlFor="at-detalles" style={labelStyle}>Detalles <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(opcional)</span></label>
                <textarea id="at-detalles" className="input-field" style={{ marginBottom: 0, resize: 'vertical' }} rows={3} value={descripcion} maxLength={500} disabled={guardando}
                  onChange={e => setDescripcion(e.target.value)} />
              </div>
              <div style={{ ...campoStyle, maxWidth: '220px' }}>
                <label htmlFor="at-fecha" style={labelStyle}>Fecha límite <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(opcional)</span></label>
                <input id="at-fecha" type="date" className="input-field" style={{ marginBottom: 0 }} value={fechaLimite} min={hoyYmd()} disabled={guardando}
                  onChange={e => setFechaLimite(e.target.value)} />
              </div>
              <Button type="submit" variant="primary" disabled={guardando || !voluntarioId || !titulo.trim()}
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Plus size={16} /> {guardando ? 'Asignando...' : 'Asignar tarea'}
              </Button>
            </form>
          </section>

          {/* Seguimiento */}
          <section className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                Tareas asignadas
                <Badge variant="warning">{pendientes} pendientes</Badge>
                <Badge variant="success">{hechas} hechas</Badge>
              </h2>
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                <select className="input-field" style={{ marginBottom: 0, minWidth: '180px' }} value={filtroVoluntario}
                  onChange={e => setFiltroVoluntario(e.target.value)} aria-label={`Filtrar por ${etiq.singular.toLowerCase()}`}>
                  <option value="">{etiq.todos}</option>
                  {voluntarios.map(v => <option key={v.id} value={v.id}>{nombreDe(v)}</option>)}
                </select>
                <select className="input-field" style={{ marginBottom: 0 }} value={filtroEstado}
                  onChange={e => setFiltroEstado(e.target.value)} aria-label="Filtrar por estado">
                  <option value="pendiente">Pendientes</option>
                  <option value="completada">Hechas</option>
                  <option value="">Todas</option>
                </select>
              </div>
            </div>

            {visibles.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>
                {tareas.length === 0 ? 'Aún no has asignado tareas.' : 'No hay tareas con esos filtros.'}
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {visibles.map(fila)}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};
