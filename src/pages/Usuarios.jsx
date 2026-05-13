import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Shield, Mail, Trash2, UserCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import './pages.css';

const ROLES = [
  { value: 'brigadista', label: 'Brigadista (Manejo Médico e Inventario)' },
  { value: 'voluntario', label: 'Voluntario (CRM, Donantes y Beneficiarios)' }
];

export const Usuarios = () => {
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
      // Llamar al RPC creado en supabase/schema_v4.sql
      const { data, error: rpcError } = await supabase.rpc('crear_usuario_completo', {
        p_email: email.trim(),
        p_password: password,
        p_nombre: nombre.trim(),
        p_rol: rol
      });

      if (rpcError) {
        if (rpcError.message.includes('crear_usuario_completo')) {
          throw new Error('El script SQL de roles no ha sido instalado en Supabase. Contacta al administrador para ejecutar schema_v4.sql.');
        }
        throw rpcError;
      }

      setSuccess('¡Usuario creado con éxito!');
      setTimeout(() => {
        setIsModalOpen(false);
        resetForm();
        fetchUsuarios();
      }, 1500);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al crear el usuario.');
    } finally {
      setSaving(false);
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

      <div className="table-container">
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
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    {u.rol === 'super_admin' && 'Acceso total e irrestricto'}
                    {u.rol === 'brigadista' && 'Gestión de Medicinas e Inventario'}
                    {u.rol === 'voluntario' && 'Gestión de Donantes y Beneficiarios'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="u-pass" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Contraseña Temporal <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <input 
              id="u-pass" 
              type="password"
              className="input-field" 
              style={{ marginBottom: 0 }} 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Mínimo 6 caracteres" 
              required 
              minLength={6}
              disabled={saving}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Esta contraseña deberá ser usada por el usuario para su primer inicio de sesión.</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="u-rol" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Rol del Usuario <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <select
              id="u-rol"
              className="input-field"
              style={{ 
                marginBottom: 0, 
                cursor: 'pointer', 
                width: '100%', 
                appearance: 'none', 
                backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2310b981%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', 
                backgroundRepeat: 'no-repeat', 
                backgroundPosition: 'right 1rem top 50%', 
                backgroundSize: '0.65rem auto' 
              }}
              value={rol}
              onChange={e => setRol(e.target.value)}
              disabled={saving}
              required
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <button type="submit" id="user-submit-btn" style={{ display: 'none' }} />
        </form>
      </Modal>
    </div>
  );
};
