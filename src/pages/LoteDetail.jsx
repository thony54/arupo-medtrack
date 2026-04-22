import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { MermaForm } from '../components/inventory/MermaForm';
import './pages.css';

const getDiasRestantes = (fechaVenc) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVenc);
  return Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
};

const getLoteBadge = (dias, estado) => {
  if (estado === 'Vencido') return <Badge variant="danger">Vencido</Badge>;
  if (estado === 'Reservado') return <Badge variant="warning">Reservado</Badge>;
  if (dias <= 0) return <Badge variant="danger">Vencido</Badge>;
  if (dias <= 15) return <Badge variant="danger">Crítico</Badge>;
  if (dias <= 30) return <Badge variant="warning">Por vencer</Badge>;
  return <Badge variant="success">OK</Badge>;
};

export const LoteDetail = () => {
  const { productoId } = useParams();
  const navigate = useNavigate();
  const [lotes, setLotes] = useState([]);
  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mermaLote, setMermaLote] = useState(null);

  useEffect(() => {
    if (productoId) fetchData();
  }, [productoId]);

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [prodRes, lotesRes] = await Promise.all([
        supabase.from('medicinas').select('*, categorias(nombre)').eq('id', productoId).single(),
        supabase.from('lotes').select('*, medicinas(nombre)')
          .eq('producto_id', productoId)
          .order('fecha_vencimiento', { ascending: true })
      ]);
      setProducto(prodRes.data);
      setLotes(lotesRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalStock = lotes.filter(l => l.estado !== 'Vencido').reduce((acc, l) => acc + l.cantidad_actual, 0);
  const lotesActivos = lotes.filter(l => l.estado === 'Disponible');
  const lotesCriticos = lotes.filter(l => {
    const dias = getDiasRestantes(l.fecha_vencimiento);
    return l.estado !== 'Vencido' && dias <= 30;
  });

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/inventory')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'var(--font-family)', padding: 0, marginBottom: '1rem' }}
        >
          <ArrowLeft size={18} /> Volver al Inventario
        </button>

        <div className="page-header">
          <div>
            <h1 className="page-title">{producto?.nombre || 'Cargando...'}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              {producto?.concentracion} · {producto?.categorias?.nombre} · {producto?.presentacion}
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card kpi-card" style={{ padding: '1.25rem' }}>
          <div className="kpi-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary-color)', marginBottom: '0.75rem' }}><Package size={20} /></div>
          <div className="kpi-value">{totalStock}</div>
          <p className="kpi-subtitle">Stock Total</p>
        </div>
        <div className="card kpi-card" style={{ padding: '1.25rem' }}>
          <div className="kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success-color)', marginBottom: '0.75rem' }}><Package size={20} /></div>
          <div className="kpi-value">{lotesActivos.length}</div>
          <p className="kpi-subtitle">Lotes Activos</p>
        </div>
        <div className="card kpi-card" style={{ padding: '1.25rem' }}>
          <div className="kpi-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning-color)', marginBottom: '0.75rem' }}><AlertTriangle size={20} /></div>
          <div className="kpi-value" style={{ color: lotesCriticos.length > 0 ? 'var(--warning-color)' : 'inherit' }}>{lotesCriticos.length}</div>
          <p className="kpi-subtitle">Por vencer (&lt;30d)</p>
        </div>
      </div>

      {/* Lotes table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', fontWeight: '700' }}>
          Desglose de Lotes
        </div>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>N° Lote</th>
                <th style={{ textAlign: 'center' }}>Cantidad</th>
                <th>Fecha Venc.</th>
                <th>Días Restantes</th>
                <th>Ubicación</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>Cargando lotes...</td></tr>
              ) : lotes.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Package size={36} style={{ display: 'block', margin: '0 auto 0.75rem', color: 'var(--text-tertiary)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>No hay lotes registrados para este producto.</span>
                  </td>
                </tr>
              ) : (
                lotes.map(lote => {
                  const dias = getDiasRestantes(lote.fecha_vencimiento);
                  return (
                    <tr key={lote.id}>
                      <td><strong>{lote.numero_lote || 'S/N'}</strong></td>
                      <td style={{ textAlign: 'center', fontWeight: '700', fontSize: '1.1rem' }}>{lote.cantidad_actual}</td>
                      <td>{new Date(lote.fecha_vencimiento).toLocaleDateString('es-ES')}</td>
                      <td>
                        <span style={{ fontWeight: '600', color: dias <= 0 ? 'var(--danger-color)' : dias <= 15 ? 'var(--danger-color)' : dias <= 30 ? 'var(--warning-color)' : 'var(--success-color)' }}>
                          {dias <= 0 ? 'Vencido' : `${dias} días`}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{lote.ubicacion_estante || '—'}</td>
                      <td>{getLoteBadge(dias, lote.estado)}</td>
                      <td>
                        <Button
                          variant="ghost"
                          onClick={() => setMermaLote({ ...lote, medicinas: producto })}
                          style={{ color: 'var(--danger-color)', minWidth: '44px', minHeight: '44px', padding: '0.5rem' }}
                          aria-label={`Ajuste de merma para lote ${lote.numero_lote || 'S/N'}`}
                          title="Ajuste de Merma"
                        >
                          <Trash2 size={16} />
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

      <MermaForm
        isOpen={!!mermaLote}
        lote={mermaLote}
        onClose={() => setMermaLote(null)}
        onSuccess={() => { setMermaLote(null); fetchData(); }}
      />
    </div>
  );
};
