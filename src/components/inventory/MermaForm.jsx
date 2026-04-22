import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useOfflineCache } from '../../hooks/useOfflineCache';

const MOTIVOS = ['Vencido', 'Roto / Dañado', 'Contaminado', 'Perdido', 'Error de inventario'];

export const MermaForm = ({ isOpen, onClose, onSuccess, lote }) => {
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { isOnline, queueOfflineAction } = useOfflineCache();

  const reset = () => { setCantidad(''); setMotivo(''); setConfirmado(false); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!cantidad || Number(cantidad) <= 0) { setError('Ingresa una cantidad válida.'); return; }
    if (Number(cantidad) > lote.cantidad_actual) { setError(`No puedes dar de baja más de ${lote.cantidad_actual} unidades.`); return; }
    if (!motivo) { setError('Selecciona un motivo.'); return; }
    if (!confirmado) { setError('Debes confirmar que el ajuste es correcto.'); return; }

    const nuevaCantidad = lote.cantidad_actual - Number(cantidad);

    try {
      setLoading(true);
      if (isOnline && supabase) {
        const { error: err } = await supabase
          .from('lotes')
          .update({
            cantidad_actual: nuevaCantidad,
            estado: nuevaCantidad === 0 ? 'Vencido' : 'Disponible',
            updated_at: new Date().toISOString()
          })
          .eq('id', lote.id);
        if (err) throw err;

        // Log as Salida movement with merma note
        await supabase.from('movimientos').insert({
          medicina_id: lote.producto_id,
          tipo: 'Salida',
          cantidad: Number(cantidad),
          origen_destino: `MERMA — ${motivo} (Lote: ${lote.numero_lote || 'S/N'})`
        });
      } else {
        queueOfflineAction({ type: 'MERMA', data: { lote_id: lote.id, nueva_cantidad: nuevaCantidad } });
      }
      reset();
      onSuccess();
    } catch (err) {
      setError(err.message || 'Error al registrar la merma.');
    } finally {
      setLoading(false);
    }
  };

  if (!lote) return null;

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); reset(); }} title="⚠️ Ajuste de Merma">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Lote info banner */}
        <div style={{ padding: '1rem', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontWeight: '700', marginBottom: '0.25rem' }}>{lote.medicinas?.nombre || 'Producto'}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span>Lote: <strong>{lote.numero_lote || 'S/N'}</strong></span>
            <span>Stock actual: <strong style={{ color: 'var(--warning-color)' }}>{lote.cantidad_actual}</strong></span>
            <span>Vence: <strong>{new Date(lote.fecha_vencimiento).toLocaleDateString('es-ES')}</strong></span>
          </div>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {/* Cantidad a dar de baja */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label htmlFor="merma-cant" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
            Cantidad a dar de baja <span style={{ color: 'var(--danger-color)' }}>*</span>
          </label>
          <input id="merma-cant" className="input-field" style={{ marginBottom: 0 }}
            type="number" min="1" max={lote.cantidad_actual}
            value={cantidad} onChange={e => setCantidad(e.target.value)}
            placeholder={`Máx. ${lote.cantidad_actual}`} required />
        </div>

        {/* Motivo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
            Motivo <span style={{ color: 'var(--danger-color)' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {MOTIVOS.map(m => (
              <button key={m} type="button" onClick={() => setMotivo(m)}
                style={{
                  padding: '0.4rem 0.875rem', borderRadius: 'var(--radius-pill)',
                  border: `1.5px solid ${motivo === m ? 'var(--warning-color)' : 'var(--border-color)'}`,
                  background: motivo === m ? 'var(--warning-bg)' : 'var(--bg-surface)',
                  color: motivo === m ? 'var(--warning-color)' : 'var(--text-secondary)',
                  fontSize: '0.85rem', fontWeight: motivo === m ? '600' : '400',
                  cursor: 'pointer', transition: 'all var(--transition-fast)',
                  fontFamily: 'var(--font-family)'
                }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Doble confirmación */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '1rem', background: 'var(--danger-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)}
            style={{ marginTop: '0.2rem', accentColor: 'var(--danger-color)', width: '16px', height: '16px' }}
            aria-label="Confirmar ajuste de merma" />
          <span style={{ fontSize: '0.875rem', color: 'var(--danger-color)', fontWeight: '500' }}>
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
            Confirmo que este ajuste es correcto e irreversible. Las unidades afectadas quedarán fuera del inventario activo.
          </span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <Button type="button" variant="ghost" onClick={() => { onClose(); reset(); }}>Cancelar</Button>
          <Button type="submit" variant="danger" disabled={loading || !confirmado}>
            {loading ? 'Procesando...' : '🗑️ Confirmar Merma'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
