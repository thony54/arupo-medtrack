import React, { useState, useEffect } from 'react';
import { Building2, Plus, Search, X, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import './pages.css';

const TIPOS = ['Hospital', 'Farmacia', 'ONG', 'Gobierno', 'Empresa', 'Particular'];
const TIPO_ICONS = { Hospital: '🏥', Farmacia: '💊', ONG: '🤝', Gobierno: '🏛️', Empresa: '🏢', Particular: '👤' };

export const Donantes = () => {
  const [donantes, setDonantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [historial, setHistorial] = useState([]);

  // Form
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [contactoNombre, setContactoNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [notas, setNotas] = useState('');

  useEffect(() => { fetchDonantes(); }, []);

  const fetchDonantes = async () => {
    setLoading(true);
    try {
      if (!supabase) throw new Error();
      const { data, error: err } = await supabase.from('donantes').select('*').order('nombre');
      if (err) throw err;

      // Count lotes per donante
      const { data: loteData } = await supabase
        .from('lotes')
        .select('donante_id')
        .not('donante_id', 'is', null);

      const countMap = {};
      (loteData || []).forEach(l => { countMap[l.donante_id] = (countMap[l.donante_id] || 0) + 1; });
      setDonantes((data || []).map(d => ({ ...d, lotes_count: countMap[d.id] || 0 })));
    } catch { setDonantes([]); } finally { setLoading(false); }
  };

  const fetchHistorial = async (donante) => {
    setSelected(donante);
    if (!supabase) return;
    const { data } = await supabase
      .from('lotes')
      .select('*, medicinas(nombre)')
      .eq('donante_id', donante.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setHistorial(data || []);
  };

  const resetForm = () => {
    setNombre(''); setTipo(''); setContactoNombre('');
    setTelefono(''); setEmail(''); setNotas(''); setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    if (!tipo) { setError('Selecciona el tipo de donante.'); return; }
    try {
      setSaving(true);
      const { error: err } = await supabase.from('donantes').insert({
        nombre: nombre.trim(), tipo,
        contacto_nombre: contactoNombre.trim() || null,
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        notas: notas.trim() || null
      });
      if (err) throw err;
      resetForm(); setIsModalOpen(false); fetchDonantes();
    } catch (err) {
      setError(err.message || 'Error al guardar.');
    } finally { setSaving(false); }
  };

  const filtered = donantes.filter(d =>
    d.nombre.toLowerCase().includes(search.toLowerCase()) ||
    d.tipo.toLowerCase().includes(search.toLowerCase()) ||
    (d.contacto_nombre || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in flex-responsive" style={{ alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Donantes</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              {filtered.length} organización{filtered.length !== 1 ? 'es' : ''} registrada{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
            <Plus size={18} /> Añadir Donante
          </Button>
        </div>

        <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input className="input-field" style={{ paddingLeft: '2.75rem', marginBottom: 0, width: '100%' }}
              placeholder="Buscar por nombre, tipo o contacto..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Type filter chips */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {TIPOS.map(t => (
            <button key={t} onClick={() => setSearch(search === t ? '' : t)}
              style={{ padding: '0.4rem 0.875rem', borderRadius: 'var(--radius-pill)', border: `1.5px solid ${search === t ? 'var(--primary-color)' : 'var(--border-color)'}`, background: search === t ? 'var(--primary-light)' : 'var(--bg-surface)', color: search === t ? 'var(--primary-hover)' : 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: 'all var(--transition-fast)', fontFamily: 'var(--font-family)' }}>
              {TIPO_ICONS[t]} {t}
            </button>
          ))}
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Donante</th>
                <th>Tipo</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th style={{ textAlign: 'center' }}>Lotes Aportados</th>
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
                    <Building2 size={40} style={{ display: 'block', margin: '0 auto 0.75rem', color: 'var(--text-tertiary)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>No hay donantes registrados aún.</span>
                  </td>
                </tr>
              ) : filtered.map(d => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => fetchHistorial(d)}>
                  <td><div style={{ fontWeight: '600' }}>{TIPO_ICONS[d.tipo]} {d.nombre}</div></td>
                  <td>
                    <span style={{ background: 'var(--primary-light)', color: 'var(--primary-hover)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-pill)', fontSize: '0.8rem', fontWeight: '600' }}>{d.tipo}</span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{d.contacto_nombre || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{d.telefono || '—'}</td>
                  <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--success-color)' }}>{d.lotes_count}</td>
                  <td><Badge variant={d.estado === 'Activo' ? 'success' : 'warning'}>{d.estado}</Badge></td>
                  <td><Button variant="ghost" onClick={e => { e.stopPropagation(); fetchHistorial(d); }} style={{ fontSize: '0.8rem' }}>Ver →</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Panel */}
      {selected && (
        <div className="card animate-fade-in mobile-full-width" style={{ width: '320px', flexShrink: 0, position: 'sticky', top: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontWeight: '700' }}>{TIPO_ICONS[selected.tipo]} {selected.nombre}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{selected.tipo}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
          </div>
          <div style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Lotes Donados
          </div>
          {historial.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Sin lotes registrados aún.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
              {historial.map(l => (
                <div key={l.id} style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: '600' }}>{l.medicinas?.nombre}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                    <span>Vence: {new Date(l.fecha_vencimiento).toLocaleDateString('es-ES')}</span>
                    <span style={{ fontWeight: '700', color: 'var(--primary-color)' }}>{l.cantidad_actual} u.</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title="🤝 Registrar Donante"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); resetForm(); }}>Cancelar</Button>
            <Button
              type="button"
              variant="primary"
              disabled={saving}
              onClick={() => document.getElementById('d-submit-trigger').click()}
            >
              {saving ? 'Guardando...' : '✅ Registrar Donante'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="d-nombre" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Nombre / Organización <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <input id="d-nombre" className="input-field" style={{ marginBottom: 0 }} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Farmacia Central / Cruz Roja" required />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Tipo <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {TIPOS.map(t => (
                <button key={t} type="button" onClick={() => setTipo(t)}
                  style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-pill)', border: `1.5px solid ${tipo === t ? 'var(--primary-color)' : 'var(--border-color)'}`, background: tipo === t ? 'var(--primary-light)' : 'var(--bg-surface)', color: tipo === t ? 'var(--primary-hover)' : 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: tipo === t ? '600' : '400', cursor: 'pointer', fontFamily: 'var(--font-family)' }}>
                  {TIPO_ICONS[t]} {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid-responsive" style={{ gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="d-cont" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Contacto</label>
              <input id="d-cont" className="input-field" style={{ marginBottom: 0 }} value={contactoNombre} onChange={e => setContactoNombre(e.target.value)} placeholder="Nombre del responsable" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="d-tel" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Teléfono</label>
              <input id="d-tel" className="input-field" style={{ marginBottom: 0 }} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="04XX-1234567" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="d-email" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Email</label>
            <input id="d-email" className="input-field" style={{ marginBottom: 0 }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contacto@organizacion.org" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="d-notas" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Notas</label>
            <textarea id="d-notas" className="input-field" style={{ marginBottom: 0, resize: 'vertical', minHeight: '60px' }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones..." />
          </div>

          {/* Hidden submit trigger — actual buttons are in footer prop */}
          <button type="submit" id="d-submit-trigger" style={{ display: 'none' }} aria-hidden="true" />
        </form>
      </Modal>
    </div>
  );
};
