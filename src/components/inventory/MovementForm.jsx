import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { Input } from '../components/../ui/Input';
import { Select } from '../components/../ui/Select';
import { Button } from '../components/../ui/Button';

export const MovementForm = ({ isOpen, onClose, onSuccess }) => {
  const [tipo, setTipo] = useState('Entrada');
  const [cantidad, setCantidad] = useState('');
  const [medicinaId, setMedicinaId] = useState('');
  const [origenDestino, setOrigenDestino] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [medicinasList, setMedicinasList] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchMedicinas();
    }
  }, [isOpen]);

  const fetchMedicinas = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('medicinas').select('id, nombre, concentracion').order('nombre');
      if (error) throw error;
      setMedicinasList(
        data.map(m => ({ 
          value: m.id, 
          label: `${m.nombre} ${m.concentracion ? m.concentracion : ''}`.trim() 
        }))
      );
    } catch (err) {
      console.error('Error fetching medicinas:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!medicinaId || !cantidad || Number(cantidad) <= 0) {
      setError('Por favor completa todos los campos correctamente.');
      return;
    }

    try {
      setLoading(true);
      if (supabase) {
        const { error: insertError } = await supabase
          .from('movimientos')
          .insert({
            medicina_id: medicinaId,
            tipo: tipo,
            cantidad: Number(cantidad),
            origen_destino: origenDestino
          });
        
        if (insertError) throw insertError;
      } else {
        // Simulate network request for MVP demo
        await new Promise(r => setTimeout(r, 1000));
      }
      
      onSuccess();
      // Reset form
      setCantidad('');
      setMedicinaId('');
      setOrigenDestino('');
    } catch (err) {
      setError(err.message || 'Error al guardar el movimiento. Revisa el stock disponible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Movimiento">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }} role="alert">
            {error}
          </div>
        )}

        <Select
          id="tipo"
          label="Tipo de Movimiento"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          options={[
            { value: 'Entrada', label: 'Entrada (Recepcionar)' },
            { value: 'Salida', label: 'Salida (Despachar)' }
          ]}
        />

        {/* AI Auto-complete simulation field could go here, for now manual select */}
        <Select
          id="medicina"
          label="Medicamento"
          value={medicinaId}
          onChange={(e) => setMedicinaId(e.target.value)}
          options={medicinasList}
          placeholder="Selecciona un medicamento"
        />

        <Input
          id="cantidad"
          label="Cantidad"
          type="number"
          min="1"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          placeholder="Ej. 100"
        />

        <Input
          id="origenDestino"
          label={tipo === 'Entrada' ? 'Donante / Origen' : 'Destino / Paciente'}
          value={origenDestino}
          onChange={(e) => setOrigenDestino(e.target.value)}
          placeholder="Ej. Hospital Central"
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Descartar Cambios
          </Button>
          <Button type="submit" variant="success" disabled={loading}>
            {loading ? 'Guardando...' : 'Confirmar Registro'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
