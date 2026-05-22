import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Mail, Shield, Key, Eye, EyeOff, CheckCircle, AlertCircle, 
  FileText, Award, LogOut, Edit2, Check, X, Settings,
  Calendar, TrendingUp, HeartHandshake, Users, Database, Activity 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { ProfileDropdown } from '../components/layout/ProfileDropdown';
import './pages.css';

export const Perfil = () => {
  const { profile, user, role, isSuperAdmin, isBrigadista, isVoluntario, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  // Estados para cambio de contraseña
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados para edición de perfil
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempNombre, setTempNombre] = useState(profile?.nombre || '');
  const [showEmail, setShowEmail] = useState(false);

  // Estadísticas Personales o Rol
  const [metrics, setMetrics] = useState({
    lastActive: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long' }),
    totalRecords: 0
  });

  useEffect(() => {
    fetchRoleSpecificMetrics();
    if (profile?.nombre) setTempNombre(profile.nombre);
  }, [role, profile]);

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

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
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

  const handleUpdateName = async () => {
    if (!tempNombre.trim()) {
      setError('El nombre no puede estar vacío.');
      return;
    }
    
    setUpdating(true);
    setError('');
    
    try {
      const { error: updateError } = await supabase
        .from('perfiles')
        .update({ nombre: tempNombre.trim() })
        .eq('id', user.id);
        
      if (updateError) throw updateError;
      
      setSuccess('Nombre actualizado.');
      setIsEditingName(false);
      refreshProfile();
      // El AuthContext debería refrescarse automáticamente si usamos onAuthStateChange, 
      // pero aquí forzamos un refresco si es necesario o dejamos que React maneje el estado local.
    } catch (err) {
      setError(err.message || 'Error al actualizar el nombre.');
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

  const getRoleColor = (rol) => {
    if (isSuperAdmin) return 'var(--danger-color)';
    if (isBrigadista) return 'var(--success-color)';
    if (isVoluntario) return '#7c3aed';
    return 'var(--text-secondary)';
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '850px', margin: '0 auto', paddingBottom: '3rem', width: '100%' }}>
      <div className="page-header" style={{ marginBottom: '1.75rem' }}>
        <div>
          <h1 className="page-title">Mi Perfil</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Gestiona tus datos personales, credenciales y visualiza tu nivel de acceso autorizado.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Card Principal de Perfil Premium */}
        <div className="card glass profile-hero-card">
          {/* Fondo dinámico difuminado según el rol */}
          <div className="profile-hero-bg" style={{ 
            background: isBrigadista 
              ? 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, rgba(13, 148, 136, 0.05) 70%, transparent 100%)' 
              : isVoluntario 
                ? 'radial-gradient(circle, rgba(124, 58, 237, 0.4) 0%, rgba(168, 85, 247, 0.05) 70%, transparent 100%)' 
                : 'radial-gradient(circle, rgba(225, 29, 72, 0.4) 0%, rgba(13, 148, 136, 0.05) 70%, transparent 100%)'
          }} />

          {/* Cog Dropdown in Top Right of Card */}
          <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 10 }}>
            <ProfileDropdown />
          </div>

          <div className="profile-info-content">
            {/* Avatar con Anillo de Animación Dinámica */}
            <div className="premium-avatar-container">
              <div className="premium-avatar" style={{ 
                background: isBrigadista 
                  ? 'linear-gradient(135deg, var(--success-color), var(--primary-color))'
                  : isVoluntario 
                    ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                    : 'linear-gradient(135deg, var(--danger-color), #f43f5e)'
              }}>
                {(profile?.nombre || 'U').substring(0, 2).toUpperCase()}
              </div>
              <div className="premium-avatar-ring" style={{ 
                borderColor: getRoleColor(profile?.rol),
                opacity: 0.5 
              }} />
            </div>

            <div style={{ flex: 1, minWidth: '240px' }}>
              <div className="profile-name-area">
                {isEditingName ? (
                  <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '340px', alignItems: 'center' }}>
                    <input 
                      className="input-field" 
                      style={{ marginBottom: 0, padding: '0.45rem 0.85rem', fontSize: '1.25rem', fontWeight: '700' }}
                      value={tempNombre}
                      onChange={e => setTempNombre(e.target.value)}
                      autoFocus
                      disabled={updating}
                    />
                    <Button variant="primary" onClick={handleUpdateName} disabled={updating} style={{ padding: '0.5rem 0.75rem', height: '38px', minWidth: '38px' }} title="Guardar">
                      <Check size={16} />
                    </Button>
                    <Button variant="ghost" onClick={() => { setIsEditingName(false); setTempNombre(profile?.nombre || ''); }} style={{ padding: '0.5rem 0.75rem', height: '38px', minWidth: '38px' }} title="Cancelar">
                      <X size={16} />
                    </Button>
                  </div>
                ) : (
                  <>
                    <h2 className="profile-name-title">{profile?.nombre || 'Usuario Operativo'}</h2>
                    <button 
                      onClick={() => setIsEditingName(true)}
                      className="edit-name-btn"
                      title="Editar nombre completo"
                    >
                      <Edit2 size={14} />
                    </button>
                  </>
                )}
              </div>
              
              <div className="email-badge-container">
                <Mail size={16} style={{ opacity: 0.7 }} /> 
                <span style={{ fontWeight: '500' }}>{showEmail ? user?.email : '••••••••@••••.•••'}</span>
                <button 
                  onClick={() => setShowEmail(!showEmail)}
                  className="toggle-email-btn"
                >
                  {showEmail ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              <div className="profile-tag-container">
                <span style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.4rem',
                  background: isBrigadista ? 'var(--success-bg)' : isVoluntario ? '#ede9fe' : 'var(--danger-bg)', 
                  color: isBrigadista ? 'var(--success-color)' : isVoluntario ? '#7c3aed' : 'var(--danger-color)', 
                  padding: '0.35rem 0.85rem', 
                  borderRadius: 'var(--radius-pill)', 
                  fontSize: '0.78rem', 
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  border: `1px solid ${isBrigadista ? 'rgba(16,185,129,0.15)' : isVoluntario ? 'rgba(124,58,237,0.15)' : 'rgba(225,29,72,0.15)'}`
                }}>
                  <Shield size={14} />
                  {getRoleLabel(profile?.rol)}
                </span>
                <span style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.35rem',
                  background: 'var(--bg-surface-hover)', 
                  color: 'var(--text-secondary)', 
                  padding: '0.35rem 0.85rem', 
                  borderRadius: 'var(--radius-pill)', 
                  fontSize: '0.78rem', 
                  fontWeight: '600',
                  border: '1px solid var(--border-color)'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success-color)' }} />
                  Sesión Activa
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Grid de Métricas Premium Interactivas */}
        <div className="premium-metrics-grid animate-fade-in">
          {/* Tarjeta de Última Actividad */}
          <div className="premium-metric-card card glass">
            <div className="premium-metric-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary-color)' }}>
              <Calendar size={20} />
            </div>
            <div className="metric-details">
              <span className="metric-label-text">Fecha de Actividad</span>
              <span className="metric-val-num" style={{ fontSize: '1.2rem' }}>{metrics.lastActive}</span>
            </div>
          </div>

          {/* Tarjeta de Registros Realizados */}
          <div className="premium-metric-card card glass">
            <div className="premium-metric-icon" style={{ 
              background: isBrigadista ? 'var(--success-bg)' : isVoluntario ? '#ede9fe' : 'var(--danger-bg)', 
              color: isBrigadista ? 'var(--success-color)' : isVoluntario ? '#7c3aed' : 'var(--danger-color)'
            }}>
              {isBrigadista ? <Database size={20} /> : isVoluntario ? <Users size={20} /> : <TrendingUp size={20} />}
            </div>
            <div className="metric-details">
              <span className="metric-label-text">
                {isBrigadista ? 'Medicinas Activas' : isVoluntario ? 'Beneficiarios Activos' : 'Registros en Sistema'}
              </span>
              <span className="metric-val-num">{metrics.totalRecords}</span>
            </div>
          </div>

          {/* Tarjeta de Estado de Seguridad */}
          <div className="premium-metric-card card glass">
            <div className="premium-metric-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning-color)' }}>
              <Shield size={20} />
            </div>
            <div className="metric-details">
              <span className="metric-label-text">Acceso Autorizado</span>
              <span className="metric-val-num" style={{ fontSize: '1.15rem', color: 'var(--warning-color)' }}>Protegido</span>
            </div>
          </div>
        </div>

        {/* Grid de Dos Columnas para Privilegios y Seguridad */}
        <div className="grid-responsive" style={{ gap: '1.5rem' }}>
          
          {/* Tarjeta de Privilegios Autorizados */}
          <div className="card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <Award size={20} color="var(--primary-color)" /> Privilegios Autorizados
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: '700', color: 'var(--text-tertiary)', marginBottom: '0.35rem' }}>Nivel de Acceso</div>
                <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getRoleColor(profile?.rol) }} />
                  {getRoleTitle()}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: '700', color: 'var(--text-tertiary)', marginBottom: '0.65rem' }}>Operaciones Permitidas</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {isSuperAdmin && (
                    <>
                      <div className="privilege-item">
                        <CheckCircle size={16} style={{ color: 'var(--success-color)', flexShrink: 0, marginTop: '2px' }} />
                        <span>Gestión y auditoría total del Inventario Médico y Catálogo.</span>
                      </div>
                      <div className="privilege-item">
                        <CheckCircle size={16} style={{ color: 'var(--success-color)', flexShrink: 0, marginTop: '2px' }} />
                        <span>Administración, registro y eliminación de Brigadistas y Voluntarios.</span>
                      </div>
                      <div className="privilege-item">
                        <CheckCircle size={16} style={{ color: 'var(--success-color)', flexShrink: 0, marginTop: '2px' }} />
                        <span>Control de Fichas Médicas de Beneficiarios y Organizaciones Donantes.</span>
                      </div>
                    </>
                  )}
                  {isBrigadista && (
                    <>
                      <div className="privilege-item">
                        <CheckCircle size={16} style={{ color: 'var(--success-color)', flexShrink: 0, marginTop: '2px' }} />
                        <span>Registro de Ingreso de Lotes Médicos y control de vencimientos.</span>
                      </div>
                      <div className="privilege-item">
                        <CheckCircle size={16} style={{ color: 'var(--success-color)', flexShrink: 0, marginTop: '2px' }} />
                        <span>Gestión del Catálogo Farmacéutico de la fundación.</span>
                      </div>
                      <div className="privilege-item">
                        <CheckCircle size={16} style={{ color: 'var(--success-color)', flexShrink: 0, marginTop: '2px' }} />
                        <span>Entrega y salida de Medicamentos con lógica FEFO.</span>
                      </div>
                    </>
                  )}
                  {isVoluntario && (
                    <>
                      <div className="privilege-item">
                        <CheckCircle size={16} style={{ color: 'var(--success-color)', flexShrink: 0, marginTop: '2px' }} />
                        <span>Registro y seguimiento completo de Fichas de Beneficiarios.</span>
                      </div>
                      <div className="privilege-item">
                        <CheckCircle size={16} style={{ color: 'var(--success-color)', flexShrink: 0, marginTop: '2px' }} />
                        <span>Administración de base de datos de Donantes y Aliados.</span>
                      </div>
                      <div className="privilege-item">
                        <CheckCircle size={16} style={{ color: 'var(--success-color)', flexShrink: 0, marginTop: '2px' }} />
                        <span>Ingreso y salida de donaciones de insumos generales (no médicos).</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tarjeta de Seguridad y Acceso Premium */}
          <div className="card premium-security-card">
            <div className="premium-security-header">
              <div className="security-icon-container">
                <Key size={18} />
              </div>
              <span>Seguridad de la Cuenta</span>
            </div>
            
            {!showPasswordForm ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                  Te aconsejamos actualizar tu clave de acceso de manera periódica para proteger tu cuenta y la información confidencial de la fundación.
                </p>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', background: 'var(--bg-surface-hover)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success-color)' }} />
                  <span>Tu conexión está cifrada de extremo a extremo.</span>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setShowPasswordForm(true)} 
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: '0.5rem', padding: '0.65rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: '600' }}
                >
                  <Key size={16} /> Cambiar Contraseña
                </Button>
              </div>
            ) : (
              <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                {error && (
                  <div className="status-alert danger">
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="status-alert success">
                    <CheckCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{success}</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Nueva Contraseña</label>
                  <div className="input-with-icon">
                    <Key size={16} className="input-icon-left" />
                    <input 
                      type={showNewPass ? "text" : "password"} 
                      className="input-field" 
                      style={{ marginBottom: 0, width: '100%', paddingRight: '2.75rem' }}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                      disabled={updating}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="password-toggle-btn"
                      title={showNewPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Confirmar Nueva Contraseña</label>
                  <div className="input-with-icon">
                    <Key size={16} className="input-icon-left" />
                    <input 
                      type="password" 
                      className="input-field" 
                      style={{ marginBottom: 0, width: '100%' }}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Confirma la misma contraseña"
                      required
                      disabled={updating}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => { setShowPasswordForm(false); setError(''); }} 
                    disabled={updating} 
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    disabled={updating} 
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {updating ? 'Guardando...' : 'Actualizar'}
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
