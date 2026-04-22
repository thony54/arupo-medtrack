import React, { useState, useEffect } from 'react';
import { UserPlus, Users, Phone, MapPin, FileText, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import './pages.css';

const CONDICIONES = ['Diabetes', 'Hipertensión', 'Cardiopatía', 'Embarazo', 'Adulto Mayor', 'Pediatría', 'Oncología', 'VIH/SIDA', 'Otra'];

export const Beneficiarios = () => {
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // for history panel
  const [historial, setHistorial] = useState([]);

  // Form
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [condicion, setCondicion] = useState('');
  const [notas, setNotas] = useState('');

  useEffect(() => { fetchBeneficiarios(); }, []);

  const fetchBeneficiarios = async () => {
    setLoading(true);
    try {
      if (!supabase) throw new Error('Sin conexión');
      const { data, error: err } = await supabase
        .from('beneficiarios')
        .select('*, movimientos(count)')
        .order('nombre_completo');
      if (err) throw err;
      // Get donation count per beneficiary
      const { data: counts } = await supabase
        .from('movimientos')
        .select('beneficiario_id, count:id.count()')
        .eq('tipo', 'Salida')
        .not('beneficiario_id', 'is', null);

      const countMap = {};
      (counts || []).forEach(c => { countMap[c.beneficiario_id] = parseInt(c.count) || 0; });
      setBeneficiarios((data || []).map(b => ({ ...b, donaciones_count: countMap[b.id] || 0 })));
    } catch { setBeneficiarios([]); } finally { setLoading(false); }
  };

  const fetchHistorial = async (ben) => {
    setSelected(ben);
    if (!supabase) return;
    const { data } = await supabase
      .from('movimientos')
      .select('*, medicinas(nombre)')
      .eq('beneficiario_id', ben.id)
      .eq('tipo', 'Salida')
      .order('timestamp', { ascending: false })
      .limit(20);
    setHistorial(data || []);
  };

  const resetForm = () => {
    setNombre(''); setCedula(''); setTelefono('');
    setDireccion(''); setCondicion(''); setNotas(''); setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    try {
      setSaving(true);
      const { error: err } = await supabase.from('beneficiarios').insert({
        nombre_completo: nombre.trim(), cedula: cedula.trim() || null,
        telefono: telefono.trim() || null, direccion: direccion.trim() || null,
        condicion_medica: condicion || null, notas: notas.trim() || null
      });
      if (err) throw err;
      resetForm(); setIsModalOpen(false); fetchBeneficiarios();
    } catch (err) {
      setError(err.message || 'Error al guardar.');
    } finally { setSaving(false); }
  };

  const filtered = beneficiarios.filter(b =>
    b.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
    (b.cedula || '').toLowerCase().includes(search.toLowerCase()) ||
    (b.condicion_medica || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
      {/* Main Panel */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Beneficiarios</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              {filtered.length} persona{filtered.length !== 1 ? 's' : ''} registrada{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
            <UserPlus size={18} /> Añadir Beneficiario
          </Button>
        </div>

        {/* Search */}
        <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input className="input-field" style={{ paddingLeft: '2.75rem', marginBottom: 0, width: '100%' }}
              placeholder="Buscar por nombre, cédula o condición médica..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Beneficiario</th>
                <th>Cédula</th>
                <th>Condición Médica</th>
                <th>Teléfono</th>
                <th style={{ textAlign: 'center' }}>Donaciones</th>
                <th>Estado</th>
                <th>Historial</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Users size={40} style={{ display: 'block', margin: '0 auto 0.75rem', color: 'var(--text-tertiary)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>No hay beneficiarios registrados aún.</span>
                  </td>
                </tr>
              ) : filtered.map(b => (
                <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => fetchHistorial(b)}>
                  <td>
                    <div style={{ fontWeight: '600' }}>{b.nombre_completo}</div>
                    {b.direccion && <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{b.direccion}</div>}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{b.cedula || '—'}</td>
                  <td>
                    {b.condicion_medica
                      ? <span style={{ background: 'var(--primary-light)', color: 'var(--primary-hover)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-pill)', fontSize: '0.8rem', fontWeight: '600' }}>{b.condicion_medica}</span>
                      : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{b.telefono || '—'}</td>
                  <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--primary-color)' }}>{b.donaciones_count}</td>
                  <td><Badge variant={b.estado === 'Activo' ? 'success' : 'warning'}>{b.estado}</Badge></td>
                  <td>
                    <Button variant="ghost" onClick={e => { e.stopPropagation(); fetchHistorial(b); }}
                      style={{ fontSize: '0.8rem' }}>Ver →</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Side Panel */}
      {selected && (
        <div className="card animate-fade-in" style={{ width: '340px', flexShrink: 0, position: 'sticky', top: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '1rem' }}>{selected.nombre_completo}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Cédula: {selected.cedula || 'N/A'}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
          </div>

          {selected.condicion_medica && (
            <div style={{ padding: '0.5rem 0.75rem', background: 'var(--primary-light)', color: 'var(--primary-hover)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '1rem' }}>
              🏥 {selected.condicion_medica}
            </div>
          )}

          <div style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Historial de Donaciones Recibidas
          </div>
          {historial.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Aún no ha recibido donaciones registradas.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
              {historial.map(h => (
                <div key={h.id} style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: '600' }}>{h.medicinas?.nombre}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                    <span>{new Date(h.timestamp).toLocaleDateString('es-ES')}</span>
                    <span style={{ fontWeight: '700', color: 'var(--success-color)' }}>+{h.cantidad} u.</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title="👤 Registrar Beneficiario">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="b-nombre" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Nombre Completo <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <input id="b-nombre" className="input-field" style={{ marginBottom: 0 }} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. María García López" required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="b-cedula" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Cédula / ID</label>
              <input id="b-cedula" className="input-field" style={{ marginBottom: 0 }} value={cedula} onChange={e => setCedula(e.target.value)} placeholder="V-12345678" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="b-tel" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Teléfono</label>
              <input id="b-tel" className="input-field" style={{ marginBottom: 0 }} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="04XX-1234567" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="b-dir" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Dirección</label>
            <input id="b-dir" className="input-field" style={{ marginBottom: 0 }} value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Sector, Ciudad" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Condición Médica</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {CONDICIONES.map(c => (
                <button key={c} type="button" onClick={() => setCondicion(condicion === c ? '' : c)}
                  style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-pill)', border: `1.5px solid ${condicion === c ? 'var(--primary-color)' : 'var(--border-color)'}`, background: condicion === c ? 'var(--primary-light)' : 'var(--bg-surface)', color: condicion === c ? 'var(--primary-hover)' : 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: condicion === c ? '600' : '400', cursor: 'pointer', transition: 'all var(--transition-fast)', fontFamily: 'var(--font-family)' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="b-notas" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Notas Adicionales</label>
            <textarea id="b-notas" className="input-field" style={{ marginBottom: 0, resize: 'vertical', minHeight: '70px' }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Información relevante..." />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); resetForm(); }}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Guardando...' : '✅ Registrar Beneficiario'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
