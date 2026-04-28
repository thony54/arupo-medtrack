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
        .select('*')
        .order('nombre_completo');
      if (err) throw err;
      // Get donation count per beneficiary
      const { data: movData } = await supabase
        .from('movimientos')
        .select('beneficiario_id')
        .eq('tipo', 'Salida')
        .not('beneficiario_id', 'is', null);

      const countMap = {};
      (movData || []).forEach(m => { countMap[m.beneficiario_id] = (countMap[m.beneficiario_id] || 0) + 1; });
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
    <div className="animate-fade-in flex-responsive" style={{ alignItems: 'flex-start' }}>
      {/* Main Panel */}
      <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
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
        <div className="card animate-fade-in mobile-full-width" style={{ width: '340px', flexShrink: 0, position: 'sticky', top: '1rem' }}>
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
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title="👤 Registrar Beneficiario"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); resetForm(); }}>Cancelar</Button>
            <Button
              type="button"
              variant="primary"
              disabled={saving}
              onClick={() => document.getElementById('b-submit-trigger').click()}
            >
              {saving ? 'Guardando...' : '✅ Registrar Beneficiario'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="b-nombre" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Nombre Completo <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <input id="b-nombre" className="input-field" style={{ marginBottom: 0 }} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. María García López" required />
          </div>

          <div className="grid-responsive" style={{ gap: '1rem' }}>
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
            <label htmlFor="b-condicion" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Condición Médica</label>
            <select
              id="b-condicion"
              className="input-field"
              style={{ marginBottom: 0, cursor: 'pointer', width: '100%', appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2310b981%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
              value={condicion}
              onChange={e => setCondicion(e.target.value)}
            >
              <option value="">Ninguna / No especificada</option>
              {CONDICIONES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="b-notas" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Notas Adicionales</label>
            <textarea id="b-notas" className="input-field" style={{ marginBottom: 0, resize: 'vertical', minHeight: '70px' }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Información relevante..." />
          </div>

          {/* Hidden submit trigger — actual buttons are in footer prop */}
          <button type="submit" id="b-submit-trigger" style={{ display: 'none' }} aria-hidden="true" />
        </form>
      </Modal>
    </div>
  );
};
