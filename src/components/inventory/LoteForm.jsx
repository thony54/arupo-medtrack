import React, { useState, useEffect } from 'react';
import { Camera, Plus, Trash2, ListChecks } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { QRScanner } from './QRScanner';
import { useOfflineCache } from '../../hooks/useOfflineCache';

export const LoteForm = ({ isOpen, onClose, onSuccess }) => {
  const [medicinas, setMedicinas] = useState([]);
  const [donantes, setDonantes] = useState([]);
  
  // Cart state
  const [cart, setCart] = useState([]);

  // Form states
  const [productoId, setProductoId] = useState('');
  const [newMedNombre, setNewMedNombre] = useState('');
  const [newMedConcentracion, setNewMedConcentracion] = useState('');
  const [donanteId, setDonanteId] = useState('');
  const [numeroLote, setNumeroLote] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const { isOnline, queueOfflineAction } = useOfflineCache();

  useEffect(() => {
    if (isOpen) { fetchMedicinas(); fetchDonantes(); }
  }, [isOpen]);

  const fetchMedicinas = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('medicinas').select('id, nombre, concentracion').order('nombre');
    setMedicinas(data || []);
  };

  const fetchDonantes = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('donantes').select('id, nombre, tipo').eq('estado', 'Activo').order('nombre');
    setDonantes(data || []);
  };

  const resetCurrentItem = () => {
    setProductoId(''); setNewMedNombre(''); setNewMedConcentracion('');
    setNumeroLote(''); setCantidad(''); setFechaVencimiento(''); setUbicacion('');
    setError('');
  };

  const resetAll = () => {
    resetCurrentItem();
    setDonanteId('');
    setCart([]);
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    setError('');

    if (!productoId) { setError('Selecciona un producto.'); return; }
    if (productoId === 'NEW' && !newMedNombre.trim()) { setError('Ingresa el nombre del nuevo medicamento.'); return; }
    if (!cantidad || Number(cantidad) <= 0) { setError('La cantidad debe ser mayor a 0.'); return; }
    if (!fechaVencimiento) { setError('La fecha de vencimiento es obligatoria.'); return; }

    let medNameDisplay = '';
    if (productoId === 'NEW') {
      medNameDisplay = `${newMedNombre.trim()} ${newMedConcentracion ? `(${newMedConcentracion.trim()})` : ''} *(Nuevo)*`;
    } else {
      const med = medicinas.find(m => m.id === productoId);
      medNameDisplay = med ? `${med.nombre} ${med.concentracion ? `(${med.concentracion})` : ''}` : 'Medicamento';
    }

    const newItem = {
      id: Date.now().toString(),
      productoId,
      newMedNombre: newMedNombre.trim(),
      newMedConcentracion: newMedConcentracion.trim(),
      medNameDisplay,
      numeroLote: numeroLote.trim() || null,
      cantidad: Number(cantidad),
      fechaVencimiento,
      ubicacion: ubicacion.trim() || null,
    };

    setCart([...cart, newItem]);
    resetCurrentItem();
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleSubmitAll = async () => {
    if (cart.length === 0) return;
    try {
      setLoading(true);
      setError('');

      for (const item of cart) {
        let finalProductoId = item.productoId;

        // Si es medicamento nuevo, insertarlo primero
        if (item.productoId === 'NEW') {
          if (isOnline && supabase) {
            // Check if it exists just in case
            const { data: existing } = await supabase.from('medicinas').select('id').ilike('nombre', item.newMedNombre).single();
            if (existing) {
              finalProductoId = existing.id;
            } else {
              const { data: newMed, error: medErr } = await supabase.from('medicinas')
                .insert({ nombre: item.newMedNombre, concentracion: item.newMedConcentracion || null })
                .select().single();
              if (medErr) throw medErr;
              finalProductoId = newMed.id;
            }
          }
        }

        const loteData = {
          producto_id: finalProductoId,
          donante_id: donanteId || null,
          numero_lote: item.numeroLote,
          cantidad_actual: item.cantidad,
          fecha_vencimiento: item.fechaVencimiento,
          ubicacion_estante: item.ubicacion,
          estado: 'Disponible',
        };

        if (isOnline && supabase) {
          const { error: err } = await supabase.from('lotes').insert(loteData);
          if (err) throw err;
          // Register as Entrada movement too
          await supabase.from('movimientos').insert({
            medicina_id: finalProductoId,
            tipo: 'Entrada',
            cantidad: item.cantidad,
            origen_destino: `Lote: ${item.numeroLote || 'S/N'}`
          });
        } else {
          queueOfflineAction({ type: 'INSERT_LOTE', data: loteData });
        }
      }

      resetAll();
      onSuccess();
    } catch (err) {
      setError(err.message || 'Error al procesar los lotes.');
    } finally {
      setLoading(false);
    }
  };

  const hoy = new Date().toISOString().split('T')[0];

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={() => { onClose(); resetAll(); }} 
      title="📥 Registrar Ingreso de Medicina"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => { onClose(); resetAll(); }}>Cancelar</Button>
          <Button type="button" variant="primary" onClick={handleSubmitAll} disabled={loading || cart.length === 0}>
            {loading ? 'Procesando...' : `✅ Guardar (${cart.length})`}
          </Button>
        </>
      }
    >
      {showScanner ? (
        <QRScanner
          onScan={(code) => { setNumeroLote(code); setShowScanner(false); }}
          onClose={() => setShowScanner(false)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!isOnline && (
            <div style={{ padding: '0.75rem', background: 'var(--warning-bg)', color: 'var(--warning-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', border: '1px solid rgba(245,158,11,0.2)' }}>
              ⚠️ Sin conexión. El lote se guardará localmente y se sincronizará al reconectarse.
            </div>
          )}
          {error && (
            <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* Donante Global */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <label htmlFor="lf-donante" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
              1. Donante / Origen (aplica para todos los lotes)
            </label>
            <select id="lf-donante" className="input-field" style={{ marginBottom: 0, cursor: 'pointer' }}
              value={donanteId} onChange={e => setDonanteId(e.target.value)}>
              <option value="">— Sin donante registrado —</option>
              {donantes.map(d => (
                <option key={d.id} value={d.id}>{d.nombre} ({d.tipo})</option>
              ))}
            </select>
          </div>

          <form onSubmit={handleAddToCart} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={16} color="var(--primary-color)" /> 2. Añadir Lote a la Lista
            </div>
            
            {/* Producto */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="lf-producto" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Medicamento <span style={{ color: 'var(--danger-color)' }}>*</span>
              </label>
              <select id="lf-producto" className="input-field" style={{ marginBottom: 0, cursor: 'pointer' }}
                value={productoId} onChange={e => setProductoId(e.target.value)} required>
                <option value="">— Selecciona un medicamento —</option>
                {medicinas.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre} {m.concentracion ? `(${m.concentracion})` : ''}</option>
                ))}
                <option value="NEW" style={{ fontWeight: 'bold', color: 'var(--primary-hover)' }}>[+] Nuevo Medicamento...</option>
              </select>
            </div>

            {productoId === 'NEW' && (
              <div className="grid-responsive" style={{ gap: '1rem', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Nombre <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                  <input className="input-field" required value={newMedNombre} onChange={e => setNewMedNombre(e.target.value)} placeholder="Ej. Ibuprofeno" style={{ marginBottom: 0, border: '1px dashed var(--primary-color)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Concentración</label>
                  <input className="input-field" value={newMedConcentracion} onChange={e => setNewMedConcentracion(e.target.value)} placeholder="Ej. 400mg" style={{ marginBottom: 0, border: '1px dashed var(--primary-color)' }} />
                </div>
              </div>
            )}

            {/* N° Lote + Scanner */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="lf-lote" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                N° de Lote del Proveedor
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input id="lf-lote" className="input-field" style={{ marginBottom: 0, flex: 1 }}
                  value={numeroLote} onChange={e => setNumeroLote(e.target.value)}
                  placeholder="Ej. LOT-2025-001" />
                <Button type="button" variant="outline" onClick={() => setShowScanner(true)}
                  style={{ minWidth: '44px', minHeight: '44px', padding: '0.5rem' }}
                  aria-label="Escanear código de lote">
                  <Camera size={20} />
                </Button>
              </div>
            </div>

            {/* Cantidad + Fecha en row */}
            <div className="grid-responsive" style={{ gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="lf-cantidad" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Cantidad <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <input id="lf-cantidad" className="input-field" style={{ marginBottom: 0 }}
                  type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)}
                  placeholder="Ej. 500" required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="lf-venc" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Fecha Venc. <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <input id="lf-venc" className="input-field" style={{ marginBottom: 0 }}
                  type="date" min={hoy} value={fechaVencimiento}
                  onChange={e => setFechaVencimiento(e.target.value)} required />
              </div>
            </div>

            {/* Ubicación */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="lf-ubic" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Ubicación en Estante
              </label>
              <input id="lf-ubic" className="input-field" style={{ marginBottom: 0 }}
                value={ubicacion} onChange={e => setUbicacion(e.target.value)}
                placeholder="Ej. Estante A-3" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button type="submit" variant="outline" style={{ color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}>
                + Añadir a la Lista
              </Button>
            </div>
          </form>

          {/* Cart List */}
          {cart.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ListChecks size={16} /> Lotes a Registrar ({cart.length})
              </div>
              <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <table className="data-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Medicina</th>
                      <th>Lote</th>
                      <th>Cant.</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.id}>
                        <td>{item.medNameDisplay}</td>
                        <td>{item.numeroLote || 'S/N'}</td>
                        <td style={{ fontWeight: '600' }}>{item.cantidad}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '0.2rem' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}


        </div>
      )}
    </Modal>
  );
};
