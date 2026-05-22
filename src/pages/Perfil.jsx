import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Mail, Shield, Key, Eye, EyeOff, CheckCircle, AlertCircle, 
  FileText, Award, LogOut, Edit2, Check, X, Settings,
  Calendar, TrendingUp, HeartHandshake, Users, Database, Activity,
  Flame, AlertTriangle, Camera, Phone, MapPin, Briefcase, Clock, Building
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { ProfileDropdown } from '../components/layout/ProfileDropdown';
import { Modal } from '../components/ui/Modal';
import './pages.css';

export const Perfil = () => {
  const { profile, user, role, isSuperAdmin, isBrigadista, isVoluntario, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  // Exclusividad de desarrollador para thony.karter
  const isDeveloper = user?.email?.toLowerCase()?.includes('thony.karter');

  // Estados para Depuración de Fábrica (Exclusivo thony.karter)
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  
  // Estados para cambio de contraseña
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados para edición de perfil y control de pestañas
  const [activeTab, setActiveTab] = useState('informacion'); // 'informacion', 'editar', 'privilegios'
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempNombre, setTempNombre] = useState(profile?.nombre || '');
  const [showEmail, setShowEmail] = useState(false);

  // Estados para información adicional de perfil por rol
  const [tempTelefono, setTempTelefono] = useState('');
  const [tempDireccion, setTempDireccion] = useState('');
  const [tempEspecialidad, setTempEspecialidad] = useState('');
  const [tempLicenciaMedica, setTempLicenciaMedica] = useState('');
  const [tempInstitucion, setTempInstitucion] = useState('');
  const [tempAreaApoyo, setTempAreaApoyo] = useState('');
  const [tempDisponibilidad, setTempDisponibilidad] = useState('');
  
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Estadísticas Personales o Rol
  const [metrics, setMetrics] = useState({
    lastActive: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long' }),
    totalRecords: 0
  });

  useEffect(() => {
    fetchRoleSpecificMetrics();
    if (profile) {
      setTempNombre(profile.nombre || '');
      setTempTelefono(profile.telefono || '');
      setTempDireccion(profile.direccion || '');
      setTempEspecialidad(profile.especialidad || '');
      setTempLicenciaMedica(profile.licencia_medica || '');
      setTempInstitucion(profile.institucion || '');
      setTempAreaApoyo(profile.area_apoyo || '');
      setTempDisponibilidad(profile.disponibilidad || '');
    }
  }, [role, profile]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecciona un archivo de imagen válido.');
      return;
    }

    setAvatarUploading(true);
    setError('');
    setSuccess('');

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const max_size = 256;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);

          try {
            const { error: updateError } = await supabase
              .from('perfiles')
              .update({ avatar: compressedBase64 })
              .eq('id', user.id);

            if (updateError) {
              if (updateError.message?.includes('column "avatar" of relation "perfiles" does not exist') || updateError.code === '42703') {
                throw new Error('La base de datos requiere una actualización. Por favor, ejecuta el script "schema_v15.sql" en el SQL Editor de Supabase para habilitar las fotos de perfil.');
              }
              throw updateError;
            }

            setSuccess('¡Foto de perfil actualizada con éxito!');
            refreshProfile();
            setTimeout(() => setSuccess(''), 4000);
          } catch (dbErr) {
            console.error('Error de base de datos:', dbErr);
            setError(dbErr.message || 'Error al guardar la foto de perfil en la base de datos.');
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error al procesar la imagen.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveRoleFields = async () => {
    setUpdating(true);
    setError('');
    setSuccess('');

    try {
      const updates = {
        telefono: tempTelefono.trim(),
        direccion: tempDireccion.trim(),
      };

      if (isBrigadista) {
        updates.especialidad = tempEspecialidad.trim();
        updates.licencia_medica = tempLicenciaMedica.trim();
        updates.institucion = tempInstitucion.trim();
      }

      if (isVoluntario) {
        updates.area_apoyo = tempAreaApoyo.trim();
        updates.disponibilidad = tempDisponibilidad.trim();
      }

      const { error: updateError } = await supabase
        .from('perfiles')
        .update(updates)
        .eq('id', user.id);

      if (updateError) {
        if (updateError.message?.includes('does not exist') || updateError.code === '42703') {
          throw new Error('La base de datos requiere una actualización. Por favor, ejecuta el script "schema_v15.sql" en el SQL Editor de Supabase para habilitar los campos avanzados de perfil.');
        }
        throw updateError;
      }

      setSuccess('¡Datos del perfil actualizados correctamente!');
      refreshProfile();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al guardar los datos del perfil.');
    } finally {
      setUpdating(false);
    }
  };

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

  const handleFactoryReset = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'DEPURAR') {
      setResetError('Por favor, escribe exactamente la palabra DEPURAR para continuar.');
      return;
    }

    setIsResetting(true);
    setResetError('');
    setResetSuccess('');

    try {
      // 1. Borrar Movimientos (Historial de transacciones)
      const { error: errMov } = await supabase
        .from('movimientos')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (errMov) throw new Error(`Error en movimientos: ${errMov.message}`);

      // 2. Borrar Lotes (Control unitario FEFO/FIFO)
      const { error: errLot } = await supabase
        .from('lotes')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (errLot) throw new Error(`Error en lotes: ${errLot.message}`);

      // 3. Borrar Medicinas (Catálogo de productos)
      const { error: errMed } = await supabase
        .from('medicinas')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (errMed) throw new Error(`Error en catálogo (medicinas): ${errMed.message}`);

      // 4. Borrar Evaluaciones de Salud
      const { error: errEv } = await supabase
        .from('evaluaciones_salud')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (errEv) throw new Error(`Error en evaluaciones de salud: ${errEv.message}`);

      // 5. Borrar Beneficiarios (Directorio)
      const { error: errBen } = await supabase
        .from('beneficiarios')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (errBen) throw new Error(`Error en beneficiarios: ${errBen.message}`);

      // 6. Borrar Donantes (Directorio)
      const { error: errDon } = await supabase
        .from('donantes')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (errDon) throw new Error(`Error en donantes: ${errDon.message}`);

      setResetSuccess('¡Sistema restaurado con éxito! Se han depurado los 5 componentes seleccionados de fábrica.');
      setResetConfirmText('');
      
      // Actualizar métricas del perfil
      fetchRoleSpecificMetrics();

      // Notificar a otras vistas
      window.dispatchEvent(new Event('inventario-updated'));
      window.dispatchEvent(new Event('evaluaciones-updated'));
      window.dispatchEvent(new Event('beneficiarios-updated'));
      window.dispatchEvent(new Event('donantes-updated'));

      setTimeout(() => {
        setShowResetModal(false);
        setResetSuccess('');
      }, 3500);
    } catch (err) {
      console.error('Error durante la depuración de fábrica:', err);
      setResetError(err.message || 'Ocurrió un error inesperado al restablecer el sistema.');
    } finally {
      setIsResetting(false);
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
        <div className="card glass" style={{ padding: 0, overflow: 'visible', position: 'relative', border: '1px solid var(--border-color)' }}>
          
          {/* Banner superior premium */}
          <div className="arupo-profile-banner-container">
            <div className="arupo-profile-banner" />
            
            {/* Cog Dropdown in Top Right of Banner */}
            <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 20 }}>
              <ProfileDropdown />
            </div>

            {/* Hidden file input for avatar upload */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAvatarChange} 
              style={{ display: 'none' }} 
              accept="image/*" 
            />

            {/* Avatar Uploader con Anillo Concéntrico de Arupo y Subida de Imagen */}
            <div className="arupo-avatar-outer-wrap">
              <div className="arupo-avatar-container">
                <div className="arupo-avatar-ring" />
                
                <div 
                  className="arupo-avatar-wrapper"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  title="Haz clic para cambiar tu foto de perfil"
                >
                  <div className="arupo-avatar" style={{ 
                    background: profile?.avatar 
                      ? 'none' 
                      : isBrigadista 
                        ? 'linear-gradient(135deg, var(--success-color), var(--primary-color))'
                        : isVoluntario 
                          ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                          : 'linear-gradient(135deg, var(--danger-color), #f43f5e)'
                  }}>
                    {profile?.avatar ? (
                      <img 
                        src={profile.avatar} 
                        alt="Avatar" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      (profile?.nombre || 'U').substring(0, 2).toUpperCase()
                    )}
                  </div>
                  
                  {/* Overlay on hover */}
                  <div className="avatar-upload-overlay" style={{ fontSize: '0.55rem' }}>
                    <Camera size={18} style={{ marginBottom: '2px' }} />
                    <span>Cambiar</span>
                  </div>
                  
                  {/* Visual camera helper button */}
                  <div className="avatar-camera-btn">
                    <Camera size={14} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Identity & Basic details centered below banner */}
          <div className="arupo-profile-identity">
            
            {/* Username & edit button */}
            <div className="arupo-username-container">
              {isEditingName ? (
                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                  <input 
                    className="input-field" 
                    style={{ marginBottom: 0, padding: '0.35rem 0.65rem', fontSize: '1.25rem', fontWeight: '700', maxWidth: '220px', textAlign: 'center' }}
                    value={tempNombre}
                    onChange={e => setTempNombre(e.target.value)}
                    autoFocus
                    disabled={updating}
                  />
                  <Button variant="primary" onClick={handleUpdateName} disabled={updating} style={{ padding: '0.4rem', height: '32px', minWidth: '32px' }} title="Guardar">
                    <Check size={14} />
                  </Button>
                  <Button variant="ghost" onClick={() => { setIsEditingName(false); setTempNombre(profile?.nombre || ''); }} style={{ padding: '0.4rem', height: '32px', minWidth: '32px' }} title="Cancelar">
                    <X size={14} />
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="arupo-profile-username">{profile?.nombre || 'Usuario Operativo'}</h2>
                  <button 
                    onClick={() => setIsEditingName(true)}
                    className="edit-name-btn"
                    title="Editar nombre"
                  >
                    <Edit2 size={14} />
                  </button>
                </>
              )}
            </div>

            {/* Role title and elegant badge */}
            <div className="arupo-profile-role-section">
              <span className={`arupo-profile-bio-badge ${isBrigadista ? 'brigadista' : isVoluntario ? 'voluntario' : 'admin'}`}>
                {getRoleLabel(profile?.rol)}
              </span>
              <span className="arupo-role-subtitle">{getRoleTitle()}</span>
            </div>

            {/* Structured modern contact info pills */}
            <div className="arupo-quick-contact-bar">
              <div className="contact-pill" title="Correo Electrónico">
                <Mail size={14} />
                <span>{showEmail ? user?.email : '••••••••@••••.•••'}</span>
                <button 
                  onClick={() => setShowEmail(!showEmail)}
                  className="view-email-btn"
                >
                  {showEmail ? 'ocultar' : 'ver'}
                </button>
              </div>

              {profile?.telefono && (
                <div className="contact-pill" title="Teléfono">
                  <Phone size={14} />
                  <span>{profile.telefono}</span>
                </div>
              )}

              {profile?.direccion && (
                <div className="contact-pill" title="Dirección">
                  <MapPin size={14} />
                  <span>{profile.direccion}</span>
                </div>
              )}

              {isBrigadista && profile?.especialidad && (
                <div className="contact-pill" title="Especialidad Médica">
                  <Briefcase size={14} style={{ color: 'var(--success-color)' }} />
                  <span>{profile.especialidad} ({profile.institucion || 'Fundación Arupo'})</span>
                </div>
              )}

              {isVoluntario && profile?.area_apoyo && (
                <div className="contact-pill" title="Área de Apoyo">
                  <Briefcase size={14} style={{ color: '#7c3aed' }} />
                  <span>Área: {profile.area_apoyo}</span>
                </div>
              )}
            </div>

            {/* Premium quick tab switches */}
            <div className="arupo-profile-actions">
              <button 
                className={`arupo-btn-premium ${activeTab === 'editar' ? 'active' : ''}`}
                onClick={() => setActiveTab('editar')}
              >
                <Settings size={15} />
                <span>Completar Ficha</span>
              </button>
              <button 
                className={`arupo-btn-premium ${activeTab === 'privilegios' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('privilegios');
                  setShowPasswordForm(true);
                }}
              >
                <Key size={15} />
                <span>Seguridad & Acceso</span>
              </button>
            </div>
          </div>

          {/* Navigation Tab Capsules (Flat high-end pills) */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '0.75rem', 
            borderTop: '1px solid var(--border-color)', 
            padding: '1.25rem 1.5rem',
            background: 'var(--bg-surface-hover)',
            flexWrap: 'wrap'
          }}>
            <button 
              className={`tab-pill-btn ${activeTab === 'informacion' ? 'active' : ''}`}
              onClick={() => setActiveTab('informacion')}
              style={{
                background: activeTab === 'informacion' ? 'var(--primary-color)' : 'transparent',
                color: activeTab === 'informacion' ? 'white' : 'var(--text-secondary)',
                border: activeTab === 'informacion' ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                padding: '0.5rem 1.25rem',
                borderRadius: '100px',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'informacion' ? '0 4px 10px rgba(16,185,129,0.3)' : 'none'
              }}
            >
              <Database size={16} />
              Mi Actividad
            </button>
            <button 
              className={`tab-pill-btn ${activeTab === 'editar' ? 'active' : ''}`}
              onClick={() => setActiveTab('editar')}
              style={{
                background: activeTab === 'editar' ? 'var(--primary-color)' : 'transparent',
                color: activeTab === 'editar' ? 'white' : 'var(--text-secondary)',
                border: activeTab === 'editar' ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                padding: '0.5rem 1.25rem',
                borderRadius: '100px',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'editar' ? '0 4px 10px rgba(16,185,129,0.3)' : 'none'
              }}
            >
              <User size={16} />
              Editar Datos
            </button>
            <button 
              className={`tab-pill-btn ${activeTab === 'privilegios' ? 'active' : ''}`}
              onClick={() => setActiveTab('privilegios')}
              style={{
                background: activeTab === 'privilegios' ? 'var(--primary-color)' : 'transparent',
                color: activeTab === 'privilegios' ? 'white' : 'var(--text-secondary)',
                border: activeTab === 'privilegios' ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                padding: '0.5rem 1.25rem',
                borderRadius: '100px',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'privilegios' ? '0 4px 10px rgba(16,185,129,0.3)' : 'none'
              }}
            >
              <Shield size={16} />
              Seguridad & Rol
            </button>
          </div>
        </div>

        {/* Grid de Métricas Premium Interactivas */}
        {activeTab === 'informacion' && (
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
        )}

        {/* Tarjeta de Información de Contacto e Identidad por Rol */}
        {activeTab === 'editar' && (
          <div className="card glass animate-fade-in" style={{ padding: '1.75rem', position: 'relative', overflow: 'hidden' }}>
            {/* Subtle decorative background gradient matching the role */}
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '180px',
              height: '180px',
              background: isBrigadista 
                ? 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)' 
                : isVoluntario 
                  ? 'radial-gradient(circle, rgba(124, 58, 237, 0.08) 0%, transparent 70%)' 
                  : 'radial-gradient(circle, rgba(225, 29, 72, 0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
              zIndex: 0
            }} />

            <h3 style={{ 
              fontSize: '1.15rem', 
              fontWeight: '700', 
              marginBottom: '1.25rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.65rem', 
              color: 'var(--text-primary)', 
              borderBottom: '1px solid var(--border-color)', 
              paddingBottom: '0.75rem',
              position: 'relative',
              zIndex: 1
            }}>
              <User size={20} color="var(--primary-color)" /> 
              Datos de Perfil Avanzado ({getRoleLabel(profile?.rol)})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
              
              {/* Campos Comunes: Teléfono y Dirección */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Phone size={14} style={{ color: 'var(--primary-color)' }} />
                    Teléfono de Contacto
                  </label>
                  <input 
                    type="text" 
                    className="input-field" 
                    style={{ marginBottom: 0 }}
                    value={tempTelefono}
                    onChange={e => setTempTelefono(e.target.value)}
                    placeholder="Ej. +593 999 999 999"
                    disabled={updating}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MapPin size={14} style={{ color: 'var(--primary-color)' }} />
                    Dirección Domiciliaria
                  </label>
                  <input 
                    type="text" 
                    className="input-field" 
                    style={{ marginBottom: 0 }}
                    value={tempDireccion}
                    onChange={e => setTempDireccion(e.target.value)}
                    placeholder="Ciudad, Provincia o Dirección Completa"
                    disabled={updating}
                  />
                </div>
              </div>

              {/* Campos Específicos para Brigadistas (Médicos) */}
              {isBrigadista && (
                <>
                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.5rem 0' }} />
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Briefcase size={14} style={{ color: 'var(--success-color)' }} />
                        Especialidad Médica / Área
                      </label>
                      <input 
                        type="text" 
                        className="input-field" 
                        style={{ marginBottom: 0 }}
                        value={tempEspecialidad}
                        onChange={e => setTempEspecialidad(e.target.value)}
                        placeholder="Ej. Medicina General, Enfermería, Pediatría"
                        disabled={updating}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Award size={14} style={{ color: 'var(--success-color)' }} />
                        Licencia Médica / Registro
                      </label>
                      <input 
                        type="text" 
                        className="input-field" 
                        style={{ marginBottom: 0 }}
                        value={tempLicenciaMedica}
                        onChange={e => setTempLicenciaMedica(e.target.value)}
                        placeholder="Ej. Registro Profesional / SENESCYT"
                        disabled={updating}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Building size={14} style={{ color: 'var(--success-color)' }} />
                      Institución Hospitalaria o de Afiliación
                    </label>
                    <input 
                      type="text" 
                      className="input-field" 
                      style={{ marginBottom: 0 }}
                      value={tempInstitucion}
                      onChange={e => setTempInstitucion(e.target.value)}
                      placeholder="Ej. Hospital IESS, Ministerio de Salud Pública, Práctica Privada"
                      disabled={updating}
                    />
                  </div>
                </>
              )}

              {/* Campos Específicos para Voluntarios */}
              {isVoluntario && (
                <>
                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.5rem 0' }} />
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Briefcase size={14} style={{ color: '#7c3aed' }} />
                        Área de Apoyo Principal
                      </label>
                      <input 
                        type="text" 
                        className="input-field" 
                        style={{ marginBottom: 0 }}
                        value={tempAreaApoyo}
                        onChange={e => setTempAreaApoyo(e.target.value)}
                        placeholder="Ej. Logística de Entregas, Gestión de Donaciones, CRM"
                        disabled={updating}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={14} style={{ color: '#7c3aed' }} />
                        Disponibilidad Horaria
                      </label>
                      <input 
                        type="text" 
                        className="input-field" 
                        style={{ marginBottom: 0 }}
                        value={tempDisponibilidad}
                        onChange={e => setTempDisponibilidad(e.target.value)}
                        placeholder="Ej. Fines de semana, Tardes (Lunes a Viernes)"
                        disabled={updating}
                      />
                    </div>
                  </div>
                </>
              )}

              <Button 
                variant="primary" 
                onClick={handleSaveRoleFields}
                disabled={updating}
                style={{ 
                  marginTop: '0.5rem', 
                  width: '100%', 
                  justifyContent: 'center', 
                  display: 'flex', 
                  gap: '0.5rem',
                  boxShadow: isBrigadista 
                    ? '0 4px 12px rgba(16,185,129,0.2)' 
                    : isVoluntario 
                      ? '0 4px 12px rgba(124,58,237,0.2)' 
                      : '0 4px 12px rgba(16,185,129,0.2)'
                }}
              >
                <CheckCircle size={16} />
                {updating ? 'Guardando...' : 'Guardar Información de Perfil'}
              </Button>

            </div>
          </div>
        )}

        {/* Grid de Dos Columnas para Privilegios y Seguridad */}
        {activeTab === 'privilegios' && (
          <>
            <div className="grid-responsive animate-fade-in" style={{ gap: '1.5rem' }}>
              
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

            {/* Exclusive Developer Zone (thony.karter@gmail.com) */}
            {isDeveloper && (
              <div className="card glass developer-zone-card animate-fade-in" style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                  <div className="developer-icon-container">
                    <Flame size={18} />
                  </div>
                  <span style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--danger-color)' }}>Zona del Desarrollador (Acceso Exclusivo)</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                    Atención <strong>{profile?.nombre || 'thony.karter'}</strong>: Este panel es visible exclusivamente para ti. Desde aquí puedes realizar un restablecimiento completo y limpieza de fábrica de los componentes clave de la base de datos.
                  </p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', background: 'var(--bg-surface-hover)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Componentes a Depurar:</span>
                      <span style={{ color: 'var(--danger-color)', fontWeight: '600' }}>• Inventario (Lotes y Movimientos)</span>
                      <span style={{ color: 'var(--danger-color)', fontWeight: '600' }}>• Catálogo (Medicamentos)</span>
                      <span style={{ color: 'var(--danger-color)', fontWeight: '600' }}>• Evaluaciones de Salud</span>
                      <span style={{ color: 'var(--danger-color)', fontWeight: '600' }}>• Beneficiarios y Donantes</span>
                    </div>
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', background: 'var(--bg-surface-hover)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Registros Preservados:</span>
                      <span style={{ color: 'var(--success-color)', fontWeight: '600' }}>✓ Cuentas de Usuario y Credenciales</span>
                      <span style={{ color: 'var(--success-color)', fontWeight: '600' }}>✓ Perfiles y Roles Operativos</span>
                      <span style={{ color: 'var(--success-color)', fontWeight: '600' }}>✓ Categorías del Sistema</span>
                    </div>
                  </div>

                  <Button 
                    className="factory-reset-btn"
                    onClick={() => {
                      setShowResetModal(true);
                      setResetConfirmText('');
                      setResetError('');
                      setResetSuccess('');
                    }}
                    style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)' }}
                  >
                    <Flame size={16} /> Depurar Sistema de Fábrica
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal de Doble Confirmación para Depuración */}
        <Modal
          isOpen={showResetModal}
          onClose={() => !isResetting && setShowResetModal(false)}
          title="⚠️ DOBLE CONFIRMACIÓN: DEPURA DE FÁBRICA"
          footer={
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <Button
                variant="ghost"
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                className="factory-reset-btn"
                onClick={handleFactoryReset}
                disabled={isResetting || resetConfirmText.trim().toUpperCase() !== 'DEPURAR'}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {isResetting ? 'Depurando...' : 'Confirmar Depuración'}
              </Button>
            </div>
          }
        >
          <div className="danger-modal-glow-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', background: 'var(--danger-bg)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', color: 'var(--danger-color)', fontSize: '0.85rem' }}>
              <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ lineHeight: '1.5' }}>
                <strong>¡Acción Altamente Destructiva!</strong> Esto eliminará de forma permanente todo el historial de transacciones, lotes de inventario, el catálogo completo de medicamentos, evaluaciones de salud, y directorios de beneficiarios y donantes. Esta acción es irreversible.
              </div>
            </div>

            {resetError && (
              <div className="status-alert danger">
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{resetError}</span>
              </div>
            )}
            {resetSuccess && (
              <div className="status-alert success">
                <CheckCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{resetSuccess}</span>
              </div>
            )}

            <div className="security-challenge-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, fontWeight: '500' }}>
                Para desbloquear esta acción, escribe la palabra <strong>DEPURAR</strong> a continuación:
              </p>
              <input
                type="text"
                className="input-field"
                style={{ margin: 0, width: '100%', textTransform: 'uppercase', textAlign: 'center', fontSize: '1.1rem', fontWeight: '800', letterSpacing: '0.1em', borderColor: resetConfirmText.trim().toUpperCase() === 'DEPURAR' ? 'var(--danger-color)' : 'var(--border-color)' }}
                placeholder="Escribe DEPURAR"
                value={resetConfirmText}
                onChange={e => setResetConfirmText(e.target.value)}
                disabled={isResetting}
                autoFocus
              />
            </div>
          </div>
        </Modal>

      </div>
    </div>
  );
};
