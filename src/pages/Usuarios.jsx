import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Shield, Mail, Trash2, UserCheck, AlertCircle, Eye, EyeOff, HandHeart } from 'lucide-react';
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

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestión de Personal</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Registra y administra accesos para Brigadistas y Voluntarios de la fundación.
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

      <div className="table-container usuarios-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol asignado</th>
              <th>Fecha Registro</th>
              <th>Permisos</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>Cargando usuarios...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>
                  <Shield size={40} style={{ display: 'block', margin: '0 auto 0.75rem', color: 'var(--text-tertiary)', opacity: 0.6 }} />
                  <span style={{ color: 'var(--text-secondary)' }}>No se encontraron usuarios registrados.</span>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    Asegúrate de haber ejecutado el script <code>schema_v4.sql</code> en tu panel de Supabase.
                  </p>
                </td>
              </tr>
            ) : filtered.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary-hover)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '0.85rem'
                    }}>
                      {(u.nombre || 'U').substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ fontWeight: '600' }}>{u.nombre}</div>
                  </div>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Mail size={14} style={{ opacity: 0.7 }} />
                    {u.email}
                  </div>
                </td>
                <td>{getRoleBadge(u.rol)}</td>
                <td style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                  {new Date(u.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', flex: 1 }}>
                      {u.rol === 'super_admin' && 'Acceso total e irrestricto'}
                      {u.rol === 'brigadista' && 'Gestión de Medicinas e Inventario'}
                      {u.rol === 'voluntario' && 'Gestión de Donantes y Beneficiarios'}
                    </span>
                    
                    {u.id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(u.id, u.nombre)}
                        style={{ color: 'var(--danger-color)', padding: '0.4rem', height: 'auto' }}
                        title="Eliminar usuario"
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vista de Tarjetas para Móviles */}
      <div className="mobile-user-cards animate-fade-in">
        {loading ? (
          <div className="card glass" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>Cargando usuarios...</div>
        ) : filtered.length === 0 ? (
          <div className="card glass" style={{ textAlign: 'center', padding: '3rem' }}>
            <Shield size={40} style={{ display: 'block', margin: '0 auto 0.75rem', color: 'var(--text-tertiary)', opacity: 0.6 }} />
            <span style={{ color: 'var(--text-secondary)' }}>No se encontraron usuarios registrados.</span>
          </div>
        ) : filtered.map(u => (
          <div key={u.id} className="mobile-user-card glass">
            <div className="user-card-header">
              <div className="user-avatar-info">
                <div className="user-avatar">
                  {(u.nombre || 'U').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="user-name">{u.nombre}</div>
                  <div className="user-email">
                    <Mail size={12} />
                    <span>{u.email}</span>
                  </div>
                </div>
              </div>
              <div className="user-role-badge">
                {getRoleBadge(u.rol)}
              </div>
            </div>
            
            <div className="user-card-details">
              <div className="user-detail-row">
                <span className="detail-label">Registro:</span>
                <span className="detail-value">
                  {new Date(u.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <div className="user-detail-row permissions-row">
                <span className="detail-label">Permisos autorizados:</span>
                <span className="detail-value permissions-text">
                  {u.rol === 'super_admin' && 'Acceso total e irrestricto en todos los módulos.'}
                  {u.rol === 'brigadista' && 'Gestión de Medicinas, Lotes e Inventario.'}
                  {u.rol === 'voluntario' && 'Gestión del CRM, Donantes y Beneficiarios.'}
                </span>
              </div>
            </div>

            {u.id !== user?.id && (
              <div className="user-card-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteUser(u.id, u.nombre)}
                  className="delete-user-btn"
                  title="Eliminar usuario"
                >
                  <Trash2 size={14} /> Eliminar Personal
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

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
