import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Camera, X, ChevronRight, Package, Wifi, WifiOff, HandHeart, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useOfflineCache } from '../hooks/useOfflineCache';
import { filtrarAlertasMedicas, esProductoMedico } from '../utils/itemUtils';
import './pages.css';

export const Inventory = () => {
  const navigate = useNavigate();
  const [medicinas, setMedicinas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const { isOnline, pendingCount, fetchMedicinas: fetchOffline } = useOfflineCache();

  useEffect(() => { 
    fetchData(); 
    
    const handleUpdate = () => fetchData();
    window.addEventListener('inventory-updated', handleUpdate);

    // Suscripción en tiempo real con Supabase para cambios en base de datos
    let channel;
    if (supabase) {
      channel = supabase
        .channel('inventory-realtime-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'medicinas' },
          () => fetchData()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'lotes' },
          () => fetchData()
        )
        .subscribe();
    }

    return () => {
      window.removeEventListener('inventory-updated', handleUpdate);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!supabase) throw new Error('Sin conexión');
      const [medRes, catRes, alertRes] = await Promise.all([
        supabase.from('medicinas').select('*, categorias(nombre), lotes(id, fecha_vencimiento, estado)').order('nombre'),
        supabase.from('categorias').select('*'),
        supabase.from('alertas_vencimiento').select('*').limit(10)
      ]);
      if (medRes.error) throw medRes.error;
      setMedicinas(medRes.data || []);
      // Ordenar categorías por el orden en que aparecen en los medicamentos (no alfabético)
      const catData = catRes.data || [];
      const ordenCategoriasEnDatos = [];
      const seen = new Set();
      (medRes.data || []).forEach(m => {
        const catNombre = m.categorias?.nombre;
        if (catNombre && !seen.has(catNombre)) {
          seen.add(catNombre);
          const catObj = catData.find(c => c.nombre === catNombre);
          if (catObj) ordenCategoriasEnDatos.push(catObj);
        }
      });
      // Agregar categorías que no tienen medicamentos al final
      catData.forEach(c => {
        if (!seen.has(c.nombre)) ordenCategoriasEnDatos.push(c);
      });
      setCategorias(ordenCategoriasEnDatos);
      // Filtrar alertas: excluir ítems generales (fecha 2099) para evitar falsos positivos
      setAlertas(filtrarAlertasMedicas(alertRes.data || []));
    } catch {
      const cached = await fetchOffline();
      if (cached && cached.length > 0) {
        setMedicinas(cached);
      } else {
        setMedicinas([
          { id: '1', nombre: 'Paracetamol', concentracion: '500mg', presentacion: 'Tabletas', stock_actual: 150, categorias: { nombre: 'Analgésicos' } },
          { id: '2', nombre: 'Amoxicilina', concentracion: '500mg', presentacion: 'Cápsulas', stock_actual: 0, categorias: { nombre: 'Antibióticos' } },
          { id: '3', nombre: 'Ibuprofeno', concentracion: '400mg', presentacion: 'Tabletas', stock_actual: 8, categorias: { nombre: 'Analgésicos' } },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Obtiene la fecha de caducidad más próxima (no 2099) del primer lote disponible
  const getFechaCaducidad = (lotes) => {
    if (!lotes || lotes.length === 0) return null;
    const validos = lotes
      .filter(l => l.fecha_vencimiento && !l.fecha_vencimiento.startsWith('2099'))
      .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));
    return validos.length > 0 ? validos[0].fecha_vencimiento : null;
  };

  const formatCaducidad = (fechaStr) => {
    if (!fechaStr) return '—';
    const fecha = new Date(fechaStr + 'T12:00:00');
    const hoy = new Date();
    const diffDias = Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
    const fechaFmt = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return { texto: fechaFmt, dias: diffDias };
  };

  const getStockStatus = (s) => s === 0 ? 'agotado' : s < 10 ? 'critico' : 'normal';
  const getStockBadge = (s) => {
    if (s === 0) return <Badge variant="danger">Agotado</Badge>;
    if (s < 10) return <Badge variant="warning">Crítico</Badge>;
    return <Badge variant="success">En Stock</Badge>;
  };
  const getStockBarColor = (s) =>
    s === 0 ? 'var(--danger-color)' : s < 10 ? 'var(--warning-color)' : 'var(--success-color)';

  // Primero filtrar solo por texto (sin aplicar aún filtroCategoria ni filtroEstado)
  // para que el dropdown de categorías muestre solo las presentes en los resultados del texto
  const filtradosPorTexto = medicinas.filter(m => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return m.nombre.toLowerCase().includes(q) ||
      (m.nombre_generico || '').toLowerCase().includes(q) ||
      (m.nombre_comercial || '').toLowerCase().includes(q) ||
      (m.categorias?.nombre || '').toLowerCase().includes(q) ||
      (m.laboratorio || '').toLowerCase().includes(q) ||
      (m.concentracion || '').toLowerCase().includes(q) ||
      (m.presentacion || '').toLowerCase().includes(q) ||
      (m.via_administracion || '').toLowerCase().includes(q) ||
      (esProductoMedico(m) ? 'medico médica' : 'general').toLowerCase().includes(q);
  });

  // Categorías disponibles en el dropdown: solo las que aparecen en los resultados del texto
  const categoriasEnResultados = categorias.filter(c =>
    filtradosPorTexto.some(m => m.categorias?.nombre === c.nombre)
  );

  const filtered = filtradosPorTexto.filter(m => {
    const matchCat = !filtroCategoria || m.categorias?.nombre === filtroCategoria;
    const matchEst = !filtroEstado || getStockStatus(m.stock_actual) === filtroEstado;
    return matchCat && matchEst;
  });

  const activeFilters = [filtroCategoria, filtroEstado].filter(Boolean).length;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventario</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {filtered.length} de {medicinas.length} productos
            </p>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: isOnline ? 'var(--success-color)' : 'var(--warning-color)', fontWeight: '600' }}>
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              {isOnline ? 'Online' : `Offline (${pendingCount} pendientes)`}
            </span>
          </div>
        </div>
      </div>

      {/* Expiry Alert Banner */}
      {alertas.length > 0 && (
        <div className="animate-slide-up" style={{ padding: '1rem 1.25rem', background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: '700', color: 'var(--warning-color)' }}>
              {alertas.length} lote{alertas.length > 1 ? 's' : ''} próximo{alertas.length > 1 ? 's' : ''} a vencer (menos de 30 días)
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {alertas.slice(0, 3).map(a => `${a.producto_nombre} (${a.dias_restantes}d)`).join(' · ')}
              {alertas.length > 3 && ` · y ${alertas.length - 3} más`}
            </div>
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 100%', minWidth: '200px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input className="input-field" style={{ paddingLeft: '2.75rem', marginBottom: 0, width: '100%' }}
              placeholder="Buscar medicamentos..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)} aria-label="Buscar medicamentos" />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <Button variant={showFilters ? 'primary' : 'outline'} onClick={() => setShowFilters(!showFilters)} style={{ flex: 1 }}>
              <Filter size={16} />
              Filtros
              {activeFilters > 0 && (
                <span style={{ background: 'white', color: 'var(--primary-color)', borderRadius: '9999px', padding: '0 6px', fontSize: '0.75rem', fontWeight: '700' }}>{activeFilters}</span>
              )}
            </Button>
            {(activeFilters > 0 || searchTerm) && (
              <Button variant="ghost" onClick={() => { setFiltroCategoria(''); setFiltroEstado(''); setSearchTerm(''); }} style={{ color: 'var(--danger-color)', flex: 0.4 }}>
                <X size={16} />
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ flex: '1 1 100%', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Categoría</label>
              <select className="input-field" style={{ marginBottom: 0, cursor: 'pointer', width: '100%' }}
                value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categoriasEnResultados.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 100%', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Estado de Stock</label>
              <select className="input-field" style={{ marginBottom: 0, cursor: 'pointer', width: '100%' }}
                value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="normal">✅ En Stock</option>
                <option value="critico">⚠️ Crítico (&lt;10)</option>
                <option value="agotado">🚨 Agotado</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total', count: medicinas.length, color: 'var(--primary-color)', bg: 'var(--primary-light)', f: '' },
          { label: 'En Stock', count: medicinas.filter(m => m.stock_actual >= 10).length, color: 'var(--success-color)', bg: 'var(--success-bg)', f: 'normal' },
          { label: 'Crítico', count: medicinas.filter(m => m.stock_actual > 0 && m.stock_actual < 10).length, color: 'var(--warning-color)', bg: 'var(--warning-bg)', f: 'critico' },
          { label: 'Agotado', count: medicinas.filter(m => m.stock_actual === 0).length, color: 'var(--danger-color)', bg: 'var(--danger-bg)', f: 'agotado' },
        ].map(s => (
          <button key={s.label} onClick={() => setFiltroEstado(s.f)}
            style={{ background: s.bg, border: `1px solid ${s.color}33`, borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', cursor: 'pointer', textAlign: 'center', transition: 'all var(--transition-fast)' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: s.color }}>{s.count}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: '600', color: s.color, opacity: 0.8 }}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-container animate-slide-up stagger-2">
        <table className="data-table">
          <thead>
            <tr>
              <th>N. Genérico</th>
              <th>N. Comercial</th>
              <th>Tipo</th>
              <th>Categoría</th>
              <th>Presentación</th>
              <th style={{ textAlign: 'center' }}>Cantidad</th>
              <th style={{ textAlign: 'center' }}>Caducidad</th>
              <th style={{ textAlign: 'center' }}>Estado</th>
              <th style={{ textAlign: 'center' }}>Ver Lotes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>Cargando inventario...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '3rem' }}>
                  <Package size={40} style={{ margin: '0 auto 0.75rem', color: 'var(--text-tertiary)', display: 'block' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>No se encontraron resultados.</span>
                </td>
              </tr>
            ) : (
              filtered.map(med => {
                const esMedico = esProductoMedico(med);
                return (
                  <tr key={med.id}>
                    <td>
                      {/* N. Genérico: campo separado si existe, si no parsear nombre */}
                      <div style={{ fontWeight: '600' }}>
                        {(() => {
                          if (med.nombre_generico) return med.nombre_generico;
                          if (med.nombre) {
                            const m = med.nombre.match(/^([^(]+?)\s*\(([^)]+)\)\s*$/);
                            return m ? m[1].trim() : med.nombre.trim();
                          }
                          return '—';
                        })()}
                      </div>
                      {med.concentracion && <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>{med.concentracion}</div>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {/* N. Comercial: campo separado si existe, si no parsear nombre */}
                      {(() => {
                        if (!esMedico) return <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>N/A</span>;
                        if (med.nombre_comercial) return med.nombre_comercial;
                        if (med.nombre) {
                          const m = med.nombre.match(/^([^(]+?)\s*\(([^)]+)\)\s*$/);
                          return m ? m[2].trim() : <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
                        }
                        return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
                      })()}
                    </td>
                    <td>
                      <span style={{
                        background: esMedico ? 'var(--primary-light)' : '#f5f3ff',
                        color: esMedico ? 'var(--primary-hover)' : '#6d28d9',
                        padding: '0.2rem 0.65rem',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        border: `1px solid ${esMedico ? 'rgba(16,185,129,0.1)' : 'rgba(124,58,237,0.1)'}`
                      }}>
                        {esMedico ? 'Médico' : 'General'}
                      </span>
                    </td>
                    <td>
                      <span style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-pill)', fontSize: '0.8rem', fontWeight: '600' }}>
                        {med.categorias?.nombre || '-'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{med.presentacion || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontWeight: '700', fontSize: '1.1rem', color: getStockBarColor(med.stock_actual) }}>{med.stock_actual}</span>
                        <div style={{ width: '60px', height: '5px', backgroundColor: 'var(--border-color)', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, (med.stock_actual / 200) * 100)}%`, height: '100%', backgroundColor: getStockBarColor(med.stock_actual), borderRadius: '9999px' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {(() => {
                        if (!esMedico) return <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>N/A</span>;
                        const fechaCad = getFechaCaducidad(med.lotes);
                        if (!fechaCad) return <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>—</span>;
                        const { texto, dias } = formatCaducidad(fechaCad);
                        const color = dias <= 30 ? 'var(--danger-color)' : dias <= 90 ? 'var(--warning-color)' : 'var(--text-secondary)';
                        return (
                          <span style={{ fontSize: '0.8rem', fontWeight: '600', color }}>
                            {texto}
                            {dias <= 30 && <span style={{ display: 'block', fontSize: '0.7rem', opacity: 0.85 }}>{dias}d restantes</span>}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ textAlign: 'center' }}>{getStockBadge(med.stock_actual)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <Button variant="ghost" onClick={() => navigate(`/lotes/${med.id}`)}
                        style={{ minWidth: '44px', minHeight: '44px', gap: '0.25rem' }}
                        aria-label={`Ver lotes de ${med.nombre}`}>
                        Ver <ChevronRight size={14} />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
