import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardCheck, Download, CheckCircle, UserCheck, GraduationCap, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { firmarFotos } from '../lib/bitacoras';
import { cargarPerfiles } from '../lib/equipos';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { describirActividad, etiquetaEstado } from '../utils/bitacora';
import { exportarBitacorasExcel } from '../utils/reporteBitacoras';
import './pages.css';

const POR_PAGINA = 30;
const POR_LOTE_EXCEL = 1000; // tope de filas por petición de PostgREST
const MAX_LOTES_EXCEL = 20;
const FILTROS_VACIOS = { voluntarioId: '', liderId: '', estado: '', desde: '', hasta: '' };

const labelStyle = { fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-secondary)' };
const capitalizar = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const fechaHora = (iso) =>
  capitalizar(new Date(iso).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }));

// Rango de fechas en hora LOCAL: 'hasta' es inclusivo (hasta el final de ese día).
const consultaBase = (f) => {
  let q = supabase.from('bitacoras').select('*').order('created_at', { ascending: false }).order('id');
  if (f.voluntarioId) q = q.eq('voluntario_id', f.voluntarioId);
  if (f.liderId) q = q.eq('lider_id', f.liderId);
  if (f.estado) q = q.eq('estado', f.estado);
  if (f.desde) q = q.gte('created_at', new Date(`${f.desde}T00:00:00`).toISOString());
  if (f.hasta) {
    const fin = new Date(`${f.hasta}T00:00:00`);
    fin.setDate(fin.getDate() + 1);
    q = q.lt('created_at', fin.toISOString());
  }
  return q;
};

const obtenerPagina = async (desde, filtros) => {
  const { data, error } = await consultaBase(filtros).range(desde, desde + POR_PAGINA - 1);
  if (error) throw error;
  const nuevas = data || [];
  const urls = await firmarFotos(nuevas.flatMap(b => b.fotos || []));
  return { nuevas, urls };
};

// 42P01 / PGRST205: la tabla aún no existe (falta schema_v24).
const tablaInexistente = (err) => err?.code === '42P01' || err?.code === 'PGRST205';

