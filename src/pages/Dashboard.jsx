import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Package, TrendingUp, AlertTriangle, Users, HandHeart, ShoppingBag, Calendar, ClipboardList, ListChecks } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { contarPendientes } from '../lib/tareas';
import { Badge } from '../components/ui/Badge';
import { filtrarAlertasMedicas, CATEGORIAS_GENERALES } from '../utils/itemUtils';
import { estanciaPendiente } from '../utils/estancia';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n/useI18n';
import './pages.css';

export const Dashboard = () => {
  const { user, role, profile, isSuperAdmin, isCoordinador, isBrigadista, isVoluntario } = useAuth();
  const navigate = useNavigate();
  const { t, tn, formatearFecha } = useI18n();
  const [voluntariosRegistrados, setVoluntariosRegistrados] = useState(0);
  const [bitacorasPendientes, setBitacorasPendientes] = useState(null); // null = módulo no disponible
  const [tareasPendientes, setTareasPendientes] = useState(null); // tareas del voluntario; null = módulo no disponible
  const [stats, setStats] = useState({ medicamentos: 0, donacionesMes: 0, donativosMes: 0, critico: 0, beneficiariosMes: 0, donantesActivos: 0, itemsGenerales: 0 });
  const [alertas, setAlertas] = useState([]);
  const [ultimasDonaciones, setUltimasDonaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchData(); }, []);

  // KPI de quienes revisan bitácoras (super_admin y coordinadores): jornadas por aprobar.
  const puedeRevisar = isSuperAdmin || isCoordinador;
  useEffect(() => {
    if (!puedeRevisar || !supabase) return;
    supabase.from('bitacoras').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')
      .then(({ count, error: err }) => {
        // 42P01 / PGRST205: aún no existe la tabla; el KPI simplemente no se muestra.
        if (err) {
          if (err.code !== '42P01' && err.code !== 'PGRST205') console.error('No se pudo contar las bitácoras:', err.message);
        } else {
          setBitacorasPendientes(count || 0);
        }
      });
  }, [puedeRevisar]);

  // Aviso del voluntario: tareas que la coordinación le asignó y siguen pendientes.
  const perfilId = user?.id;
  useEffect(() => {
    if (!isVoluntario || !perfilId) return;
    let cancelado = false;
    contarPendientes(perfilId).then(n => { if (!cancelado) setTareasPendientes(n); });
    return () => { cancelado = true; };
  }, [isVoluntario, perfilId]);

  // KPI propio del coordinador de voluntariado.
  useEffect(() => {
    if (!isCoordinador || !supabase) return;
    supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('rol', 'voluntario')
      .then(({ count, error: err }) => {
        if (err) console.error('No se pudo contar los voluntarios:', err.message);
        else setVoluntariosRegistrados(count || 0);
      });
  }, [isCoordinador]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (!supabase) throw new Error('Sin conexión a la base de datos');

      const startOfMonth = new Date();
      startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

      const [medRes, critRes, movRes, benRes, donRes, alertaRes, ultRes, catGenRes] = await Promise.all([
        supabase.from('medicinas').select('*, categorias(nombre)', { count: 'exact', head: false }),
        supabase.from('medicinas').select('id, nombre, stock_actual').lt('stock_actual', 10),
        supabase.from('movimientos').select('tipo, beneficiario_id').gte('timestamp', startOfMonth.toISOString()),
        supabase.from('beneficiarios').select('*', { count: 'exact', head: true }).eq('estado', 'Activo'),
        supabase.from('donantes').select('*', { count: 'exact', head: true }).eq('estado', 'Activo'),
        supabase.from('alertas_vencimiento').select('*').limit(5),
        supabase.from('movimientos').select('*, medicinas(nombre), beneficiarios(nombre_completo)').eq('tipo', 'Salida').order('timestamp', { ascending: false }).limit(5),
        supabase.from('categorias').select('id').in('nombre', CATEGORIAS_GENERALES)
      ]);

      const movData = movRes.data || [];
      const benIds = new Set(movData.filter(m => m.beneficiario_id).map(m => m.beneficiario_id));

      // Contar medicinas médicas vs generales
      const catGenIds = new Set((catGenRes.data || []).map(c => c.id));
      const todasMedicinas = medRes.data || [];
      const itemsGeneralesCount = todasMedicinas.filter(m => catGenIds.has(m.categoria_id)).length;
      const medicamentosCount = todasMedicinas.length - itemsGeneralesCount;

      // Filtrar alertas: excluir ítems generales (fecha 2099) para evitar falsos positivos
      const alertasFiltradas = filtrarAlertasMedicas(alertaRes.data || []);

      setStats({
        medicamentos: medicamentosCount,
        donacionesMes: movData.filter(m => m.tipo === 'Salida').length,
        donativosMes: movData.filter(m => m.tipo === 'Entrada').length,
        critico: (critRes.data || []).filter(m => {
          return true; // El filtro real se haría join con categoría, simplificado aquí
        }).length,
        beneficiariosMes: benIds.size,
        donantesActivos: donRes.count || 0,
        itemsGenerales: itemsGeneralesCount,
      });
      setAlertas(alertasFiltradas);
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

  const allKpis = [
    { title: 'Banco de Medicamentos', value: stats.medicamentos, subtitle: 'Tipos médicos en catálogo', icon: <Package size={24} />, color: 'var(--primary-color)', bg: 'var(--primary-light)', roles: ['super_admin', 'brigadista'] },
    { title: 'Medicamentos Urgentes', value: stats.critico, subtitle: 'Por debajo del mínimo', icon: <AlertTriangle size={24} />, color: 'var(--danger-color)', bg: 'var(--danger-bg)', alert: stats.critico > 0, roles: ['super_admin', 'brigadista'] },
    { title: t('dashboard.kpi_donativos'), value: stats.donativosMes, subtitle: t('dashboard.kpi_donativos_sub'), icon: <TrendingUp size={24} />, color: '#0ea5e9', bg: '#f0f9ff', roles: ['super_admin', 'brigadista', 'voluntario'] },
    { title: t('dashboard.kpi_familias'), value: stats.beneficiariosMes, subtitle: t('dashboard.kpi_familias_sub'), icon: <Heart size={24} />, color: '#ec4899', bg: '#fdf2f8', roles: ['super_admin', 'voluntario'] },
    { title: t('dashboard.kpi_entregadas'), value: stats.donacionesMes, subtitle: t('dashboard.kpi_entregadas_sub'), icon: <HandHeart size={24} />, color: 'var(--success-color)', bg: 'var(--success-bg)', roles: ['super_admin', 'voluntario'] },
    { title: t('dashboard.kpi_donantes'), value: stats.donantesActivos, subtitle: t('dashboard.kpi_donantes_sub'), icon: <Users size={24} />, color: '#f59e0b', bg: '#fffbeb', roles: ['super_admin', 'voluntario'] },
    { title: t('dashboard.kpi_items'), value: stats.itemsGenerales, subtitle: t('dashboard.kpi_items_sub'), icon: <ShoppingBag size={24} />, color: '#7c3aed', bg: '#f5f3ff', roles: ['super_admin', 'voluntario'] },
    { title: 'Voluntarios Registrados', value: voluntariosRegistrados, subtitle: 'Cuentas con rol de voluntario', icon: <Users size={24} />, color: '#d97706', bg: 'var(--warning-bg)', soloCoordinador: true },
    { title: 'Bitácoras por Revisar', value: bitacorasPendientes, subtitle: 'Jornadas pendientes de aprobación', icon: <ClipboardList size={24} />, color: '#d97706', bg: 'var(--warning-bg)', revisor: true },
  ];

  // Filtrar KPIs de acuerdo al rol del usuario. `soloCoordinador` depende del rol
  // adicional, no del principal; `revisor` es para super_admin o coordinador y solo
  // aparece cuando el módulo de bitácoras responde.
  const visibleKpis = allKpis.filter(kpi => {
    if (kpi.soloCoordinador) return isCoordinador;
    if (kpi.revisor) return puedeRevisar && kpi.value !== null;
    return kpi.roles.includes(role);
  });

  return (
    <div className="animate-blur-in">
      <div className="page-header animate-reveal">
        <div>
          <h1 className="page-title">{t('dashboard.titulo')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {t('dashboard.subtitulo')}
          </p>
        </div>
      </div>

      {/* El voluntario debe indicar cuánto tiempo permanecerá en la Fundación */}
      {isVoluntario && estanciaPendiente(profile) && (
        <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', backgroundColor: 'var(--warning-bg)', color: 'var(--warning-color)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.875rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} style={{ flexShrink: 0 }} />
            <span><strong>{t('dashboard.falta_dato')}</strong> {t('dashboard.falta_estancia')}</span>
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/perfil', { state: { tab: 'editar' } })}
          >
            {t('dashboard.completar')}
          </button>
        </div>
      )}

      {/* Tareas asignadas por la coordinación que siguen pendientes */}
      {isVoluntario && tareasPendientes > 0 && (
        <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', backgroundColor: 'var(--warning-bg)', color: 'var(--warning-color)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.875rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ListChecks size={18} style={{ flexShrink: 0 }} />
            <strong>{tn('dashboard.tareas_pendientes', tareasPendientes)}</strong>
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/perfil', { state: { tab: 'actividades' } })}
          >
            {t('dashboard.ver_tareas')}
          </button>
        </div>
      )}

      {/* Acceso rápido del voluntario al cierre de jornada */}
      {isVoluntario && (
        <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', backgroundColor: '#f5f3ff', color: '#6d28d9', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid rgba(124,58,237,0.2)', fontSize: '0.875rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={18} style={{ flexShrink: 0 }} />
            <span><strong>{t('dashboard.terminaste')}</strong> {t('dashboard.cuentanos')}</span>
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/perfil', { state: { tab: 'actividades' } })}
          >
            {t('actividades.cerrar_jornada')}
          </button>
        </div>
      )}

      {error && (
        <div className="animate-fade-in stagger-1" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-color)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.875rem' }}>
          ⚠️ <strong>Aviso:</strong> {error}. Mostrando datos de demostración.
        </div>
      )}

      {/* KPI Grid - Filtrado Dinámicamente */}
      <div className="kpi-grid">
        {visibleKpis.map((kpi, i) => (
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

      {/* Vista de Paneles en cuadrícula o flexibles de acuerdo al rol */}
      <div className="dashboard-panels-container grid-responsive" style={{ 
        marginTop: '1.5rem', 
        display: (isSuperAdmin) ? 'grid' : 'flex', 
        flexDirection: 'column' 
      }}>
        
        {/* Últimas Donaciones - Ocultar para Brigadista puro para enfocar en la medicina */}
        {(isSuperAdmin || isVoluntario) && (
          <div className="card animate-blur-in stagger-3" style={{ width: '100%' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Heart size={18} color="var(--success-color)" /> {t('dashboard.ultimas')}
            </h2>
            {ultimasDonaciones.length === 0 ? (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>{t('dashboard.sin_donaciones')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {ultimasDonaciones.map((d, i) => (
                  <div key={d.id} className={`animate-fade-in stagger-${Math.min(i + 1, 3)}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ minWidth: 0, flex: 1, marginRight: '0.5rem' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.medicinas?.nombre}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.beneficiarios?.nombre_completo || d.origen_destino || t('dashboard.beneficiario_no_registrado')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: '700', color: 'var(--success-color)', fontSize: '0.9rem' }}>{d.cantidad} {t('dashboard.unidades')}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{formatearFecha(d.timestamp, { day: '2-digit', month: '2-digit' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Alertas de Vencimiento - Ocultar para Voluntario puro para que no se enfoquen en la farmacia interna */}
        {(isSuperAdmin || isBrigadista) && (
          <div className="card animate-blur-in stagger-4" style={{ width: '100%' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} color="var(--warning-color)" /> Control de Vencimientos
            </h2>
            {alertas.length === 0 ? (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>✅ No hay lotes próximos a vencer en este momento.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {alertas.map((a, i) => (
                  <div key={a.id} className={`animate-fade-in stagger-${Math.min(i + 1, 3)}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div style={{ minWidth: 0, flex: 1, marginRight: '0.5rem' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.producto_nombre}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{a.cantidad_actual} unidades</div>
                    </div>
                    <Badge variant={a.dias_restantes <= 15 ? 'danger' : 'warning'}>
                      {a.dias_restantes}d restantes
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

