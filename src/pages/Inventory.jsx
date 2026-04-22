import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Camera, X, ChevronRight, Package, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoteForm } from '../components/inventory/LoteForm';
import { SalidaFEFO } from '../components/inventory/SalidaFEFO';
import { QRScanner } from '../components/inventory/QRScanner';
import { useOfflineCache } from '../hooks/useOfflineCache';
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
  const [showLoteForm, setShowLoteForm] = useState(false);
  const [showSalida, setShowSalida] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const { isOnline, pendingCount, fetchMedicinas: fetchOffline } = useOfflineCache();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!supabase) throw new Error('Sin conexión');
      const [medRes, catRes, alertRes] = await Promise.all([
        supabase.from('medicinas').select('*, categorias(nombre)').order('nombre'),
        supabase.from('categorias').select('*').order('nombre'),
        supabase.from('alertas_vencimiento').select('*').limit(10)
      ]);
      if (medRes.error) throw medRes.error;
      setMedicinas(medRes.data || []);
      setCategorias(catRes.data || []);
      setAlertas(alertRes.data || []);
    } catch {
      const cached = await fetchOffline();
      setMedicinas(cached);
      setMedicinas([
        { id: '1', nombre: 'Paracetamol', concentracion: '500mg', presentacion: 'Tabletas', stock_actual: 150, categorias: { nombre: 'Analgésicos' } },
        { id: '2', nombre: 'Amoxicilina', concentracion: '500mg', presentacion: 'Cápsulas', stock_actual: 0, categorias: { nombre: 'Antibióticos' } },
        { id: '3', nombre: 'Ibuprofeno', concentracion: '400mg', presentacion: 'Tabletas', stock_actual: 8, categorias: { nombre: 'Analgésicos' } },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (s) => s === 0 ? 'agotado' : s < 10 ? 'critico' : 'normal';
  const getStockBadge = (s) => {
    if (s === 0) return <Badge variant="danger">Agotado</Badge>;
    if (s < 10) return <Badge variant="warning">Crítico</Badge>;
    return <Badge variant="success">En Stock</Badge>;
  };
  const getStockBarColor = (s) =>
    s === 0 ? 'var(--danger-color)' : s < 10 ? 'var(--warning-color)' : 'var(--success-color)';

  const filtered = medicinas.filter(m => {
    const q = searchTerm.toLowerCase();
    const matchQ = m.nombre.toLowerCase().includes(q) ||
      (m.categorias?.nombre || '').toLowerCase().includes(q) ||
      (m.concentracion || '').toLowerCase().includes(q);
    const matchCat = !filtroCategoria || m.categorias?.nombre === filtroCategoria;
    const matchEst = !filtroEstado || getStockStatus(m.stock_actual) === filtroEstado;
    return matchQ && matchCat && matchEst;
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
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button variant="outline" onClick={() => setShowQR(true)} style={{ minWidth: '44px', minHeight: '44px' }} aria-label="Escanear código">
            <Camera size={18} /> Escanear
          </Button>
          <Button variant="outline" onClick={() => setShowSalida(true)}>
            ⚡ Entregar Donación
          </Button>
          <Button variant="primary" onClick={() => setShowLoteForm(true)}>
            <Plus size={18} /> Registrar Ingreso
          </Button>
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
                {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
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
              <th>Medicamento</th>
              <th>Categoría</th>
              <th>Presentación</th>
              <th style={{ textAlign: 'center' }}>Cantidad</th>
              <th style={{ textAlign: 'center' }}>Estado</th>
              <th style={{ textAlign: 'center' }}>Ver Lotes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>Cargando inventario...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>
                  <Package size={40} style={{ margin: '0 auto 0.75rem', color: 'var(--text-tertiary)', display: 'block' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>No se encontraron resultados.</span>
                </td>
              </tr>
            ) : (
              filtered.map(med => (
                <tr key={med.id}>
                  <td>
                    <div style={{ fontWeight: '600' }}>{med.nombre}</div>
                    {med.concentracion && <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>{med.concentracion}</div>}
                  </td>
                  <td>
                    <span style={{ background: 'var(--primary-light)', color: 'var(--primary-hover)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-pill)', fontSize: '0.8rem', fontWeight: '600' }}>
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
                  <td style={{ textAlign: 'center' }}>{getStockBadge(med.stock_actual)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <Button variant="ghost" onClick={() => navigate(`/lotes/${med.id}`)}
                      style={{ minWidth: '44px', minHeight: '44px', gap: '0.25rem' }}
                      aria-label={`Ver lotes de ${med.nombre}`}>
                      Ver <ChevronRight size={14} />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <LoteForm isOpen={showLoteForm} onClose={() => setShowLoteForm(false)} onSuccess={() => { setShowLoteForm(false); fetchData(); }} />
      <SalidaFEFO isOpen={showSalida} onClose={() => setShowSalida(false)} onSuccess={() => { setShowSalida(false); fetchData(); }} />
      {showQR && (
        <div className="modal-overlay" onClick={() => setShowQR(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>📷 Escanear Código</h2>
              <button className="modal-close" onClick={() => setShowQR(false)} type="button"><X size={20} /></button>
            </div>
            <QRScanner onScan={(code) => { console.log('Scanned:', code); setShowQR(false); }} onClose={() => setShowQR(false)} />
          </div>
        </div>
      )}
    </div>
  );
};