// Pantalla de revisión de bitácoras para super_admin y coordinadores: lista con
// filtros, aprobación y descarga a Excel.
export const Bitacoras = () => {
  const { user } = useAuth() || {};
  const [perfiles, setPerfiles] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [items, setItems] = useState([]);
  const [fotos, setFotos] = useState({});
  const [cargando, setCargando] = useState(!!supabase);
  const [hayMas, setHayMas] = useState(false);
  const [moduloInactivo, setModuloInactivo] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [aprobandoId, setAprobandoId] = useState(null);
  const [exportando, setExportando] = useState(false);

  // Perfiles: nombres para mostrar y lista de voluntarios para el filtro.
  useEffect(() => {
    if (!supabase) return;
    let cancelado = false;
    cargarPerfiles()
      .then(({ perfiles: lista }) => { if (!cancelado) setPerfiles(lista); })
      .catch(err => console.error('No se pudo cargar la lista de personal:', err?.message));
    return () => { cancelado = true; };
  }, []);

  const mapaPerfiles = useMemo(
    () => Object.fromEntries(perfiles.map(p => [p.id, { nombre: p.nombre || p.email, email: p.email }])),
    [perfiles]
  );
  const listaLideres = useMemo(
    () => perfiles.filter(p => p.es_lider).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')),
    [perfiles]
  );
  const listaVoluntarios = useMemo(
    () => perfiles.filter(p => p.rol === 'voluntario').sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')),
    [perfiles]
  );

  // Se vuelve a cargar desde cero cada vez que cambian los filtros.
  useEffect(() => {
    if (!supabase) return;
    let cancelado = false;
    obtenerPagina(0, filtros)
      .then(({ nuevas, urls }) => {
        if (cancelado) return;
        setItems(nuevas);
        setFotos(urls);
        setHayMas(nuevas.length === POR_PAGINA);
        setError('');
      })
      .catch(err => {
        if (cancelado) return;
        if (tablaInexistente(err)) {
          setModuloInactivo(true);
        } else {
          console.error('Error al cargar las bitácoras:', err);
          setError('No se pudieron cargar las bitácoras. Inténtalo de nuevo.');
        }
      })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [filtros]);

  const cambiarFiltro = (campo, valor) => {
    setCargando(true);
    setFiltros(prev => ({ ...prev, [campo]: valor }));
  };

  const limpiarFiltros = () => {
    setCargando(true);
    setFiltros(FILTROS_VACIOS);
  };

  const cargarMas = () =>
    obtenerPagina(items.length, filtros)
      .then(({ nuevas, urls }) => {
        setItems(prev => [...prev, ...nuevas]);
        setFotos(prev => ({ ...prev, ...urls }));
        setHayMas(nuevas.length === POR_PAGINA);
      })
      .catch(err => {
        console.error('Error al cargar más bitácoras:', err);
        setError('No se pudieron cargar más bitácoras. Inténtalo de nuevo.');
      });

  const aprobar = async (b) => {
    setAprobandoId(b.id);
    setError('');
    setAviso('');
    try {
      const { data, error: err } = await supabase.rpc('aprobar_bitacora', { p_id: b.id });
      if (err) {
        console.error('Error al aprobar la bitácora:', err);
        if (err.code === 'PGRST202') throw new Error('Falta activar la aprobación en la base de datos (schema_v25.sql).');
        if (err.code === '42501') throw new Error('No tienes permiso para aprobar bitácoras.');
        if (err.code === 'P0002') throw new Error('Esta bitácora ya fue aprobada o no se puede aprobar. Recarga la lista.');
        throw new Error('No se pudo aprobar la bitácora. Inténtalo de nuevo.');
      }
      const r = Array.isArray(data) ? data[0] : data;
      setItems(prev => prev.map(x => (x.id === b.id
        ? { ...x, estado: 'aprobada', revisado_por: user?.id, revisado_por_nombre: r?.aprobada_por, revisado_en: r?.aprobada_en }
        : x)));
      setAviso(`Bitácora de ${mapaPerfiles[b.voluntario_id]?.nombre || 'voluntario'} aprobada.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setAprobandoId(null);
    }
  };

  // Descarga TODO lo que coincide con los filtros (no solo la página cargada).
  const exportar = async () => {
    setExportando(true);
    setError('');
    setAviso('');
    try {
      let todas = [];
      for (let lote = 0; lote < MAX_LOTES_EXCEL; lote++) {
        const desde = lote * POR_LOTE_EXCEL;
        const { data, error: err } = await consultaBase(filtros).range(desde, desde + POR_LOTE_EXCEL - 1);
        if (err) throw err;
        todas = todas.concat(data || []);
        if ((data || []).length < POR_LOTE_EXCEL) break;
      }
      if (todas.length === 0) {
        setError('No hay bitácoras con esos filtros para exportar.');
        return;
      }
      const filas = exportarBitacorasExcel(todas, mapaPerfiles);
      setAviso(`Excel descargado: ${todas.length} jornadas y ${filas} actividades.`);
    } catch (err) {
      console.error('Error al exportar las bitácoras:', err);
      setError('No se pudo generar el Excel. Inténtalo de nuevo.');
    } finally {
      setExportando(false);
    }
  };

  const hayFiltros = Object.values(filtros).some(Boolean);

  return (
    <div className="animate-fade-in" style={{ width: '100%', paddingBottom: '2rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bitácoras de Voluntariado</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Jornadas que cierran los voluntarios: revisa, aprueba y descarga los reportes.
          </p>
        </div>
        <Button variant="primary" onClick={exportar} disabled={exportando || moduloInactivo}
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Download size={18} /> {exportando ? 'Generando...' : 'Descargar Excel'}
        </Button>
      </div>

      {moduloInactivo ? (
        <div className="card" style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>
          El módulo de bitácoras aún no está activo en la base de datos (falta aplicar schema_v24.sql).
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem', alignItems: 'end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', ...labelStyle }}>
                Voluntario
                <select className="input-field" style={{ marginBottom: 0 }} value={filtros.voluntarioId}
                  onChange={e => cambiarFiltro('voluntarioId', e.target.value)}>
                  <option value="">Todos</option>
                  {listaVoluntarios.map(v => (
                    <option key={v.id} value={v.id}>{v.nombre || v.email}</option>
                  ))}
                </select>
              </label>
              {listaLideres.length > 0 && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', ...labelStyle }}>
                  Líder
                  <select className="input-field" style={{ marginBottom: 0 }} value={filtros.liderId}
                    onChange={e => cambiarFiltro('liderId', e.target.value)}>
                    <option value="">Todos</option>
                    {listaLideres.map(l => (
                      <option key={l.id} value={l.id}>{l.nombre || l.email}</option>
                    ))}
                  </select>
                </label>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', ...labelStyle }}>
                Estado
                <select className="input-field" style={{ marginBottom: 0 }} value={filtros.estado}
                  onChange={e => cambiarFiltro('estado', e.target.value)}>
                  <option value="">Todos</option>
                  <option value="pendiente">Pendientes de revisión</option>
                  <option value="aprobada">Aprobadas</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', ...labelStyle }}>
                Desde
                <input type="date" className="input-field" style={{ marginBottom: 0 }} value={filtros.desde}
                  onChange={e => cambiarFiltro('desde', e.target.value)} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', ...labelStyle }}>
                Hasta
                <input type="date" className="input-field" style={{ marginBottom: 0 }} value={filtros.hasta}
                  onChange={e => cambiarFiltro('hasta', e.target.value)} />
              </label>
              {hayFiltros && (
                <Button type="button" variant="ghost" onClick={limpiarFiltros}>Limpiar filtros</Button>
              )}
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
            <div className="card glass" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              Cargando bitácoras...
            </div>
          ) : items.length === 0 ? (
            <div className="card glass" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
              <ClipboardCheck size={36} style={{ display: 'block', margin: '0 auto 0.5rem', opacity: 0.4 }} />
              <span style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>
                {hayFiltros ? 'No hay bitácoras con esos filtros.' : 'Aún no hay bitácoras registradas.'}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {items.map(b => {
                const estado = etiquetaEstado(b.estado);
                const acts = Array.isArray(b.actividades) ? b.actividades : [];
                const nombre = mapaPerfiles[b.voluntario_id]?.nombre || 'Voluntario';
                const puedeAprobar = b.estado === 'pendiente' && b.voluntario_id !== user?.id;
                return (
                  <article key={b.id} className="card" style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '1rem' }}>{nombre}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{fechaHora(b.created_at)}</div>
                      </div>
                      <Badge variant={estado.variant}>{estado.label}</Badge>
                    </div>

                    <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
                      {acts.map((a, i) => <li key={i}>{describirActividad(a)}</li>)}
                    </ul>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <UserCheck size={14} /> Líder: {b.lider_nombre}
                      </span>
                      {b.formacion_continua && (
                        <span style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                          <GraduationCap size={14} style={{ flexShrink: 0, marginTop: '2px' }} /> {b.formacion_continua}
                        </span>
                      )}
                    </div>

                    {(b.fotos || []).some(r => fotos[r]) && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {b.fotos.filter(r => fotos[r]).map((r, i) => (
                          <a key={r} href={fotos[r]} target="_blank" rel="noopener noreferrer" title="Ver foto completa">
                            <img src={fotos[r]} alt={`Momento feliz de ${nombre} (${i + 1})`} loading="lazy"
                              style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'block' }} />
                          </a>
                        ))}
                      </div>
                    )}

                    {b.estado === 'aprobada' ? (
                      b.revisado_por_nombre && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                          Aprobada por {b.revisado_por_nombre}
                          {b.revisado_en && ` · ${new Date(b.revisado_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                        </div>
                      )
                    ) : puedeAprobar && (
                      <div>
                        <Button type="button" variant="primary" onClick={() => aprobar(b)} disabled={aprobandoId === b.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <CheckCircle size={16} /> {aprobandoId === b.id ? 'Aprobando...' : 'Aprobar'}
                        </Button>
                      </div>
                    )}
                  </article>
                );
              })}

              {hayMas && (
                <Button type="button" variant="outline" onClick={cargarMas} style={{ alignSelf: 'center' }}>
                  Ver más jornadas
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
