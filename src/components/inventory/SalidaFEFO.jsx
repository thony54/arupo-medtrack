import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ListChecks } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Comprobante } from './Comprobante';

export const SalidaFEFO = ({ isOpen, onClose, onSuccess }) => {
  const [medicinas, setMedicinas] = useState([]);
  const [beneficiarios, setBeneficiarios] = useState([]);
  
  // Cart state
  const [cart, setCart] = useState([]);
  
  // Global form states
  const [beneficiarioId, setBeneficiarioId] = useState('');
  const [destinoLibre, setDestinoLibre] = useState('');

  // Current item states
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Results
  const [actaData, setActaData] = useState(null);

  useEffect(() => {
    if (isOpen) { fetchMedicinas(); fetchBeneficiarios(); }
  }, [isOpen]);

  const fetchMedicinas = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('medicinas').select('id, nombre, concentracion, stock_actual')
      .gt('stock_actual', 0).order('nombre');
    setMedicinas(data || []);
  };

  const fetchBeneficiarios = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('beneficiarios').select('id, nombre_completo, cedula, condicion_medica')
      .eq('estado', 'Activo').order('nombre_completo');
    setBeneficiarios(data || []);
  };

  const resetCurrentItem = () => {
    setProductoId(''); setCantidad(''); setError('');
  };

  const resetAll = () => {
    resetCurrentItem();
    setBeneficiarioId(''); setDestinoLibre('');
    setCart([]); setActaData(null);
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    setError('');
    
    if (!productoId) { setError('Selecciona un medicamento.'); return; }
    if (!cantidad || Number(cantidad) <= 0) { setError('La cantidad debe ser mayor a 0.'); return; }

    const med = medicinas.find(m => m.id === productoId);
    if (!med) return;

    if (Number(cantidad) > med.stock_actual) {
      setError(`Solo hay ${med.stock_actual} unidades disponibles de este medicamento.`);
      return;
    }

    // Check if already in cart to sum quantities to avoid over-drafting
    const existingQty = cart.filter(c => c.productoId === productoId).reduce((sum, item) => sum + item.cantidad, 0);
    if (existingQty + Number(cantidad) > med.stock_actual) {
      setError(`No hay suficiente stock. Ya tienes ${existingQty} en la lista y solo hay ${med.stock_actual} disponibles.`);
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      productoId,
      medNameDisplay: `${med.nombre} ${med.concentracion ? `(${med.concentracion})` : ''}`,
      cantidad: Number(cantidad)
    };

    setCart([...cart, newItem]);
    resetCurrentItem();
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleSubmitAll = async () => {
    if (cart.length === 0) return;
    setError('');
    
    if (!beneficiarioId && !destinoLibre.trim()) {
      setError('Debes indicar el beneficiario (Paso 1) antes de procesar.');
      return;
    }

    const destino = beneficiarioId
      ? beneficiarios.find(b => b.id === beneficiarioId)?.nombre_completo
      : destinoLibre.trim();

    try {
      setLoading(true);
      const donacionesProcesadas = [];

      for (const item of cart) {
        const { data, error: fnErr } = await supabase.rpc('registrar_salida_fefo', {
          p_producto_id: item.productoId,
          p_cantidad: item.cantidad,
          p_destino: destino,
          p_beneficiario_id: beneficiarioId || null
        });
        
        if (fnErr) throw fnErr;
        
        donacionesProcesadas.push({
          producto: medicinas.find(m => m.id === item.productoId),
          desglose_lotes: data.desglose,
          total_despachado: data.total_despachado
        });
      }

      setActaData({
        beneficiario: beneficiarioId ? beneficiarios.find(b => b.id === beneficiarioId) : { nombre_completo: destinoLibre },
        donaciones: donacionesProcesadas
      });
      
    } catch (err) {
      setError(err.message || 'Error al procesar la donación. Revisa el stock.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); resetAll(); }}
      title={actaData ? '📋 Acta de Donación' : '💊 Entregar Donación'}>
      {actaData ? (
        <Comprobante
          beneficiario={actaData.beneficiario}
          donaciones={actaData.donaciones}
          onClose={() => { resetAll(); onSuccess(); }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ padding: '0.875rem', background: 'var(--primary-light)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--primary-hover)', border: '1px solid rgba(5,150,105,0.2)' }}>
            💡 Los medicamentos se tomarán automáticamente de los lotes con <strong>fecha de vencimiento más próxima</strong> (FEFO).
          </div>

          {error && <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>{error}</div>}

          {/* 1. Destino Global */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>1. Receptor / Destino</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="sf-ben" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Beneficiario registrado</label>
              <select id="sf-ben" className="input-field" style={{ marginBottom: 0, cursor: 'pointer' }}
                value={beneficiarioId} onChange={e => { setBeneficiarioId(e.target.value); if (e.target.value) setDestinoLibre(''); }}>
                <option value="">— Seleccionar del CRM (opcional) —</option>
                {beneficiarios.map(b => (
                  <option key={b.id} value={b.id}>{b.nombre_completo}{b.cedula ? ` — ${b.cedula}` : ''}{b.condicion_medica ? ` (${b.condicion_medica})` : ''}</option>
                ))}
              </select>
            </div>

            {!beneficiarioId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="sf-dest" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>O escribe el destinatario manualmente <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                <input id="sf-dest" className="input-field" style={{ marginBottom: 0 }}
                  value={destinoLibre} onChange={e => setDestinoLibre(e.target.value)}
                  placeholder="Ej. Centro de Salud Norte / Ana Martínez" />
              </div>
            )}
          </div>

          {/* 2. Añadir items al carrito */}
          <form onSubmit={handleAddToCart} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={16} color="var(--primary-color)" /> 2. Añadir Medicamento a la Lista
            </div>
            
            <div className="grid-responsive" style={{ gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="sf-prod" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Medicamento <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                <select id="sf-prod" className="input-field" style={{ marginBottom: 0, cursor: 'pointer' }}
                  value={productoId} onChange={e => setProductoId(e.target.value)} required>
                  <option value="">— Selecciona un medicamento —</option>
                  {medicinas.map(m => (
                    <option key={m.id} value={m.id}>{m.nombre}{m.concentracion ? ` (${m.concentracion})` : ''} — Disp: {m.stock_actual}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="sf-cant" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Cantidad <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                <input id="sf-cant" className="input-field" style={{ marginBottom: 0 }}
                  type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="Ej. 30" required />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button type="submit" variant="outline" style={{ color: 'var(--primary-color)', borderColor: 'var(--primary-color)', width: '100%' }}>
                + Añadir a la Lista
              </Button>
            </div>
          </form>

          {/* Cart List */}
          {cart.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ListChecks size={16} /> Medicamentos a Entregar ({cart.length})
              </div>
              <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <table className="data-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Medicamento</th>
                      <th>Cant.</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.id}>
                        <td>{item.medNameDisplay}</td>
                        <td style={{ fontWeight: '700', color: 'var(--success-color)' }}>{item.cantidad}</td>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
            <Button type="button" variant="ghost" onClick={() => { onClose(); resetAll(); }}>Cancelar</Button>
            <Button type="button" variant="primary" onClick={handleSubmitAll} disabled={loading || cart.length === 0}>
              {loading ? 'Procesando...' : `❤️ Confirmar y Entregar (${cart.length})`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
