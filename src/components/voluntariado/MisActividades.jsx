import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, MapPin, UserCheck, GraduationCap, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { CierreJornada } from './CierreJornada';
import { BUCKET_FOTOS, describirActividad, etiquetaEstado } from '../../utils/bitacora';

const POR_PAGINA = 20;

const capitalizar = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const formatearFechaHora = (iso) =>
  capitalizar(new Date(iso).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }));

const mesDe = (iso) =>
  new Date(iso).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

// Pestaña "Mis Actividades" del voluntario: línea de tiempo cronológica con las
// jornadas que ha cerrado y el estado de revisión de cada una.
export const MisActividades = () => {
  const { user } = useAuth() || {};
  // Se depende del id (no del objeto user) para que un refresco de sesión no relance la carga.
  const userId = user?.id;
  const [items, setItems] = useState([]);
  const [fotos, setFotos] = useState({}); // foto_path → URL firmada temporal
  const [cargando, setCargando] = useState(!!supabase);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState('');
  const [moduloInactivo, setModuloInactivo] = useState(false);
  const [mostrarCierre, setMostrarCierre] = useState(false);

  // Pide una página de bitácoras y las URLs firmadas de sus fotos. No toca el
  // estado: lo aplican quienes la llaman (efecto inicial y botones).
  const obtenerPagina = useCallback(async (desde) => {
    const { data, error: err } = await supabase
      .from('bitacoras')
      .select('*')
      .eq('voluntario_id', userId)
      .order('created_at', { ascending: false })
      .range(desde, desde + POR_PAGINA - 1);
    if (err) throw err;

    const nuevas = data || [];
    // Fotos privadas: URLs firmadas de una hora para las miniaturas.
    const rutas = nuevas.map(b => b.foto_path).filter(Boolean);
    let urls = {};
    if (rutas.length) {
      const { data: firmadas, error: firmaError } = await supabase.storage
        .from(BUCKET_FOTOS)
        .createSignedUrls(rutas, 3600);
      if (firmaError) {
        console.error('No se pudieron firmar las fotos:', firmaError.message);
      } else {
        urls = Object.fromEntries((firmadas || []).filter(f => f.signedUrl).map(f => [f.path, f.signedUrl]));
      }
    }
    return { nuevas, urls };
  }, [userId]);

  const aplicarPagina = (desde, { nuevas, urls }) => {
    setItems(prev => (desde === 0 ? nuevas : [...prev, ...nuevas]));
    setFotos(prev => ({ ...prev, ...urls }));
    setHayMas(nuevas.length === POR_PAGINA);
    setError('');
  };

  const manejarFallo = (err) => {
    // 42P01 / PGRST205: la tabla aún no existe (falta schema_v24).
    if (err?.code === '42P01' || err?.code === 'PGRST205') {
      setModuloInactivo(true);
    } else {
      console.error('Error al cargar las actividades:', err);
      setError('No se pudieron cargar tus actividades. Inténtalo de nuevo.');
    }
  };

  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelado = false;
    obtenerPagina(0)
      .then(res => { if (!cancelado) aplicarPagina(0, res); })
      .catch(err => { if (!cancelado) manejarFallo(err); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
    // aplicarPagina y manejarFallo solo escriben estado; no deben re-disparar la carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obtenerPagina]);

  const recargar = () => {
    setCargando(true);
    obtenerPagina(0)
      .then(res => aplicarPagina(0, res))
      .catch(manejarFallo)
      .finally(() => setCargando(false));
  };

  const cargarMas = () =>
    obtenerPagina(items.length)
      .then(res => aplicarPagina(items.length, res))
      .catch(manejarFallo);

  // Agrupa por mes conservando el orden (más reciente primero).
  const grupos = items.reduce((acc, b) => {
    const mes = mesDe(b.created_at);
    const ultimo = acc[acc.length - 1];
    if (ultimo && ultimo.mes === mes) ultimo.items.push(b);
    else acc.push({ mes, items: [b] });
    return acc;
  }, []);

  return (
    <div className="card glass animate-fade-in" style={{ padding: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={20} style={{ color: '#7c3aed' }} /> Mis Actividades
          </h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Tu historial de jornadas, de la más reciente a la más antigua.
          </p>
        </div>
        {!moduloInactivo && (
          <Button type="button" variant="primary" onClick={() => setMostrarCierre(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: 'none' }}>
            <Plus size={16} /> Cerrar jornada
          </Button>
        )}
      </div>

      {moduloInactivo ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
          El registro de jornadas aún no está activo. Avisa al administrador.
        </p>
      ) : cargando ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Cargando tus actividades...</p>
      ) : error ? (
        <div role="alert" style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <AlertCircle size={16} /> <span>{error}</span>
        </div>
      ) : items.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', fontStyle: 'italic' }}>
          Aún no has cerrado ninguna jornada. Cuando termines tu día, toca “Cerrar jornada” para contarnos qué hiciste.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {grupos.map(g => (
            <section key={g.mes}>
              <h4 style={{ margin: '0 0 0.85rem', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
                {g.mes}
              </h4>
              <ol style={{ listStyle: 'none', margin: 0, padding: '0 0 0 1.25rem', borderLeft: '2px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {g.items.map(b => {
                  const estado = etiquetaEstado(b.estado);
                  const acts = Array.isArray(b.actividades) ? b.actividades : [];
                  return (
                    <li key={b.id} style={{ position: 'relative' }}>
                      <span aria-hidden="true" style={{ position: 'absolute', left: 'calc(-1.25rem - 7px)', top: '0.35rem', width: '12px', height: '12px', borderRadius: '50%', background: '#7c3aed', border: '2px solid var(--bg-surface)' }} />
                      <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.9rem 1rem', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{formatearFechaHora(b.created_at)}</span>
                          <Badge variant={estado.variant}>{estado.label}</Badge>
                        </div>

                        <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                          {acts.map((a, i) => (
                            <li key={i}>{describirActividad(a)}</li>
                          ))}
                        </ul>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <UserCheck size={14} /> Líder: {b.lider_nombre}
                          </span>
                          {b.formacion_continua && (
                            <span style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                              <GraduationCap size={14} style={{ flexShrink: 0, marginTop: '2px' }} /> {b.formacion_continua}
                            </span>
                          )}
                        </div>

                        {b.foto_path && fotos[b.foto_path] && (
                          <a href={fotos[b.foto_path]} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'flex-start' }} title="Ver foto completa">
                            <img src={fotos[b.foto_path]} alt="Momento feliz de la jornada" loading="lazy"
                              style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'block' }} />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}

          {hayMas && (
            <Button type="button" variant="outline" onClick={cargarMas} style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <MapPin size={16} /> Ver jornadas anteriores
            </Button>
          )}
        </div>
      )}

      <CierreJornada isOpen={mostrarCierre} onClose={() => setMostrarCierre(false)} onSuccess={recargar} />
    </div>
  );
};
