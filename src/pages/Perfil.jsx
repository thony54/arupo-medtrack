import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Key, Eye, EyeOff, CheckCircle, AlertCircle, FileText, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import './pages.css';

export const Perfil = () => {
  const { profile, user, role, isSuperAdmin, isBrigadista, isVoluntario } = useAuth();
  
  // Estados para cambio de contraseña
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estadísticas Personales o Rol
  const [metrics, setMetrics] = useState({
    lastActive: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long' }),
    totalRecords: 0
  });

  useEffect(() => {
    fetchRoleSpecificMetrics();
  }, [role]);

  const fetchRoleSpecificMetrics = async () => {
    try {
      if (!supabase) return;
      
      if (isBrigadista || isSuperAdmin) {
        // Conteo de medicamentos activos
        const { count } = await supabase
          .from('medicinas')
          .select('*', { count: 'exact', head: true });
        setMetrics(prev => ({ ...prev, totalRecords: count || 0 }));
      } else if (isVoluntario) {
        // Conteo de beneficiarios activos
        const { count } = await supabase
          .from('beneficiarios')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'Activo');
        setMetrics(prev => ({ ...prev, totalRecords: count || 0 }));
      }
    } catch (err) {
      console.error('Error cargando métricas de perfil:', err);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setUpdating(true);
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setSuccess('¡Contraseña actualizada correctamente!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordForm(false);
        setSuccess('');
      }, 2500);
    } catch (err) {
      setError(err.message || 'Error al actualizar la contraseña.');
    } finally {
      setUpdating(false);
    }
  };

  const getRoleTitle = () => {
    if (isSuperAdmin) return 'Administrador del Sistema';
    if (isBrigadista) return 'Especialista Médico / Brigadista';
    if (isVoluntario) return 'Coordinador de Donaciones / Voluntario';
    return 'Usuario Operativo';
  };

  const getRoleLabel = () => {
    if (isSuperAdmin) return 'Super Admin';
    if (isBrigadista) return 'Brigadista';
    if (isVoluntario) return 'Voluntario';
    return 'General';
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '2rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mi Perfil</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Gestiona tus credenciales y visualiza tu nivel de acceso.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Card Principal de Perfil */}
        <div className="card glass" style={{ 
          padding: '2rem', 
          position: 'relative', 
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}>
          {/* Fondo decorativo */}
          <div style={{ 
            position: 'absolute', 
            top: '-40px', 
            right: '-40px', 
            width: '120px', 
            height: '120px', 
            borderRadius: '50%', 
            background: isBrigadista ? 'var(--primary-light)' : isVoluntario ? '#ede9fe' : 'var(--danger-bg)', 
            opacity: 0.4,
            filter: 'blur(20px)',
            zIndex: 0
          }} />

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', zIndex: 1, position: 'relative', flexWrap: 'wrap' }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, var(--primary-color), #10b981)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              fontWeight: '700',
              boxShadow: 'var(--shadow-md)'
            }}>
              {(profile?.nombre || 'U').substring(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>{profile?.nombre || 'Usuario'}</h2>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Mail size={16} style={{ opacity: 0.7 }} /> {user?.email}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.35rem',
                  background: isBrigadista ? 'var(--success-bg)' : isVoluntario ? '#ede9fe' : 'var(--danger-bg)', 
                  color: isBrigadista ? 'var(--success-color)' : isVoluntario ? '#7c3aed' : 'var(--danger-color)', 
                  padding: '0.3rem 0.75rem', 
                  borderRadius: 'var(--radius-pill)', 
                  fontSize: '0.8rem', 
                  fontWeight: '700',
                  textTransform: 'uppercase'
                }}>
                  <Shield size={14} />
                  {getRoleLabel()}
                </span>
                <span style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  background: 'var(--bg-base)', 
                  color: 'var(--text-secondary)', 
                  padding: '0.3rem 0.75rem', 
                  borderRadius: 'var(--radius-pill)', 
                  fontSize: '0.8rem', 
                  fontWeight: '600',
                  border: '1px solid var(--border-color)'
                }}>
                  Miembro Activo
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Grid de Dos Columnas */}
        <div className="grid-responsive" style={{ gap: '1.5rem' }}>
          
          {/* Resumen de Privilegios */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={20} color="var(--primary-color)" /> Alcance del Perfil
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: '700', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>Cargo Designado</div>
                <div style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)' }}>{getRoleTitle()}</div>
              </div>

              <div style={{ height: '1px', background: 'var(--border-color)' }} />

              <div>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: '700', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>Permisos Autorizados</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {isSuperAdmin && (
                    <>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <CheckCircle size={15} color="var(--success-color)" /> Gestión total del Inventario y Catálogo
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <CheckCircle size={15} color="var(--success-color)" /> Administración de Personal (Brigadistas y Voluntarios)
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <CheckCircle size={15} color="var(--success-color)" /> Registro y Control de Donantes y Beneficiarios
                      </li>
                    </>
                  )}
                  {isBrigadista && (
                    <>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <CheckCircle size={15} color="var(--success-color)" /> Acceso completo a Inventario Médico
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <CheckCircle size={15} color="var(--success-color)" /> Visualización y edición del Catálogo Farmacéutico
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <CheckCircle size={15} color="var(--success-color)" /> Operación de Entradas y Salidas FEFO
                      </li>
                    </>
                  )}
                  {isVoluntario && (
                    <>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <CheckCircle size={15} color="var(--success-color)" /> Gestión de Fichas de Beneficiarios
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <CheckCircle size={15} color="var(--success-color)" /> Registro y contacto de Organizaciones Donantes
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <CheckCircle size={15} color="var(--success-color)" /> Gestión de Donaciones Generales (No médicas)
                      </li>
                    </>
                  )}
                </ul>
              </div>

              <div style={{ height: '1px', background: 'var(--border-color)' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  {isBrigadista ? 'Medicamentos registrados:' : isVoluntario ? 'Beneficiarios activos:' : 'Registros globales:'}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary-color)' }}>{metrics.totalRecords}</div>
              </div>
            </div>
          </div>

          {/* Seguridad y Acceso */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key size={20} color="#f59e0b" /> Seguridad de la Cuenta
            </h3>
            
            {!showPasswordForm ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Te recomendamos cambiar periódicamente tu contraseña para asegurar el acceso a la base de datos de la fundación.
                </p>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', padding: '0.5rem 0' }}>
                  Última sesión activa hoy.
                </div>
                <Button variant="outline" onClick={() => setShowPasswordForm(true)} style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: '0.5rem' }}>
                  <Key size={16} /> Cambiar Contraseña
                </Button>
              </div>
            ) : (
              <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {error && (
                  <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div style={{ padding: '0.75rem', background: 'var(--success-bg)', color: 'var(--success-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem' }}>
                    <CheckCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{success}</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Nueva Contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showNewPass ? "text" : "password"} 
                      className="input-field" 
                      style={{ marginBottom: 0, width: '100%', paddingRight: '2.5rem' }}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={updating}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Confirmar Nueva Contraseña</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    style={{ marginBottom: 0, width: '100%' }}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    disabled={updating}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <Button type="button" variant="ghost" onClick={() => { setShowPasswordForm(false); setError(''); }} disabled={updating} style={{ flex: 1, justifyContent: 'center' }}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="primary" disabled={updating} style={{ flex: 1, justifyContent: 'center' }}>
                    {updating ? 'Actualizando...' : 'Guardar'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
