import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  User, 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  Users as UsersIcon, 
  ChevronRight, 
  ChevronLeft, 
  Save,
  Activity,
  Ruler,
  Weight,
  Thermometer,
  AlertCircle
} from 'lucide-react';

export const SaludStepper = ({ isOpen, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [beneficiarioId, setBeneficiarioId] = useState(null);

  // Form Data
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    hora_atencion: new Date().toTimeString().split(' ')[0].substring(0, 5),
    lugar_atencion: 'Fundación Arupo - Sede Principal',
    paciente_ci: '',
    paciente_nombre: '',
    paciente_direccion: '',
    paciente_telefono: '',
    paciente_email: '',
    acompanante_nombre: '',
    acompanante_telefono: '',
    talla: '',
    peso: '',
    imc: '',
    glucosa: '',
    presion_sistolica: '',
    presion_diastolica: '',
    notas: ''
  });

  // Calculate IMC when talla or peso changes
  useEffect(() => {
    if (formData.talla && formData.peso) {
      const t = parseFloat(formData.talla);
      const p = parseFloat(formData.peso);
      if (t > 0 && p > 0) {
        // Assume talla in cm, convert to m
        const tMeters = t > 3 ? t / 100 : t; // simple check to handle both m and cm
        const imcValue = (p / (tMeters * tMeters)).toFixed(2);
        setFormData(prev => ({ ...prev, imc: imcValue }));
      }
    }
  }, [formData.talla, formData.peso]);

  // Lookup CI
  const handleCILookup = async () => {
    if (!formData.paciente_ci || formData.paciente_ci.length < 5) return;
    try {
      const { data, error: err } = await supabase
        .from('beneficiarios')
        .select('*')
        .eq('cedula', formData.paciente_ci)
        .single();
      
      if (data) {
        setBeneficiarioId(data.id);
        setFormData(prev => ({
          ...prev,
          paciente_nombre: data.nombre,
          paciente_direccion: data.direccion || '',
          paciente_telefono: data.telefono || '',
          paciente_email: data.email || ''
        }));
      }
    } catch (err) {
      // Not found is fine
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.paciente_ci || !formData.paciente_nombre || !formData.paciente_direccion) {
        return setError('Por favor complete los campos obligatorios del paciente.');
      }
    }
    if (step === 2) {
      if (!formData.talla || !formData.peso) {
        return setError('Debe ingresar talla y peso.');
      }
    }
    if (step === 3) {
      if (!formData.glucosa || !formData.presion_sistolica || !formData.presion_diastolica) {
        return setError('Debe ingresar los valores de glucosa y presión arterial.');
      }
    }
    setError('');
    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.from('evaluaciones_salud').insert({
        beneficiario_id: beneficiarioId,
        brigadista_id: profile?.id,
        fecha: formData.fecha,
        hora_atencion: formData.hora_atencion,
        lugar_atencion: formData.lugar_atencion,
        paciente_ci: formData.paciente_ci,
        paciente_nombre: formData.paciente_nombre,
        paciente_direccion: formData.paciente_direccion,
        paciente_telefono: formData.paciente_telefono,
        paciente_email: formData.paciente_email,
        acompanante_nombre: formData.acompanante_nombre,
        acompanante_telefono: formData.acompanante_telefono,
        talla: parseFloat(formData.talla),
        peso: parseFloat(formData.peso),
        imc: parseFloat(formData.imc),
        glucosa: parseFloat(formData.glucosa),
        presion_sistolica: parseInt(formData.presion_sistolica),
        presion_diastolica: parseInt(formData.presion_diastolica),
        notas: formData.notas
      });

      if (err) throw err;
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar la evaluación.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '2px', background: 'var(--border-color)', zIndex: 0, transform: 'translateY(-50%)' }}></div>
      {[1, 2, 3, 4].map(num => (
        <div 
          key={num} 
          style={{ 
            width: '32px', 
            height: '32px', 
            borderRadius: '50%', 
            background: step >= num ? 'var(--primary-color)' : 'var(--bg-surface)', 
            color: step >= num ? 'white' : 'var(--text-tertiary)',
            border: `2px solid ${step >= num ? 'var(--primary-color)' : 'var(--border-color)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '700',
            fontSize: '0.85rem',
            zIndex: 1,
            transition: 'all 0.3s ease'
          }}
        >
          {num}
        </div>
      ))}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva Evaluación de Salud"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Button variant="ghost" onClick={step === 1 ? onClose : prevStep} disabled={loading}>
            {step === 1 ? 'Cancelar' : 'Anterior'}
          </Button>
          <Button variant="primary" onClick={step === 4 ? handleSave : nextStep} disabled={loading}>
            {loading ? 'Guardando...' : step === 4 ? 'Finalizar y Guardar' : 'Siguiente'}
          </Button>
        </div>
      }
    >
      <div style={{ minHeight: '400px' }}>
        {renderStepIndicator()}

        {error && (
          <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Datos de Atención y Paciente */}
        {step === 1 && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label className="label">Fecha *</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input type="date" name="fecha" className="input-field" style={{ paddingLeft: '2.5rem' }} value={formData.fecha} onChange={handleInputChange} required />
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label className="label">Hora *</label>
                <div style={{ position: 'relative' }}>
                  <Clock size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input type="time" name="hora_atencion" className="input-field" style={{ paddingLeft: '2.5rem' }} value={formData.hora_atencion} onChange={handleInputChange} required />
                </div>
              </div>
            </div>

            <div>
              <label className="label">Lugar de Atención *</label>
              <div style={{ position: 'relative' }}>
                <MapPin size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input type="text" name="lugar_atencion" className="input-field" style={{ paddingLeft: '2.5rem' }} value={formData.lugar_atencion} onChange={handleInputChange} required />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--primary-color)' }}>Datos del Paciente</h3>
              <div className="grid-responsive" style={{ gap: '1rem' }}>
                <div>
                  <label className="label">CI / Documento *</label>
                  <input 
                    type="text" 
                    name="paciente_ci" 
                    className="input-field" 
                    value={formData.paciente_ci} 
                    onChange={handleInputChange} 
                    onBlur={handleCILookup}
                    placeholder="Ingrese CI para buscar..." 
                    required 
                  />
                </div>
                <div>
                  <label className="label">Nombre Completo *</label>
                  <input type="text" name="paciente_nombre" className="input-field" value={formData.paciente_nombre} onChange={handleInputChange} required />
                </div>
              </div>
              
              <div className="grid-responsive" style={{ gap: '1rem', marginTop: '1rem' }}>
                <div>
                  <label className="label">Teléfono *</label>
                  <input type="text" name="paciente_telefono" className="input-field" value={formData.paciente_telefono} onChange={handleInputChange} required />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" name="paciente_email" className="input-field" value={formData.paciente_email} onChange={handleInputChange} />
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label className="label">Dirección Domicilio *</label>
                <input type="text" name="paciente_direccion" className="input-field" value={formData.paciente_direccion} onChange={handleInputChange} required />
              </div>

              <div className="grid-responsive" style={{ gap: '1rem', marginTop: '1rem' }}>
                <div>
                  <label className="label">Nombre Acompañante</label>
                  <input type="text" name="acompanante_nombre" className="input-field" value={formData.acompanante_nombre} onChange={handleInputChange} />
                </div>
                <div>
                  <label className="label">Teléfono Acompañante</label>
                  <input type="text" name="acompanante_telefono" className="input-field" value={formData.acompanante_telefono} onChange={handleInputChange} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Medidas Físicas */}
        {step === 2 && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center', paddingTop: '1rem' }}>
            <div style={{ textAlign: 'center', maxWidth: '400px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>Medidas Físicas</h3>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Ingrese la talla y el peso del paciente para calcular el IMC automáticamente.</p>
            </div>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
              <div className="card" style={{ padding: '2rem', width: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <Ruler size={40} color="var(--primary-color)" />
                <label className="label" style={{ textAlign: 'center' }}>Talla (cm)</label>
                <input 
                  type="number" 
                  name="talla" 
                  className="input-field" 
                  style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: '700' }} 
                  value={formData.talla} 
                  onChange={handleInputChange} 
                  placeholder="0"
                />
              </div>

              <div className="card" style={{ padding: '2rem', width: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <Weight size={40} color="var(--primary-color)" />
                <label className="label" style={{ textAlign: 'center' }}>Peso (kg)</label>
                <input 
                  type="number" 
                  name="peso" 
                  className="input-field" 
                  style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: '700' }} 
                  value={formData.peso} 
                  onChange={handleInputChange} 
                  placeholder="0"
                />
              </div>
            </div>

            {formData.imc && (
              <div className="card" style={{ 
                padding: '1.5rem 3rem', 
                background: 'linear-gradient(135deg, var(--primary-color), #10b981)', 
                color: 'white', 
                borderRadius: 'var(--radius-lg)',
                textAlign: 'center',
                boxShadow: '0 10px 25px rgba(16,185,129,0.3)'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', opacity: 0.9 }}>Índice de Masa Corporal (IMC)</div>
                <div style={{ fontSize: '3rem', fontWeight: '900' }}>{formData.imc}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                  {formData.imc < 18.5 && 'Bajo peso'}
                  {formData.imc >= 18.5 && formData.imc < 25 && 'Peso normal'}
                  {formData.imc >= 25 && formData.imc < 30 && 'Sobrepeso'}
                  {formData.imc >= 30 && 'Obesidad'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Examen Médico */}
        {step === 3 && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center', paddingTop: '1rem' }}>
            <div style={{ textAlign: 'center', maxWidth: '400px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>Examen Médico</h3>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Registre los niveles de glucosa y la presión arterial.</p>
            </div>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
              <div className="card" style={{ padding: '2rem', width: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <Activity size={40} color="#ef4444" />
                <label className="label" style={{ textAlign: 'center' }}>Glucosa (mg/dL)</label>
                <input 
                  type="number" 
                  name="glucosa" 
                  className="input-field" 
                  style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: '700' }} 
                  value={formData.glucosa} 
                  onChange={handleInputChange} 
                  placeholder="0"
                />
              </div>

              <div className="card" style={{ padding: '2rem', width: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <Activity size={40} color="#3b82f6" />
                <label className="label" style={{ textAlign: 'center' }}>Presión Arterial (Sist/Diast)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input 
                    type="number" 
                    name="presion_sistolica" 
                    className="input-field" 
                    style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: '700', width: '100px' }} 
                    value={formData.presion_sistolica} 
                    onChange={handleInputChange} 
                    placeholder="120"
                  />
                  <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-tertiary)' }}>/</span>
                  <input 
                    type="number" 
                    name="presion_diastolica" 
                    className="input-field" 
                    style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: '700', width: '100px' }} 
                    value={formData.presion_diastolica} 
                    onChange={handleInputChange} 
                    placeholder="80"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Resumen y Notas */}
        {step === 4 && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary-color)' }}>Resumen de Evaluación</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Paciente</div>
                <div style={{ fontWeight: '700' }}>{formData.paciente_nombre}</div>
                <div style={{ fontSize: '0.8rem' }}>CI: {formData.paciente_ci}</div>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Físico</div>
                <div style={{ fontWeight: '700' }}>IMC: {formData.imc}</div>
                <div style={{ fontSize: '0.8rem' }}>{formData.peso} kg / {formData.talla} cm</div>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Signos</div>
                <div style={{ fontWeight: '700' }}>{formData.presion_sistolica}/{formData.presion_diastolica} mmHg</div>
                <div style={{ fontSize: '0.8rem' }}>Glucosa: {formData.glucosa} mg/dL</div>
              </div>
            </div>

            <div>
              <label className="label">Notas Adicionales / Observaciones</label>
              <textarea 
                name="notas" 
                className="input-field" 
                style={{ minHeight: '120px', resize: 'vertical' }} 
                value={formData.notas} 
                onChange={handleInputChange} 
                placeholder="Escriba aquí cualquier observación relevante encontrada durante el examen..."
              ></textarea>
            </div>

            <div style={{ padding: '1rem', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Al guardar, esta evaluación quedará registrada bajo su perfil de brigadista (**{profile?.nombre}**) y estará disponible para revisión por el equipo administrativo.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
