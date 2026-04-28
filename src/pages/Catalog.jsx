import React, { useState, useEffect } from 'react';
import { Plus, Database, FlaskConical, Pill, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import './pages.css';

export const Catalog = () => {
  const [medicinas, setMedicinas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [nombre, setNombre] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [newCategoriaNombre, setNewCategoriaNombre] = useState('');
  const [presentacion, setPresentacion] = useState('');
  const [concentracion, setConcentracion] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!supabase) return;
    try {
      const [medRes, catRes] = await Promise.all([
        supabase.from('medicinas').select('*, categorias(nombre)').order('nombre'),
        supabase.from('categorias').select('*').order('nombre')
      ]);
      if (medRes.error) throw medRes.error;
      if (catRes.error) throw catRes.error;
      setMedicinas(medRes.data || []);
      setCategorias(catRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setNombre('');
    setCategoriaId('');
    setNewCategoriaNombre('');
    setPresentacion('');
    setConcentracion('');
    setError('');
  };

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    setError('');

    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    if (!categoriaId) { setError('Debes seleccionar una categoría.'); return; }
    if (categoriaId === 'NEW' && !newCategoriaNombre.trim()) { setError('Escribe el nombre de la nueva categoría.'); return; }

    try {
      setLoading(true);
      if (supabase) {
        let finalCategoriaId = categoriaId;
        
        // Crear categoría si es nueva
        if (categoriaId === 'NEW') {
          const { data: catData, error: catError } = await supabase.from('categorias')
            .insert({ nombre: newCategoriaNombre.trim(), descripcion: 'Categoría añadida manualmente' })
            .select()
            .single();
            
          if (catError) throw catError;
          finalCategoriaId = catData.id;
        }

        const { error: insertError } = await supabase.from('medicinas').insert({
          nombre: nombre.trim(),
          categoria_id: finalCategoriaId,
          presentacion: presentacion.trim(),
          concentracion: concentracion.trim()
        });
        if (insertError) throw insertError;
        await fetchData();
        setIsModalOpen(false);
        resetForm();
      }
    } catch (err) {
      setError(err.message || 'Error al guardar la medicina.');
    } finally {
      setLoading(false);
    }
  };

  const presentacionOptions = ['Tabletas', 'Cápsulas', 'Jarabe', 'Ampolla', 'Crema', 'Gotas', 'Supositorio', 'Parche', 'Otro'];

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo Maestro</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {medicinas.length} medicamento{medicinas.length !== 1 ? 's' : ''} registrado{medicinas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus size={18} />
          Añadir Medicina
        </Button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ background: 'var(--primary-light)', color: 'var(--primary-color)', width: '36px', height: '36px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={18} />
          </div>
          <h2 style={{ fontSize: '1rem', fontWeight: '700' }}>Medicinas Registradas</h2>
        </div>

        <div className="table-container animate-slide-up stagger-1" style={{ borderRadius: 0, border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Concentración</th>
                <th>Presentación</th>
              </tr>
            </thead>
            <tbody>
              {medicinas.map((med) => (
                <tr key={med.id}>
                  <td>
                    <div style={{ fontWeight: '600' }}>{med.nombre}</div>
                  </td>
                  <td>
                    <span style={{ background: 'var(--primary-light)', color: 'var(--primary-hover)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-pill)', fontSize: '0.8rem', fontWeight: '600' }}>
                      {med.categorias?.nombre || '-'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{med.concentracion || '-'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{med.presentacion || '-'}</td>
                </tr>
              ))}
              {medicinas.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Pill size={40} style={{ margin: '0 auto 0.75rem', color: 'var(--text-tertiary)', display: 'block' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>No hay medicinas en el catálogo aún.<br />Añade la primera usando el botón de arriba.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Medicine Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title="💊 Añadir Nueva Medicina"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={loading}
              onClick={() => document.getElementById('cat-submit-trigger').click()}
            >
              {loading ? 'Guardando...' : '✅ Guardar Medicina'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddMedicine} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          {/* Nombre */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="cat-nombre" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
              Nombre de la Medicina <span style={{ color: 'var(--danger-color)' }}>*</span>
            </label>
            <input
              id="cat-nombre"
              className="input-field"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Paracetamol"
              style={{ marginBottom: 0 }}
            />
          </div>

          {/* Categoría */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="cat-categoria" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
              Categoría <span style={{ color: 'var(--danger-color)' }}>*</span>
            </label>
            <select
              id="cat-categoria"
              className="input-field"
              required
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              style={{ marginBottom: 0, cursor: 'pointer' }}
            >
              <option value="">— Selecciona una categoría —</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
              <option value="NEW" style={{ fontWeight: 'bold', color: 'var(--primary-hover)' }}>[+] Nueva Categoría...</option>
            </select>
            
            {categoriaId === 'NEW' && (
              <input
                className="input-field animate-fade-in"
                required
                value={newCategoriaNombre}
                onChange={(e) => setNewCategoriaNombre(e.target.value)}
                placeholder="Nombre de la nueva categoría..."
                style={{ marginTop: '0.5rem', marginBottom: 0, border: '1px dashed var(--primary-color)' }}
              />
            )}
          </div>

          {/* Concentración */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="cat-concentracion" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
              Concentración / Dosis
            </label>
            <input
              id="cat-concentracion"
              className="input-field"
              value={concentracion}
              onChange={(e) => setConcentracion(e.target.value)}
              placeholder="Ej. 500mg, 1g, 250ml"
              style={{ marginBottom: 0 }}
            />
          </div>

          {/* Presentación como botones visuales */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
              Presentación
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {presentacionOptions.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPresentacion(opt === presentacion ? '' : opt)}
                  style={{
                    padding: '0.4rem 0.875rem',
                    borderRadius: 'var(--radius-pill)',
                    border: `1.5px solid ${presentacion === opt ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    background: presentacion === opt ? 'var(--primary-light)' : 'var(--bg-surface)',
                    color: presentacion === opt ? 'var(--primary-hover)' : 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    fontWeight: presentacion === opt ? '600' : '400',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    fontFamily: 'var(--font-family)'
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
            {/* Also allow custom input */}
            <input
              id="cat-presentacion-custom"
              className="input-field"
              value={presentacion}
              onChange={(e) => setPresentacion(e.target.value)}
              placeholder="O escribe una presentación personalizada..."
              style={{ marginBottom: 0, marginTop: '0.5rem', fontSize: '0.85rem' }}
            />
          </div>

          {/* Hidden submit trigger */}
          <button type="submit" id="cat-submit-trigger" style={{ display: 'none' }} aria-hidden="true" />
        </form>
      </Modal>
    </div>
  );
};
