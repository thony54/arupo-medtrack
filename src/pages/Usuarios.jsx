import React, { useState, useEffect } from 'react';
import { 
  UserPlus, Search, Shield, Mail, Trash2, UserCheck, AlertCircle, 
  Eye, EyeOff, HandHeart, Activity, ChevronDown, ChevronUp 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import './pages.css';

import { useAuth } from '../contexts/AuthContext';

const ROLES = [
  { value: 'brigadista', label: 'Brigadista (Manejo Médico e Inventario)' },
  { value: 'voluntario', label: 'Voluntario (CRM, Donantes y Beneficiarios)' }
];

export const Usuarios = () => {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Formulario
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('brigadista');
  const [showPassword, setShowPassword] = useState(false);

  // Estados para colapsables de Roles
  const [expandedRoles, setExpandedRoles] = useState({
    super_admin: true,
    brigadista: true,
    voluntario: true
  });

  const toggleRole = (roleKey) => {
    setExpandedRoles(prev => ({
      ...prev,
      [roleKey]: !prev[roleKey]
    }));
  };

  const getRoleColor = (rol) => {
    switch (rol) {
      case 'super_admin': return 'var(--danger-color)';
      case 'brigadista': return 'var(--success-color)';
      case 'voluntario': return '#7c3aed';
      default: return 'var(--text-secondary)';
    }
  };

  const getRoleLightColor = (rol) => {
    switch (rol) {
      case 'super_admin': return 'var(--danger-bg)';
      case 'brigadista': return 'var(--success-bg)';
      case 'voluntario': return '#ede9fe';
      default: return 'var(--bg-surface-hover)';
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      if (!supabase) return;
      const { data, error: err } = await supabase
        .from('perfiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setUsuarios(data || []);
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNombre('');
    setEmail('');
    setPassword('');
    setRol('brigadista');
    setError('');
    setSuccess('');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return setError('El nombre es obligatorio.');
    if (!email.trim()) return setError('El email es obligatorio.');
    if (!password || password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    if (!rol) return setError('El rol es obligatorio.');

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // 1. Cliente temporal para no cerrar tu sesión
      const { createClient } = await import('@supabase/supabase-js');
      const authClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false } }
      );

      // 2. Registro (El trigger en DB se encarga del perfil)
      const { data, error: signUpError } = await authClient.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            nombre: nombre.trim(),
            rol: rol
          }
        }
      });

      if (signUpError) throw signUpError;

      // 3. Espera breve para sincronización de DB
      await new Promise(resolve => setTimeout(resolve, 800));

      setSuccess('¡Personal registrado con éxito!');
      setTimeout(() => {
        setIsModalOpen(false);
        resetForm();
        fetchUsuarios();
      }, 1500);

    } catch (err) {
      console.error('Registration Error:', err);
      setError(err.message || 'Error al crear la cuenta.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId, userNombre) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar a ${userNombre}? Esta acción no se puede deshacer.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error: delError } = await supabase.rpc('eliminar_usuario', {
        p_user_id: userId
      });

      if (delError) throw delError;

      setSuccess('Usuario eliminado con éxito');
      fetchUsuarios();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error al eliminar:', err);
      setError('No se pudo eliminar el usuario. Asegúrate de haber ejecutado schema_v13.sql');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (rol) => {
    switch (rol) {
      case 'super_admin': return <Badge variant="danger">Super Admin</Badge>;
      case 'brigadista': return <Badge variant="success">Brigadista</Badge>;
      case 'voluntario': return <Badge variant="info">Voluntario</Badge>;
      default: return <Badge variant="warning">{rol}</Badge>;
    }
  };

  const filtered = usuarios.filter(u =>
    (u.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    u.rol.toLowerCase().includes(search.toLowerCase())
  );

  const renderUserTable = (usersList, roleName, roleKey) => {
    const isExpanded = expandedRoles[roleKey];
    
    if (!isExpanded) return null;
    
    return (
      <div className="role-section-block animate-slide-up" style={{ marginBottom: '1.75rem', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-glass)' }}>
        <div className="table-container usuarios-table-container" style={{ border: 'none', borderRadius: 0, margin: 0 }}>
          <table className="data-table" style={{ minWidth: '800px', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ padding: '0.85rem 1.25rem' }}>Nombre</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Email</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Rol asignado</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Fecha Registro</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Permisos & Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usersList.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
                    <Shield size={36} style={{ display: 'block', margin: '0 auto 0.5rem', opacity: 0.4 }} />
                    <span style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>No hay personal registrado en este rol o no coincide con la búsqueda.</span>
                  </td>
                </tr>
              ) : (
                usersList.map(u => (
                  <tr key={u.id}>
                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          backgroundColor: getRoleLightColor(u.rol),
                          color: getRoleColor(u.rol),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '0.85rem',
                          border: `1px solid ${getRoleColor(u.rol)}22`,
                          boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                        }}>
                          {(u.nombre || 'U').substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{u.nombre}</div>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Mail size={13} style={{ opacity: 0.7 }} />
                        {u.email}
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem' }}>{getRoleBadge(u.rol)}</td>
                    <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                      {new Date(u.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                          {u.rol === 'super_admin' && 'Acceso total e irrestricto en todos los módulos.'}
                          {u.rol === 'brigadista' && 'Gestión de Medicinas, Lotes e Inventario.'}
                          {u.rol === 'voluntario' && 'Gestión del CRM, Donantes y Beneficiarios.'}
                        </span>
                        
                        {u.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(u.id, u.nombre)}
                            style={{ color: 'var(--danger-color)', padding: '0.4rem', height: 'auto', flexShrink: 0 }}
                            title="Eliminar usuario"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%', paddingBottom: '2rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestión de Personal</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Registra y administra accesos para Administradores, Brigadistas y Voluntarios.
          </p>
        </div>
        <Button variant="primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <UserPlus size={18} /> Registrar Personal
        </Button>
      </div>

      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          <input
            className="input-field"
            style={{ paddingLeft: '2.75rem', marginBottom: 0, width: '100%' }}
            placeholder="Buscar por nombre, email o rol..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tarjetas Premium de Categorías / Selector de Roles */}
      <div className="role-selector-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem'
      }}>
        {/* Card: Administradores */}
        <div 
          onClick={() => toggleRole('super_admin')}
          className={`card glass role-selector-card ${expandedRoles.super_admin ? 'active-super-admin' : ''}`}
          style={{
            padding: '1.15rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            border: `1px solid ${expandedRoles.super_admin ? 'var(--danger-color)' : 'var(--border-color)'}`,
            boxShadow: expandedRoles.super_admin ? '0 4px 15px rgba(225, 29, 72, 0.12)' : 'none',
            background: expandedRoles.super_admin ? 'var(--danger-bg)' : 'var(--bg-glass)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
            opacity: expandedRoles.super_admin ? 1 : 0.75
          }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--danger-bg)',
            color: 'var(--danger-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid rgba(225, 29, 72, 0.15)'
          }}>
            <Shield size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>Admins</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600', marginTop: '0.15rem' }}>
              {usuarios.filter(u => u.rol === 'super_admin').length} registrados
            </span>
          </div>
          <div style={{ color: expandedRoles.super_admin ? 'var(--danger-color)' : 'var(--text-tertiary)' }}>
            <span style={{ 
              fontSize: '0.65rem', 
              fontWeight: '700', 
              textTransform: 'uppercase',
              background: expandedRoles.super_admin ? 'rgba(225, 29, 72, 0.12)' : 'var(--bg-surface-hover)',
              padding: '0.15rem 0.45rem',
              borderRadius: 'var(--radius-sm)'
            }}>
              {expandedRoles.super_admin ? 'Abierto' : 'Cerrado'}
            </span>
          </div>
        </div>

        {/* Card: Brigadistas */}
        <div 
          onClick={() => toggleRole('brigadista')}
          className={`card glass role-selector-card ${expandedRoles.brigadista ? 'active-brigadista' : ''}`}
          style={{
            padding: '1.15rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            border: `1px solid ${expandedRoles.brigadista ? 'var(--success-color)' : 'var(--border-color)'}`,
            boxShadow: expandedRoles.brigadista ? '0 4px 15px rgba(16, 185, 129, 0.12)' : 'none',
            background: expandedRoles.brigadista ? 'var(--success-bg)' : 'var(--bg-glass)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
            opacity: expandedRoles.brigadista ? 1 : 0.75
          }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--success-bg)',
            color: 'var(--success-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid rgba(16, 185, 129, 0.15)'
          }}>
            <Activity size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>Brigadistas</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600', marginTop: '0.15rem' }}>
              {usuarios.filter(u => u.rol === 'brigadista').length} registrados
            </span>
          </div>
          <div style={{ color: expandedRoles.brigadista ? 'var(--success-color)' : 'var(--text-tertiary)' }}>
            <span style={{ 
              fontSize: '0.65rem', 
              fontWeight: '700', 
              textTransform: 'uppercase',
              background: expandedRoles.brigadista ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-surface-hover)',
              padding: '0.15rem 0.45rem',
              borderRadius: 'var(--radius-sm)'
            }}>
              {expandedRoles.brigadista ? 'Abierto' : 'Cerrado'}
            </span>
          </div>
        </div>

        {/* Card: Voluntarios */}
        <div 
          onClick={() => toggleRole('voluntario')}
          className={`card glass role-selector-card ${expandedRoles.voluntario ? 'active-voluntario' : ''}`}
          style={{
            padding: '1.15rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            border: `1px solid ${expandedRoles.voluntario ? '#7c3aed' : 'var(--border-color)'}`,
            boxShadow: expandedRoles.voluntario ? '0 4px 15px rgba(124, 58, 237, 0.12)' : 'none',
            background: expandedRoles.voluntario ? '#ede9fe' : 'var(--bg-glass)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
            opacity: expandedRoles.voluntario ? 1 : 0.75
          }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-md)',
            background: '#ede9fe',
            color: '#7c3aed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid rgba(124, 58, 237, 0.15)'
          }}>
            <HandHeart size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>Voluntarios</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600', marginTop: '0.15rem' }}>
              {usuarios.filter(u => u.rol === 'voluntario').length} registrados
            </span>
          </div>
          <div style={{ color: expandedRoles.voluntario ? '#7c3aed' : 'var(--text-tertiary)' }}>
            <span style={{ 
              fontSize: '0.65rem', 
              fontWeight: '700', 
              textTransform: 'uppercase',
              background: expandedRoles.voluntario ? 'rgba(124, 58, 237, 0.12)' : 'var(--bg-surface-hover)',
              padding: '0.15rem 0.45rem',
              borderRadius: 'var(--radius-sm)'
            }}>
              {expandedRoles.voluntario ? 'Abierto' : 'Cerrado'}
            </span>
          </div>
        </div>
      </div>

      {/* Secciones de Tablas Colapsables por Rol */}
      {loading ? (
        <div className="card glass" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Cargando personal de la fundación...
        </div>
      ) : (
        <div className="collapsible-sections-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {renderUserTable(
            filtered.filter(u => u.rol === 'super_admin'),
            'Administradores del Sistema',
            'super_admin'
          )}
          {renderUserTable(
            filtered.filter(u => u.rol === 'brigadista'),
            'Especialistas Médicos / Brigadistas',
            'brigadista'
          )}
          {renderUserTable(
            filtered.filter(u => u.rol === 'voluntario'),
            'Coordinadores de Donaciones / Voluntarios',
            'voluntario'
          )}
        </div>
      )}

      {/* Modal para Crear Usuario */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { if (!saving) setIsModalOpen(false); }}
        title="Registrar Nuevo Personal"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button
              type="button"
              variant="primary"
              disabled={saving}
              onClick={() => document.getElementById('user-submit-btn').click()}
            >
              {saving ? 'Registrando...' : 'Crear Cuenta'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={{ padding: '0.75rem', background: 'var(--success-bg)', color: 'var(--success-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <UserCheck size={16} />
              <span>{success}</span>
            </div>
          )}

          {/* Información Personal */}
          <div className="grid-responsive" style={{ gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="u-nombre" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Nombre Completo <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <input
                id="u-nombre"
                className="input-field"
                style={{ marginBottom: 0 }}
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Juan Pérez"
                required
                disabled={saving}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="u-email" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Correo Electrónico <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <input
                id="u-email"
                type="email"
                className="input-field"
                style={{ marginBottom: 0 }}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="correo@fundacion.org"
                required
                disabled={saving}
              />
            </div>
          </div>

          {/* Contraseña */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="u-pass" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Contraseña Temporal <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                id="u-pass"
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                style={{ marginBottom: 0, paddingRight: '2.5rem' }}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                disabled={saving}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Recomendado: mezcla letras, números y símbolos.</span>
          </div>

          {/* Selector de Rol Premium */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Rol y Nivel de Acceso <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {ROLES.map(r => {
                const isActive = rol === r.value;
                const Icon = r.value === 'brigadista' ? Shield : HandHeart;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRol(r.value)}
                    style={{
                      flex: '1 1 200px',
                      padding: '1rem',
                      borderRadius: 'var(--radius-lg)',
                      border: `2px solid ${isActive ? 'var(--primary-color)' : 'var(--border-color)'}`,
                      background: isActive ? 'var(--primary-light)' : 'var(--bg-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                      <Icon size={18} />
                      <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{r.value === 'brigadista' ? 'Brigadista' : 'Voluntario'}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0, lineHeight: '1.4' }}>
                      {r.value === 'brigadista' 
                        ? 'Acceso a inventario médico, registro de lotes y entregas de medicinas.' 
                        : 'Acceso a CRM, gestión de donantes y registro de beneficiarios.'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <button type="submit" id="user-submit-btn" style={{ display: 'none' }} />
        </form>
      </Modal>
    </div>
  );
};
