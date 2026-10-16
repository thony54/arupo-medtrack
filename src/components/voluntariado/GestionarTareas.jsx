import React, { useState } from 'react';
import { Plus, Trash2, CalendarClock, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { asignarTarea, retirarTarea, estaVencida } from '../../lib/tareas';

const labelStyle = { fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' };
const campoStyle = { display: 'flex', flexDirection: 'column', gap: '0.4rem' };

const fechaCorta = (ymd) =>
  new Date(`${ymd}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

const hoyYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Modal de la coordinación: asigna tareas a un voluntario y retira las asignadas por error.
// `tareas` son las de ese voluntario; `onCambio` recarga la lista del padre tras cada cambio.
export const GestionarTareas = ({ voluntario, tareas, onCambio, onClose }) => {
  const nombre = voluntario.nombre || voluntario.email || 'Sin nombre';
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [retirando, setRetirando] = useState(null);
  const [error, setError] = useState('');

  const pendientes = tareas.filter(x => x.estado === 'pendiente');
  const completadas = tareas.filter(x => x.estado === 'completada');

  const asignar = async (e) => {
    e.preventDefault();
    if (!titulo.trim()) return setError('Escribe el título de la tarea.');
    setError('');
    setGuardando(true);
    const res = await asignarTarea({ voluntarioId: voluntario.id, titulo: titulo.trim(), descripcion: descripcion.trim(), fechaLimite });
    if (res.ok) {
      setTitulo('');
      setDescripcion('');
      setFechaLimite('');
      await onCambio();
    } else {
      setError(res.mensaje);
    }
    setGuardando(false);
  };

  const retirar = async (tarea) => {
    if (!window.confirm(`¿Retirar la tarea "${tarea.titulo}"? Dejará de aparecerle al voluntario.`)) return;
    setError('');
    setRetirando(tarea.id);
    const res = await retirarTarea(tarea.id);
    if (res.ok) await onCambio();
    else setError(res.mensaje);
    setRetirando(null);
  };

  const fila = (tarea) => (
    <li key={tarea.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.7rem 0.85rem', background: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.65rem' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{tarea.titulo}</div>
        {tarea.descripcion && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>{tarea.descripcion}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 0.85rem', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          {tarea.fecha_limite && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CalendarClock size={13} /> {fechaCorta(tarea.fecha_limite)}</span>
          )}
          <span>Asignada por {tarea.asignada_por_nombre}</span>
          {tarea.estado === 'completada'
            ? <Badge variant="success">Hecha</Badge>
            : estaVencida(tarea) && <Badge variant="danger">Vencida</Badge>}
        </div>
      </div>
      <button type="button" onClick={() => retirar(tarea)} disabled={retirando === tarea.id} aria-label={`Retirar la tarea ${tarea.titulo}`} title="Retirar tarea"
        style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '2px', display: 'flex', flexShrink: 0 }}>
        <Trash2 size={16} />
      </button>
    </li>
  );

  return (
    <Modal isOpen onClose={onClose} title={`Tareas de ${nombre}`}
      footer={<Button type="button" variant="ghost" onClick={onClose}>Cerrar</Button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {error && (
          <div role="alert" style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} /> <span>{error}</span>
          </div>
        )}

        <form onSubmit={asignar} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={campoStyle}>
            <label htmlFor="tarea-titulo" style={labelStyle}>Nueva tarea <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <input id="tarea-titulo" className="input-field" style={{ marginBottom: 0 }} value={titulo} maxLength={120} disabled={guardando}
              onChange={e => setTitulo(e.target.value)} placeholder="Ej.: Preparar la charla de salud para la brigada del sábado" />
          </div>
          <div style={campoStyle}>
            <label htmlFor="tarea-desc" style={labelStyle}>Detalles <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(opcional)</span></label>
            <textarea id="tarea-desc" className="input-field" style={{ marginBottom: 0, resize: 'vertical' }} rows={3} value={descripcion} maxLength={500} disabled={guardando}
              onChange={e => setDescripcion(e.target.value)} />
          </div>
          <div style={{ ...campoStyle, maxWidth: '220px' }}>
            <label htmlFor="tarea-fecha" style={labelStyle}>Fecha límite <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(opcional)</span></label>
            <input id="tarea-fecha" type="date" className="input-field" style={{ marginBottom: 0 }} value={fechaLimite} min={hoyYmd()} disabled={guardando}
              onChange={e => setFechaLimite(e.target.value)} />
          </div>
          <Button type="submit" variant="primary" disabled={guardando || !titulo.trim()}
            style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={16} /> {guardando ? 'Asignando...' : 'Asignar tarea'}
          </Button>
        </form>

        <div>
          <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
            Pendientes ({pendientes.length})
          </h4>
          {pendientes.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.88rem', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>No tiene tareas pendientes.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{pendientes.map(fila)}</ul>
          )}
        </div>

        {completadas.length > 0 && (
          <div>
            <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
              Hechas ({completadas.length})
            </h4>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{completadas.map(fila)}</ul>
          </div>
        )}
      </div>
    </Modal>
  );
};
