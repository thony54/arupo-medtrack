import React, { useState, useEffect } from 'react';
import { Heart, Package, TrendingUp, AlertTriangle, Users, HandHeart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Badge } from '../components/ui/Badge';
import './pages.css';

export const Dashboard = () => {
  const [stats, setStats] = useState({ medicamentos: 0, donacionesMes: 0, donativosMes: 0, critico: 0, beneficiariosMes: 0, donantesActivos: 0 });
  const [alertas, setAlertas] = useState([]);
  const [ultimasDonaciones, setUltimasDonaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (!supabase) throw new Error('Sin conexión a la base de datos');

      const startOfMonth = new Date();
      startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

      const [medRes, critRes, movRes, benRes, donRes, alertaRes, ultRes] = await Promise.all([
        supabase.from('medicinas').select('*', { count: 'exact', head: true }),
        supabase.from('medicinas').select('id, nombre, stock_actual').lt('stock_actual', 10),
        supabase.from('movimientos').select('tipo, beneficiario_id').gte('timestamp', startOfMonth.toISOString()),
        supabase.from('beneficiarios').select('*', { count: 'exact', head: true }).eq('estado', 'Activo'),
        supabase.from('donantes').select('*', { count: 'exact', head: true }).eq('estado', 'Activo'),
        supabase.from('alertas_vencimiento').select('*').limit(5),
        supabase.from('movimientos').select('*, medicinas(nombre), beneficiarios(nombre_completo)').eq('tipo', 'Salida').order('timestamp', { ascending: false }).limit(5)
      ]);

      const movData = movRes.data || [];
      const benIds = new Set(movData.filter(m => m.beneficiario_id).map(m => m.beneficiario_id));

      setStats({
        medicamentos: medRes.count || 0,
        donacionesMes: movData.filter(m => m.tipo === 'Salida').length,
        donativosMes: movData.filter(m => m.tipo === 'Entrada').length,
        critico: critRes.data?.length || 0,
        beneficiariosMes: benIds.size,
        donantesActivos: donRes.count || 0,
      });
      setAlertas(alertaRes.data || []);
      setUltimasDonaciones(ultRes.data || []);
    } catch (err) {
      setError(err.message);
      setStats({ medicamentos: 124, donacionesMes: 38, donativosMes: 12, critico: 4, beneficiariosMes: 31, donantesActivos: 8 });
      setAlertas([
        { id: 1, producto_nombre: 'Paracetamol 500mg', dias_restantes: 12, cantidad_actual: 200 },
        { id: 2, producto_nombre: 'Amoxicilina 500mg', dias_restantes: 25, cantidad_actual: 50 },
      ]);
      setUltimasDonaciones([]);
    } finally { setLoading(false); }
  };

  const kpis = [
    { title: 'Banco de Medicamentos', value: stats.medicamentos, subtitle: 'Tipos en catálogo', icon: <Package size={24} />, color: 'var(--primary-color)', bg: 'var(--primary-light)' },
    { title: 'Familias Beneficiadas', value: stats.beneficiariosMes, subtitle: 'Este mes', icon: <Heart size={24} />, color: '#ec4899', bg: '#fdf2f8' },
    { title: 'Donaciones Entregadas', value: stats.donacionesMes, subtitle: 'Despachos este mes', icon: <HandHeart size={24} />, color: 'var(--success-color)', bg: 'var(--success-bg)' },
    { title: 'Donativos Recibidos', value: stats.donativosMes, subtitle: 'Lotes ingresados este mes', icon: <TrendingUp size={24} />, color: '#8b5cf6', bg: '#f5f3ff' },
    { title: 'Donantes Activos', value: stats.donantesActivos, subtitle: 'Organizaciones aliadas', icon: <Users size={24} />, color: '#0ea5e9', bg: '#f0f9ff' },
    { title: 'Medicamentos Urgentes', value: stats.critico, subtitle: 'Por debajo del mínimo', icon: <AlertTriangle size={24} />, color: 'var(--danger-color)', bg: 'var(--danger-bg)', alert: stats.critico > 0 },
  ];

  return (
    <div className="animate-blur-in">
      <div className="page-header animate-reveal">
        <div>
          <h1 className="page-title">Centro de Operaciones</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Programa de Donaciones Médicas — Fundación Arupo
          </p>
        </div>
      </div>

      {error && (
        <div className="animate-fade-in stagger-1" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-color)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.875rem' }}>
          ⚠️ <strong>Aviso:</strong> {error}. Mostrando datos de demostración.
        </div>
      )}

      {/* KPI Grid */}
      <div className="kpi-grid">
        {kpis.map((kpi, i) => (
          <div key={kpi.title} className={`card kpi-card animate-reveal stagger-${Math.min(i + 1, 5)}`}
            style={kpi.alert ? { border: '1px solid var(--danger-color)' } : {}}>
            <div className="kpi-header">
              <h3 className="kpi-title" style={{ fontSize: '0.85rem' }}>{kpi.title}</h3>
              <div className="kpi-icon" style={{ backgroundColor: kpi.bg, color: kpi.color }}>
                {kpi.icon}
              </div>
            </div>
            <div className="kpi-value" style={{ color: kpi.alert ? 'var(--danger-color)' : kpi.color }}>
              {loading ? '...' : kpi.value}
            </div>
            <p className="kpi-subtitle" style={{ fontSize: '0.75rem' }}>{kpi.subtitle}</p>
          </div>
        ))}
      </div>

      <div className="grid-responsive" style={{ marginTop: '1.5rem' }}>
        {/* Últimas Donaciones */}
        <div className="card animate-blur-in stagger-3">
          <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Heart size={18} color="var(--success-color)" /> Últimas Donaciones
          </h2>
          {ultimasDonaciones.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No hay donaciones registradas aún.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {ultimasDonaciones.map((d, i) => (
                <div key={d.id} className={`animate-fade-in stagger-${Math.min(i + 1, 3)}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ minWidth: 0, flex: 1, marginRight: '0.5rem' }}>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.medicinas?.nombre}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.beneficiarios?.nombre_completo || d.origen_destino || 'Beneficiario no registrado'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: '700', color: 'var(--success-color)', fontSize: '0.9rem' }}>{d.cantidad} u.</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{new Date(d.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertas de Vencimiento */}
        <div className="card animate-blur-in stagger-4">
          <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} color="var(--warning-color)" /> Lotes por Vencer
          </h2>
          {alertas.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>✅ No hay lotes próximos a vencer.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {alertas.map((a, i) => (
                <div key={a.id} className={`animate-fade-in stagger-${Math.min(i + 1, 3)}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div style={{ minWidth: 0, flex: 1, marginRight: '0.5rem' }}>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.producto_nombre}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{a.cantidad_actual} unidades</div>
                  </div>
                  <Badge variant={a.dias_restantes <= 15 ? 'danger' : 'warning'}>
                    {a.dias_restantes}d
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
