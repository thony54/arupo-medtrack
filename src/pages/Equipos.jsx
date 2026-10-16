import React, { useState, useEffect, useMemo } from 'react';
import { Network, Search, Star, UserPlus, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cargarPerfiles, cargarBitacorasRecientes, designarLider, asignarVoluntarioALider } from '../lib/equipos';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { getRolLabel } from '../utils/roles';
import { horasDeBitacora } from '../utils/bitacora';
import './pages.css';

const DIAS_VENTANA = 30;
const DIAS_SIN_ACTIVIDAD = 7;
const MS_DIA = 24 * 60 * 60 * 1000;

const nombreDe = (p) => p?.nombre || p?.email || 'Sin nombre';
const redondear = (n) => Math.round(n * 100) / 100;

const haceCuanto = (iso, ahora) => {
  if (!iso) return 'Sin jornadas';
  const dias = Math.floor((ahora - new Date(iso).getTime()) / MS_DIA);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  return `Hace ${dias} días`;
};

// Equipos de voluntariado para super_admin y coordinadores: designar líderes de
// grupo, asignar voluntarios y ver la actividad de los últimos 30 días.
export const Equipos = () => {
  const [perfiles, setPerfiles] = useState([]);
  const [liderazgo, setLiderazgo] = useState(true); // false si falta schema_v27
  const [bitacoras, setBitacoras] = useState([]);
  const [cargando, setCargando] = useState(!!supabase);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(null); // id del usuario en proceso
  const [busqueda, setBusqueda] = useState('');
  const [nuevoLiderId, setNuevoLiderId] = useState('');
  const [ahora] = useState(() => Date.now()); // referencia fija para "hace N días"

  useEffect(() => {
    if (!supabase) return;
    let cancelado = false;
    Promise.all([cargarPerfiles(), cargarBitacorasRecientes(DIAS_VENTANA).catch(err => {
      // Sin la tabla de bitácoras (schema_v24) el tablero se muestra sin actividad.
      console.error('No se pudieron cargar las bitácoras recientes:', err);
      return [];
    })])
      .then(([resPerfiles, recientes]) => {
        if (cancelado) return;
        setPerfiles(resPerfiles.perfiles);
        setLiderazgo(resPerfiles.liderazgo);
        setBitacoras(recientes);
      })
      .catch(err => {
        if (cancelado) return;
        console.error('Error al cargar los equipos:', err);
        setError('No se pudo cargar la información de los equipos. Inténtalo de nuevo.');
      })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, []);

  const lideres = useMemo(
    () => perfiles.filter(p => p.es_lider).sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es')),
    [perfiles]
  );
  const candidatos = useMemo(
    () => perfiles.filter(p => !p.es_lider).sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es')),
    [perfiles]
  );
  const voluntarios = useMemo(
    () => perfiles.filter(p => p.rol === 'voluntario').sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es')),
    [perfiles]
  );

  // Actividad por voluntario y por líder (el que el voluntario eligió en cada bitácora).
  const { porVoluntario, porLider } = useMemo(() => {
    const vol = {};
    const lid = {};
    for (const b of bitacoras) {
      const horas = horasDeBitacora(b);
      const v = vol[b.voluntario_id] || (vol[b.voluntario_id] = { jornadas: 0, horas: 0, ultima: null });
      v.jornadas += 1;
      v.horas = redondear(v.horas + horas);
      if (!v.ultima || b.created_at > v.ultima) v.ultima = b.created_at;
      if (b.lider_id) {
        const l = lid[b.lider_id] || (lid[b.lider_id] = { jornadas: 0, pendientes: 0, horas: 0 });
        l.jornadas += 1;
        l.horas = redondear(l.horas + horas);
        if (b.estado === 'pendiente') l.pendientes += 1;
      }
    }
    return { porVoluntario: vol, porLider: lid };
  }, [bitacoras]);

  const asignadosA = (liderId) => voluntarios.filter(v => v.lider_id === liderId).length;

  const mostrarResultado = (res, textoOk) => {
    if (res.ok) {
      setError('');
      setAviso(textoOk);
      setTimeout(() => setAviso(''), 4000);
    } else {
      setAviso('');
      setError(res.mensaje);
    }
  };

  const cambiarLider = async (usuario, esLider) => {
    if (!esLider && !window.confirm(`¿Quitar a ${nombreDe(usuario)} como líder? Sus voluntarios quedarán sin asignar.`)) return;
    setGuardando(usuario.id);
    const res = await designarLider(usuario.id, esLider);
    if (res.ok) {
      setPerfiles(prev => prev.map(p => {
        if (p.id === usuario.id) return { ...p, es_lider: esLider };
        return !esLider && p.lider_id === usuario.id ? { ...p, lider_id: null } : p;
      }));
      setNuevoLiderId('');
    }
    mostrarResultado(res, esLider ? `${nombreDe(usuario)} ahora es líder de grupo.` : `${nombreDe(usuario)} ya no es líder.`);
    setGuardando(null);
  };

  const cambiarAsignacion = async (voluntario, liderId) => {
    setGuardando(voluntario.id);
    const res = await asignarVoluntarioALider(voluntario.id, liderId || null);
    if (res.ok) {
      setPerfiles(prev => prev.map(p => (p.id === voluntario.id ? { ...p, lider_id: liderId || null } : p)));
    }
    mostrarResultado(res, `Asignación de ${nombreDe(voluntario)} actualizada.`);
    setGuardando(null);
  };

  const voluntariosFiltrados = voluntarios.filter(v => {
    const q = busqueda.trim().toLowerCase();
    return !q || nombreDe(v).toLowerCase().includes(q) || (v.email || '').toLowerCase().includes(q);
  });

  return (
    <div className="animate-fade-in" style={{ width: '100%', paddingBottom: '2rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Equipos de Voluntariado</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Designa líderes de grupo, asigna a cada voluntario y sigue su actividad de los últimos {DIAS_VENTANA} días.
          </p>
        </div>
      </div>

      {aviso && (
        <div role="status" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', background: 'var(--success-bg)', color: 'var(--success-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <CheckCircle size={16} /> <span>{aviso}</span>
        </div>
      )}
      {error && (
        <div role="alert" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <AlertCircle size={16} /> <span>{error}</span>
        </div>
      )}

      {cargando ? (
        <div className="card glass" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Cargando equipos...</div>
      ) : !liderazgo ? (
        <div className="card" style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>
          La asignación de líderes aún no está activa en la base de datos (falta aplicar schema_v27.sql).
        </div>
      ) : (
        <>
          {/* Líderes de grupo */}
          <section className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: '700', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Star size={18} style={{ color: '#d97706' }} /> Líderes de grupo
            </h2>

            {lideres.length === 0 ? (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', fontStyle: 'italic', margin: '0 0 1rem' }}>
                Aún no hay líderes. Designa al menos uno: los voluntarios lo eligen al cerrar su jornada.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
                {lideres.map(l => {
                  const act = porLider[l.id] || { jornadas: 0, pendientes: 0, horas: 0 };
                  return (
                    <article key={l.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.9rem 1rem', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreDe(l)}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                            {l.es_coordinador ? 'Coordinador · ' : ''}{getRolLabel(l.rol)}
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => cambiarLider(l, false)} disabled={guardando === l.id}
                          style={{ color: 'var(--danger-color)', padding: '0.25rem 0.5rem', height: 'auto', flexShrink: 0 }}>
                          Quitar
                        </Button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <span><strong>{asignadosA(l.id)}</strong> voluntarios</span>
                        <span><strong>{act.jornadas}</strong> jornadas</span>
                        <span><strong>{act.horas}</strong> h</span>
                        {act.pendientes > 0 && <Badge variant="warning">{act.pendientes} por revisar</Badge>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="input-field" style={{ marginBottom: 0, flex: '1 1 240px', maxWidth: '380px' }} value={nuevoLiderId}
                onChange={e => setNuevoLiderId(e.target.value)} aria-label="Persona a designar como líder">
                <option value="">Elige a quién designar como líder...</option>
                {candidatos.map(c => (
                  <option key={c.id} value={c.id}>{nombreDe(c)} · {getRolLabel(c.rol)}</option>
                ))}
              </select>
              <Button type="button" variant="primary" disabled={!nuevoLiderId || guardando === nuevoLiderId}
                onClick={() => cambiarLider(candidatos.find(c => c.id === nuevoLiderId), true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <UserPlus size={16} /> Designar líder
              </Button>
            </div>
          </section>

          {/* Voluntarios */}
          <section className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Network size={18} style={{ color: '#7c3aed' }} /> Voluntarios ({voluntarios.length})
              </h2>
              <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '320px' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                <input className="input-field" style={{ paddingLeft: '2.25rem', marginBottom: 0, width: '100%' }} placeholder="Buscar voluntario..."
                  value={busqueda} onChange={e => setBusqueda(e.target.value)} />
              </div>
            </div>

            <div className="table-container">
              <table className="data-table" style={{ width: '100%', minWidth: '720px' }}>
                <thead>
                  <tr>
                    <th>Voluntario</th>
                    <th>Líder asignado</th>
                    <th>Jornadas ({DIAS_VENTANA} d)</th>
                    <th>Horas</th>
                    <th>Última jornada</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {voluntariosFiltrados.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>No hay voluntarios que coincidan.</td></tr>
                  ) : voluntariosFiltrados.map(v => {
                    const act = porVoluntario[v.id];
                    const inactivo = !act || (ahora - new Date(act.ultima).getTime()) > DIAS_SIN_ACTIVIDAD * MS_DIA;
                    return (
                      <tr key={v.id}>
                        <td>
                          <div style={{ fontWeight: '600' }}>{nombreDe(v)}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{v.email}</div>
                        </td>
                        <td>
                          <select className="input-field" style={{ marginBottom: 0, minWidth: '190px' }} value={v.lider_id || ''}
                            onChange={e => cambiarAsignacion(v, e.target.value)} disabled={guardando === v.id}
                            aria-label={`Líder de ${nombreDe(v)}`}>
                            <option value="">Sin asignar</option>
                            {lideres.map(l => <option key={l.id} value={l.id}>{nombreDe(l)}</option>)}
                          </select>
                        </td>
                        <td>{act?.jornadas || 0}</td>
                        <td>{act?.horas || 0}</td>
                        <td>{haceCuanto(act?.ultima, ahora)}</td>
                        <td>
                          <Badge variant={inactivo ? 'warning' : 'success'}>
                            {inactivo ? `Sin actividad ${DIAS_SIN_ACTIVIDAD}+ días` : 'Activo'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
