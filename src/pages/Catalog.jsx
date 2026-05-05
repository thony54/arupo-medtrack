import React, { useState, useEffect } from 'react';
import { Plus, Database, FlaskConical, Pill, Tag, Trash2, ShoppingBag, Stethoscope, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CATEGORIAS_GENERALES, esCategoriaMediaca } from '../utils/itemUtils';
import './pages.css';

// Categorías médicas predefinidas para orientar al usuario
const CATEGORIAS_MEDICAS_SUGERIDAS = ['Analgésicos', 'Antibióticos', 'Antiinflamatorios', 'Antiparasitarios', 'Vitaminas', 'Antihistamínicos', 'Cardiovasculares', 'Otro'];

export const Catalog = () => {
  const [medicinas, setMedicinas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filtro visual (médicos / generales / todos)
  const [filtroTipo, setFiltroTipo] = useState('todos');

  // Form states
  const [nombre, setNombre] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [newCategoriaNombre, setNewCategoriaNombre] = useState('');
  const [tipoRegistro, setTipoRegistro] = useState('medico'); // 'medico' | 'general'
  const [presentacion, setPresentacion] = useState('');
  const [concentracion, setConcentracion] = useState('');
  const [editingId, setEditingId] = useState(null);

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
    setTipoRegistro('medico');
    setEditingId(null);
    setError('');
  };

  const handleEditMedicine = (med) => {
    resetForm();
    const esMedico = esCategoriaMediaca(med.categorias?.nombre);
    setTipoRegistro(esMedico ? 'medico' : 'general');
    setNombre(med.nombre);
    setCategoriaId(med.categoria_id || '');
    setPresentacion(med.presentacion || '');
    setConcentracion(med.concentracion || '');
    setEditingId(med.id);
    setIsModalOpen(true);
  };

  // Las categorías médicas son las que NO están en CATEGORIAS_GENERALES
  const categoriasMedicas = categorias.filter(c => esCategoriaMediaca(c.nombre));
  const categoriasGenerales = categorias.filter(c => !esCategoriaMediaca(c.nombre));

  // Categorías a mostrar en el selector según el tipo de registro activo
  const categoriasDisponibles = tipoRegistro === 'general' ? categoriasGenerales : categoriasMedicas;

  const handleAddItem = async (e) => {
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
            .insert({ nombre: newCategoriaNombre.trim(), descripcion: tipoRegistro === 'general' ? 'Categoría general añadida manualmente' : 'Categoría médica añadida manualmente' })
            .select()
            .single();
          if (catError) throw catError;
          finalCategoriaId = catData.id;
        }

        // Para ítems generales: concentracion y presentacion quedan como null (opcional)
        const medData = {
          nombre: nombre.trim(),
          categoria_id: finalCategoriaId,
          presentacion: presentacion.trim() || null,
          concentracion: tipoRegistro === 'medico' ? (concentracion.trim() || null) : null,
        };

        if (editingId) {
          const { error: updateError } = await supabase.from('medicinas').update(medData).eq('id', editingId);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase.from('medicinas').insert(medData);
          if (insertError) throw insertError;
        }
        await fetchData();
        setIsModalOpen(false);
        resetForm();
      }
    } catch (err) {
      setError(err.message || 'Error al guardar el ítem.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMedicine = async (id, nombre) => {
    if (window.confirm(`¿Estás seguro de borrar "${nombre}" y todo su historial? Esta acción no se puede deshacer.`)) {
      try {
        setLoading(true);
        if (supabase) {
          await supabase.from('movimientos').delete().eq('medicina_id', id);
          const { error: delError } = await supabase.from('medicinas').delete().eq('id', id);
          if (delError) throw delError;
          await fetchData();
        }
      } catch (err) {
        alert(err.message || 'Error al borrar el ítem.');
      } finally {
        setLoading(false);
      }
    }
  };

  const presentacionOptions = ['Tabletas', 'Cápsulas', 'Jarabe', 'Ampolla', 'Crema', 'Gotas', 'Unidad', 'Par', 'Kit', 'Otro'];

  // Filtrar la lista según el tipo seleccionado
  const medicinasFiltered = medicinas.filter(m => {
    if (filtroTipo === 'medico') return esCategoriaMediaca(m.categorias?.nombre);
    if (filtroTipo === 'general') return !esCategoriaMediaca(m.categorias?.nombre);
    return true;
  });

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo Maestro</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {medicinas.length} ítem{medicinas.length !== 1 ? 's' : ''} registrado{medicinas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Botón Registrar Donación General — acceso rápido */}
          <Button
            variant="outline"
            onClick={() => { resetForm(); setTipoRegistro('general'); setIsModalOpen(true); }}
            style={{ color: '#7c3aed', borderColor: '#7c3aed', gap: '0.4rem' }}
            aria-label="Añadir ítem general al catálogo"
          >
            <ShoppingBag size={16} />
            Ítem General
          </Button>
          <Button variant="primary" onClick={() => { resetForm(); setTipoRegistro('medico'); setIsModalOpen(true); }}>
            <Plus size={18} />
            Añadir Medicina
          </Button>
        </div>
      </div>

      {/* Filtro tipo */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { key: 'todos', label: 'Todos', count: medicinas.length },
          { key: 'medico', label: 'Médicos', count: medicinas.filter(m => esCategoriaMediaca(m.categorias?.nombre)).length },
          { key: 'general', label: 'Generales', count: medicinas.filter(m => !esCategoriaMediaca(m.categorias?.nombre)).length },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltroTipo(f.key)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: 'var(--radius-pill)',
              border: `1.5px solid ${filtroTipo === f.key ? (f.key === 'general' ? '#7c3aed' : 'var(--primary-color)') : 'var(--border-color)'}`,
              background: filtroTipo === f.key ? (f.key === 'general' ? '#f5f3ff' : 'var(--primary-light)') : 'var(--bg-surface)',
              color: filtroTipo === f.key ? (f.key === 'general' ? '#7c3aed' : 'var(--primary-hover)') : 'var(--text-secondary)',
              fontWeight: filtroTipo === f.key ? '700' : '400',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              fontFamily: 'var(--font-family)',
            }}
          >
            {f.label} <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>({f.count})</span>
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ background: filtroTipo === 'general' ? '#f5f3ff' : 'var(--primary-light)', color: filtroTipo === 'general' ? '#7c3aed' : 'var(--primary-color)', width: '36px', height: '36px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {filtroTipo === 'general' ? <ShoppingBag size={18} /> : <Database size={18} />}
          </div>
          <h2 style={{ fontSize: '1rem', fontWeight: '700' }}>
            {filtroTipo === 'general' ? 'Ítems Generales' : filtroTipo === 'medico' ? 'Medicamentos Médicos' : 'Todos los Ítems'}
          </h2>
        </div>

        <div className="table-container animate-slide-up stagger-1" style={{ borderRadius: 0, border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Detalle</th>
                <th>Presentación</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {medicinasFiltered.map((med) => {
                const esMedico = esCategoriaMediaca(med.categorias?.nombre);
                return (
                  <tr key={med.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{med.nombre}</div>
                    </td>
                    <td>
                      <span style={{
                        background: esMedico ? 'var(--primary-light)' : '#f5f3ff',
                        color: esMedico ? 'var(--primary-hover)' : '#6d28d9',
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        width: 'fit-content',
                      }}>
                        {esMedico ? <Stethoscope size={11} /> : <ShoppingBag size={11} />}
                        {esMedico ? 'Médico' : 'General'}
                      </span>
                    </td>
                    <td>
                      <span style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-pill)', fontSize: '0.8rem', fontWeight: '600' }}>
                        {med.categorias?.nombre || '-'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {esMedico ? (med.concentracion || '-') : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{med.presentacion || '-'}</td>
                    <td style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '0.25rem' }}>
                      <button
                        onClick={() => handleEditMedicine(med)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', padding: '0.25rem', opacity: 0.8 }}
                        title="Editar ítem"
                        aria-label={`Editar ${med.nombre}`}
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteMedicine(med.id, med.nombre)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color)', padding: '0.25rem', opacity: 0.8 }}
                        title="Borrar ítem"
                        aria-label={`Borrar ${med.nombre}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {medicinasFiltered.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Pill size={40} style={{ margin: '0 auto 0.75rem', color: 'var(--text-tertiary)', display: 'block' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>No hay ítems en esta categoría.<br />Añade el primero usando los botones de arriba.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Modal Unificado con Formulario Dinámico ─── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title={editingId ? 'Editar Ítem/Medicina' : (tipoRegistro === 'general' ? 'Añadir Ítem General' : 'Añadir Nueva Medicina')}
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
              style={tipoRegistro === 'general' ? { background: 'linear-gradient(135deg, #7c3aed, #a855f7)' } : {}}
            >
              {loading ? 'Guardando...' : `${editingId ? 'Actualizar' : 'Guardar'} ${tipoRegistro === 'general' ? 'Ítem' : 'Medicina'}`}
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          {/* Selector de tipo — toggle visual */}
          <div style={{ display: 'flex', gap: '0.75rem' }} role="group" aria-label="Tipo de ítem">
            {[
              { key: 'medico', label: '💊 Medicamento', icon: <Stethoscope size={14} /> },
              { key: 'general', label: '🎁 Ítem General', icon: <ShoppingBag size={14} /> },
            ].map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => { setTipoRegistro(t.key); setCategoriaId(''); }}
                aria-pressed={tipoRegistro === t.key}
                style={{
                  flex: 1,
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${tipoRegistro === t.key ? (t.key === 'general' ? '#7c3aed' : 'var(--primary-color)') : 'var(--border-color)'}`,
                  background: tipoRegistro === t.key ? (t.key === 'general' ? '#f5f3ff' : 'var(--primary-light)') : 'var(--bg-surface)',
                  color: tipoRegistro === t.key ? (t.key === 'general' ? '#6d28d9' : 'var(--primary-hover)') : 'var(--text-secondary)',
                  fontWeight: tipoRegistro === t.key ? '700' : '400',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  transition: 'all var(--transition-fast)',
                  fontFamily: 'var(--font-family)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Nombre */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="cat-nombre" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
              {tipoRegistro === 'general' ? 'Nombre del Ítem' : 'Nombre de la Medicina'} <span style={{ color: 'var(--danger-color)' }}>*</span>
            </label>
            <input
              id="cat-nombre"
              className="input-field"
              required
              aria-required="true"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={tipoRegistro === 'general' ? 'Ej. Camiseta Talla M, Kit de Higiene...' : 'Ej. Paracetamol'}
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
              aria-required="true"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              style={{ marginBottom: 0, cursor: 'pointer' }}
            >
              <option value="">— Selecciona una categoría —</option>
              {/* Categorías existentes del tipo correcto */}
              {categoriasDisponibles.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
              {/* Sugerencias rápidas si no hay categorías del tipo */}
              {categoriasDisponibles.length === 0 && tipoRegistro === 'general' && CATEGORIAS_GENERALES.map(c => (
                <option key={c} value={`SUGGESTED_${c}`} disabled style={{ color: 'var(--text-tertiary)' }}>
                  {c} (crear con [+] Nueva)
                </option>
              ))}
              <option value="NEW" style={{ fontWeight: 'bold', color: tipoRegistro === 'general' ? '#7c3aed' : 'var(--primary-hover)' }}>[+] Nueva Categoría...</option>
            </select>

            {categoriaId === 'NEW' && (
              <div style={{ marginTop: '0.5rem' }}>
                <input
                  className="input-field animate-fade-in"
                  required
                  value={newCategoriaNombre}
                  onChange={(e) => setNewCategoriaNombre(e.target.value)}
                  placeholder={tipoRegistro === 'general' ? 'Ej. Ropa, Higiene, Alimentos...' : 'Ej. Analgésicos, Antibióticos...'}
                  style={{ marginBottom: 0, border: `1px dashed ${tipoRegistro === 'general' ? '#7c3aed' : 'var(--primary-color)'}` }}
                />
                {/* Sugerencias rápidas para categorías generales */}
                {tipoRegistro === 'general' && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {CATEGORIAS_GENERALES.slice(0, 6).map(sug => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setNewCategoriaNombre(sug)}
                        style={{ padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-pill)', border: '1px solid #c4b5fd', background: newCategoriaNombre === sug ? '#ede9fe' : 'transparent', color: '#6d28d9', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-family)' }}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Campos médicos (solo visibles si tipoRegistro === 'medico') ─── */}
          {tipoRegistro === 'medico' && (
            <div
              role="group"
              aria-label="Campos exclusivos para medicamentos médicos"
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', animation: 'fadeIn 0.2s ease-out' }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Stethoscope size={13} /> Información Médica (Solo para medicamentos)
              </div>

              {/* Concentración */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="cat-concentracion" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Concentración / Principio Activo
                </label>
                <input
                  id="cat-concentracion"
                  className="input-field"
                  aria-required="false"
                  value={concentracion}
                  onChange={(e) => setConcentracion(e.target.value)}
                  placeholder="Ej. 500mg, 1g, 250ml"
                  style={{ marginBottom: 0 }}
                />
              </div>

              {/* Presentación */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Presentación
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['Tabletas', 'Cápsulas', 'Jarabe', 'Ampolla', 'Crema', 'Gotas', 'Supositorio'].map(opt => (
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
                <input
                  id="cat-presentacion-custom"
                  className="input-field"
                  aria-label="Presentación personalizada"
                  value={presentacion}
                  onChange={(e) => setPresentacion(e.target.value)}
                  placeholder="O escribe una presentación personalizada..."
                  style={{ marginBottom: 0, marginTop: '0.5rem', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          )}

          {/* ─── Presentación para ítems generales (simplificada) ─── */}
          {tipoRegistro === 'general' && (
            <div
              role="group"
              aria-label="Descripción de ítem general"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', animation: 'fadeIn 0.2s ease-out' }}
            >
              <label htmlFor="cat-pres-gen" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Descripción / Talla / Variante (opcional)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {['Talla S', 'Talla M', 'Talla L', 'Talla XL', 'Unitario', 'Par', 'Kit', 'Paquete'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPresentacion(opt === presentacion ? '' : opt)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 'var(--radius-pill)',
                      border: `1.5px solid ${presentacion === opt ? '#7c3aed' : 'var(--border-color)'}`,
                      background: presentacion === opt ? '#ede9fe' : 'var(--bg-surface)',
                      color: presentacion === opt ? '#6d28d9' : 'var(--text-secondary)',
                      fontSize: '0.82rem',
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
              <input
                id="cat-pres-gen"
                className="input-field"
                aria-label="Descripción personalizada del ítem"
                value={presentacion}
                onChange={(e) => setPresentacion(e.target.value)}
                placeholder="Ej. Talla única, 500ml, 3 piezas..."
                style={{ marginBottom: 0, fontSize: '0.85rem' }}
              />
            </div>
          )}

          {/* Hidden submit trigger */}
          <button type="submit" id="cat-submit-trigger" style={{ display: 'none' }} aria-hidden="true" />
        </form>
      </Modal>
    </div>
  );
};
