import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Search, FileText, Download, Calendar, User, Activity, Plus } from 'lucide-react';
import { generateSaludPDF } from '../components/salud/SaludPDF';
import { SaludStepper } from '../components/salud/SaludStepper';
import './pages.css';

export const Evaluaciones = () => {
  const { isSuperAdmin, isBrigadista, profile } = useAuth();
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchEvaluaciones();
    window.addEventListener('evaluaciones-updated', fetchEvaluaciones);
    return () => window.removeEventListener('evaluaciones-updated', fetchEvaluaciones);
  }, []);

  const fetchEvaluaciones = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('evaluaciones_salud')
        .select('*, perfiles(nombre)')
        .order('fecha', { ascending: false })
        .order('hora_atencion', { ascending: false });

      if (!isSuperAdmin) {
        query = query.eq('brigadista_id', profile?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEvaluaciones(data || []);
    } catch (err) {
      console.error('Error fetching evaluations:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = evaluaciones.filter(e => 
    (e.paciente_nombre || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.paciente_ci || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.lugar_atencion || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Evaluaciones de Salud</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {isSuperAdmin ? 'Historial completo de evaluaciones realizadas por el personal.' : 'Mis evaluaciones realizadas en campo.'}
          </p>
        </div>
        {(isSuperAdmin || isBrigadista) && (
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Nueva Evaluación
          </Button>
        )}
      </div>

      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          <input
            className="input-field"
            style={{ paddingLeft: '2.75rem', marginBottom: 0, width: '100%' }}
            placeholder="Buscar por nombre de paciente, CI o lugar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha / Hora</th>
              <th>Paciente</th>
              <th>Lugar</th>
              <th style={{ textAlign: 'center' }}>IMC</th>
              <th style={{ textAlign: 'center' }}>Glucosa</th>
              <th style={{ textAlign: 'center' }}>Presión</th>
              {isSuperAdmin && <th>Brigadista</th>}
              <th style={{ width: '100px', textAlign: 'center' }}>Reporte</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isSuperAdmin ? 8 : 7} style={{ textAlign: 'center', padding: '2rem' }}>Cargando evaluaciones...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={isSuperAdmin ? 8 : 7} style={{ textAlign: 'center', padding: '3rem' }}>
                  <Activity size={40} style={{ display: 'block', margin: '0 auto 0.75rem', color: 'var(--text-tertiary)', opacity: 0.5 }} />
                  <span style={{ color: 'var(--text-secondary)' }}>No se encontraron evaluaciones registradas.</span>
                </td>
              </tr>
            ) : filtered.map(e => (
              <tr key={e.id}>
                <td>
                  <div style={{ fontWeight: '600' }}>{e.fecha}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{e.hora_atencion}</div>
                </td>
                <td>
                  <div style={{ fontWeight: '700', color: 'var(--primary-color)' }}>{e.paciente_nombre}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CI: {e.paciente_ci}</div>
                </td>
                <td style={{ fontSize: '0.85rem' }}>{e.lugar_atencion}</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ 
                    padding: '2px 8px', 
                    borderRadius: 'var(--radius-pill)', 
                    background: e.imc >= 18.5 && e.imc < 25 ? 'var(--success-bg)' : 'var(--warning-bg)',
                    color: e.imc >= 18.5 && e.imc < 25 ? 'var(--success-color)' : 'var(--warning-color)',
                    fontWeight: '700',
                    fontSize: '0.85rem'
                  }}>
                    {e.imc}
                  </span>
                </td>
                <td style={{ textAlign: 'center', fontWeight: '600' }}>{e.glucosa} <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>mg/dL</span></td>
                <td style={{ textAlign: 'center', fontWeight: '600' }}>{e.presion_sistolica}/{e.presion_diastolica} <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>mmHg</span></td>
                {isSuperAdmin && (
                  <td style={{ fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <User size={14} /> {e.perfiles?.nombre || '—'}
                    </div>
                  </td>
                )}
                <td style={{ textAlign: 'center' }}>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => generateSaludPDF(e)}
                    style={{ color: 'var(--primary-color)', padding: '0.4rem' }}
                    title="Descargar PDF"
                  >
                    <Download size={18} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SaludStepper 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchEvaluaciones} 
      />
    </div>
  );
};
