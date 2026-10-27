import React, { useState, useEffect } from 'react';
import { 
  UserPlus, Search, Shield, Mail, Trash2, UserCheck, AlertCircle, 
  Eye, EyeOff, HandHeart, Activity, ClipboardCheck, UserCog, Stethoscope
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { ROL_CONFIG, ROLES_ORDEN, ROLES_ADICIONALES, SECCIONES_ROL, tieneRol, getRolColor, getRolBg } from '../utils/roles';
import './pages.css';

import { useAuth } from '../contexts/AuthContext';

const ROL_ICONOS = {
  super_admin: Shield,
  coordinador: ClipboardCheck,
  coordinador_brigadas: Stethoscope,
  brigadista: Activity,
  voluntario: HandHeart
};

export const Usuarios = () => {
  const { user, esAdminPrincipal } = useAuth() || {};

  const isDeveloper = esAdminPrincipal === true;

  // Solo el admin principal otorga el rol de Admin y los roles adicionales de
  // coordinación. Es control de interfaz; la base lo hace valer: los roles de coordinación,
  // con el trigger de `perfiles` (schema_v33/v35), y el resto, con su RLS (solo super_admin).
  const rolesDisponibles = ROLES_ORDEN.filter(r => isDeveloper || !ROL_CONFIG[r].asignablePorDeveloper);
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

  // Gestión de roles de un usuario existente: { usuario, nuevoRol, adicionales } o null,
  // con `adicionales` = { coordinador: bool, coordinador_brigadas: bool }.
  const [cambioRol, setCambioRol] = useState(null);
  const [cambiandoRol, setCambiandoRol] = useState(false);
  const [errorCambioRol, setErrorCambioRol] = useState('');
  const [aviso, setAviso] = useState('');

  // Estados para colapsables de Roles
  const [expandedRoles, setExpandedRoles] = useState(
    Object.fromEntries(SECCIONES_ROL.map(r => [r, true]))
  );

  const toggleRole = (roleKey) => {
    setExpandedRoles(prev => ({
      ...prev,
      [roleKey]: !prev[roleKey]
    }));
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

  // Método de COMPATIBILIDAD: se usa solo si la Edge Function `crear-personal`
  // todavía no está desplegada. Crea la cuenta con signUp() público (el trigger
  // la deja como 'voluntario') y luego, con la sesión del super_admin, promueve
  // al rol elegido vía UPDATE sobre perfiles (política perfiles_upd). Cuando se
  // despliegue la función y se cierre el alta pública, este camino deja de
  // ejecutarse. Ver supabase/functions/crear-personal/README.md.
  const crearPersonalLegacy = async () => {
    // Cliente temporal para no cerrar tu propia sesión.
    const { createClient } = await import('@supabase/supabase-js');
    const authClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    );

    const { data, error: signUpError } = await authClient.auth.signUp({
      email: email.trim().toLowerCase(),
      password: password,
      options: { data: { nombre: nombre.trim() } }
    });
    if (signUpError) throw signUpError;

    const nuevoUserId = data?.user?.id;

    // Espera breve para que el trigger cree el perfil (voluntario) en DB.
    await new Promise(resolve => setTimeout(resolve, 800));

    // Promover al rol pedido. Se relee el rol para detectar un UPDATE bloqueado
    // por RLS (devolvería 0 filas sin lanzar error).
    if (nuevoUserId && rol !== 'voluntario') {
      const { data: perfilActualizado, error: rolError } = await supabase
        .from('perfiles')
        .update({ rol })
        .eq('id', nuevoUserId)
        .select('rol')
        .maybeSingle();

      if (rolError || perfilActualizado?.rol !== rol) {
        console.error('Error al asignar rol:', rolError);
        throw new Error(
          `La cuenta se creó, pero no se pudo asignar el rol "${rol}". ` +
          'Quedó como voluntario; promuévela manualmente desde esta pantalla.'
        );
      }
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return setError('El nombre es obligatorio.');
    if (!email.trim()) return setError('El email es obligatorio.');
    // 12 caracteres: son cuentas con acceso a datos personales y clínicos.
    // Ojo: esto es validación de interfaz. El mínimo real se configura en
    // Supabase → Authentication → Policies; si allí sigue en 6, la API acepta 6.
    if (!password || password.length < 12) return setError('La contraseña debe tener al menos 12 caracteres.');
    if (!rol) return setError('El rol es obligatorio.');

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Vía SEGURA (preferente): Edge Function `crear-personal`. Corre con la
      // service_role key en el servidor, valida que quien llama es super_admin
      // y crea la cuenta con el rol pedido sin depender del alta pública. El
      // JWT del super_admin lo adjunta functions.invoke automáticamente.
      const { error: fnError } = await supabase.functions.invoke('crear-personal', {
        body: {
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          password,
          rol
        }
      });

      if (fnError) {
        // FunctionsHttpError = la función SÍ existe y devolvió un error de
        // negocio (403, email duplicado, validación…): se muestra tal cual.
        if (fnError.name === 'FunctionsHttpError') {
          let msg = 'No se pudo crear el usuario.';
          try {
            const body = await fnError.context.json();
            if (body?.error) msg = body.error;
          } catch { /* respuesta sin JSON */ }
          throw new Error(msg);
        }
        // Cualquier otro fallo (red/relay) = la función aún no está desplegada.
        // Se recurre al método de compatibilidad para no bloquear el alta.
        await crearPersonalLegacy();
      }

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

  // Gestiona los roles de un usuario ya existente: el principal (`rol`) y los
  // adicionales de coordinación (`es_coordinador`, `es_coordinador_brigadas`). Solo los
  // ofrece la interfaz al super admin principal; la base lo hace valer (RLS de `perfiles`
  // exige super_admin y, para Brigadas Médicas, el trigger exige al super admin principal).
  const abrirCambioRol = (u) => {
    setErrorCambioRol('');
    setCambioRol({
      usuario: u,
      nuevoRol: u.rol,
      adicionales: Object.fromEntries(Object.keys(ROLES_ADICIONALES).map(r => [r, tieneRol(u, r)]))
    });
  };

  // Campos que realmente cambian respecto al perfil actual.
  const cambiosPendientes = (c) => {
    const cambios = {};
    if (c.nuevoRol !== c.usuario.rol) cambios.rol = c.nuevoRol;
    for (const [rolAdicional, columna] of Object.entries(ROLES_ADICIONALES)) {
      if (c.adicionales[rolAdicional] !== tieneRol(c.usuario, rolAdicional)) cambios[columna] = c.adicionales[rolAdicional];
    }
    return cambios;
  };

  const handleCambiarRol = async () => {
    if (!cambioRol || !supabase) return;
    const { usuario, nuevoRol } = cambioRol;
    const cambios = cambiosPendientes(cambioRol);
    if (Object.keys(cambios).length === 0 || usuario.id === user?.id) return;

    setCambiandoRol(true);
    setErrorCambioRol('');
    try {
      // Se relee lo devuelto para detectar un UPDATE bloqueado por RLS
      // (devolvería 0 filas sin lanzar error). Solo se piden las columnas que se tocan:
      // pedir una que aún no existe en la base haría fallar también las demás.
      const { data, error: updError } = await supabase
        .from('perfiles')
        .update(cambios)
        .eq('id', usuario.id)
        .select(['rol', ...Object.keys(cambios).filter(c => c !== 'rol')].join(', '))
        .maybeSingle();

      if (updError) {
        console.error('Error al cambiar los roles:', updError);
        // 42703 / PGRST204: la columna aún no existe (falta schema_v22 o schema_v33).
        const faltaColumna = ['42703', 'PGRST204'].includes(updError.code);
        const scriptFalta = 'es_coordinador_brigadas' in cambios ? 'schema_v33.sql' : 'schema_v22.sql';
        throw new Error(
          faltaColumna
            ? `La base de datos aún no admite ese rol de Coordinador. Ejecuta ${scriptFalta} en el SQL Editor de Supabase.`
            : updError.code === '42501'
              ? 'La base de datos rechazó el cambio: solo el super admin principal puede otorgar este rol.'
              : 'No se pudo cambiar el rol.'
        );
      }
      if (!data || Object.entries(cambios).some(([campo, valor]) => data[campo] !== valor)) {
        throw new Error('No se pudo cambiar el rol: la base de datos rechazó el cambio.');
      }

      const partes = [];
      if ('rol' in cambios) partes.push(`ahora es ${ROL_CONFIG[nuevoRol].label}`);
      for (const [rolAdicional, columna] of Object.entries(ROLES_ADICIONALES)) {
        if (!(columna in cambios)) continue;
        const titulo = ROL_CONFIG[rolAdicional].titulo;
        partes.push(cambios[columna] ? `ahora también es ${titulo}` : `ya no es ${titulo}`);
      }

      setCambioRol(null);
      setAviso(`${usuario.nombre} ${partes.join(' y ')}.`);
      setTimeout(() => setAviso(''), 5000);
      fetchUsuarios();
    } catch (err) {
      setErrorCambioRol(err.message);
    } finally {
      setCambiandoRol(false);
    }
  };

  const getRoleBadge = (rol) => {
    const cfg = ROL_CONFIG[rol];
    return cfg
      ? <Badge variant={cfg.badge}>{cfg.label}</Badge>
      : <Badge variant="warning">{rol}</Badge>;
  };

  // Tarjetas de selección de rol, compartidas por el alta y el cambio de rol.
  const renderOpcionesRol = (valor, onSelect, deshabilitado = false) => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      {rolesDisponibles.map(r => {
        const cfg = ROL_CONFIG[r];
        const Icon = ROL_ICONOS[r];
        const isActive = valor === r;

        return (
          <button
            key={r}
            type="button"
            disabled={deshabilitado}
            onClick={() => onSelect(r)}
            style={{
              flex: '1 1 200px',
              padding: '1rem',
              borderRadius: 'var(--radius-lg)',
              border: `2px solid ${isActive ? cfg.color : 'var(--border-color)'}`,
              background: isActive ? cfg.bg : 'var(--bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isActive ? cfg.color : 'var(--text-secondary)' }}>
              <Icon size={18} />
              <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{cfg.label}</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0, lineHeight: '1.4' }}>
              {cfg.descripcion}
            </p>
          </button>
        );
      })}
    </div>
  );

  const filtered = usuarios.filter(u =>
    (u.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    u.rol.toLowerCase().includes(search.toLowerCase()) ||
    (u.es_coordinador === true && 'coordinador'.includes(search.toLowerCase())) ||
    (u.es_coordinador_brigadas === true && 'coordinador de brigadas médicas'.includes(search.toLowerCase()))
  );

  const renderUserTable = (usersList, roleKey) => {
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
                          backgroundColor: getRolBg(u.rol),
                          color: getRolColor(u.rol),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '0.85rem',
                          border: `1px solid rgba(${ROL_CONFIG[u.rol]?.rgb ?? '100, 116, 139'}, 0.13)`,
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
                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {getRoleBadge(u.rol)}
                        {u.es_coordinador === true && getRoleBadge('coordinador')}
                        {u.es_coordinador_brigadas === true && getRoleBadge('coordinador_brigadas')}
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                      {new Date(u.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                          {ROL_CONFIG[u.rol]?.permisos}
                        </span>

                        {u.id !== user?.id && (
                          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                            {isDeveloper && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => abrirCambioRol(u)}
                                style={{ color: 'var(--primary-color)', padding: '0.4rem', height: 'auto' }}
                                title="Gestionar roles"
                                aria-label={`Gestionar roles de ${u.nombre}`}
                              >
                                <UserCog size={16} />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(u.id, u.nombre)}
                              style={{ color: 'var(--danger-color)', padding: '0.4rem', height: 'auto' }}
                              title="Eliminar usuario"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
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
            Registra y administra accesos para Administradores, Coordinadores, Brigadistas y Voluntarios.
          </p>
        </div>
        <Button variant="primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <UserPlus size={18} /> Registrar Personal
        </Button>
      </div>

      {aviso && (
        <div role="status" style={{ padding: '0.75rem 1rem', marginBottom: '1.5rem', background: 'var(--success-bg)', color: 'var(--success-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <UserCheck size={16} />
          <span>{aviso}</span>
        </div>
      )}

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
        {SECCIONES_ROL.map(r => {
          const cfg = ROL_CONFIG[r];
          const Icon = ROL_ICONOS[r];
          const abierto = expandedRoles[r];
          return (
            <div
              key={r}
              onClick={() => toggleRole(r)}
              className={`card glass role-selector-card ${abierto ? `active-${r.replace('_', '-')}` : ''}`}
              style={{
                padding: '1.15rem 1.25rem',
                borderRadius: 'var(--radius-lg)',
                border: `1px solid ${abierto ? cfg.color : 'var(--border-color)'}`,
                boxShadow: abierto ? `0 4px 15px rgba(${cfg.rgb}, 0.12)` : 'none',
                background: abierto ? cfg.bg : 'var(--bg-glass)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                opacity: abierto ? 1 : 0.75
              }}
            >
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                background: cfg.bg,
                color: cfg.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: `1px solid rgba(${cfg.rgb}, 0.15)`
              }}>
                <Icon size={20} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>{cfg.plural}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600', marginTop: '0.15rem' }}>
                  {usuarios.filter(u => tieneRol(u, r)).length} registrados
                </span>
              </div>
              <div style={{ color: abierto ? cfg.color : 'var(--text-tertiary)' }}>
                <span style={{ 
                  fontSize: '0.65rem', 
                  fontWeight: '700', 
                  textTransform: 'uppercase',
                  background: abierto ? `rgba(${cfg.rgb}, 0.12)` : 'var(--bg-surface-hover)',
                  padding: '0.15rem 0.45rem',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  {abierto ? 'Abierto' : 'Cerrado'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Secciones de Tablas Colapsables por Rol */}
      {loading ? (
        <div className="card glass" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Cargando personal de la fundación...
        </div>
      ) : (
        <div className="collapsible-sections-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {SECCIONES_ROL.map(r => (
            <React.Fragment key={r}>
              {renderUserTable(filtered.filter(u => tieneRol(u, r)), r)}
            </React.Fragment>
          ))}
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
                placeholder="Mínimo 12 caracteres"
                required
                minLength={12}
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
            {renderOpcionesRol(rol, setRol, saving)}
          </div>

          <button type="submit" id="user-submit-btn" style={{ display: 'none' }} />
        </form>
      </Modal>

      {/* Modal para gestionar los roles de un usuario existente */}
      <Modal
        isOpen={!!cambioRol}
        onClose={() => { if (!cambiandoRol) setCambioRol(null); }}
        title="Gestionar Roles"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setCambioRol(null)} disabled={cambiandoRol}>Cancelar</Button>
            <Button
              type="button"
              variant="primary"
              disabled={cambiandoRol || !cambioRol || Object.keys(cambiosPendientes(cambioRol)).length === 0}
              onClick={handleCambiarRol}
            >
              {cambiandoRol ? 'Guardando...' : 'Confirmar Cambio'}
            </Button>
          </>
        }
      >
        {cambioRol && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {errorCambioRol && (
              <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{errorCambioRol}</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{cambioRol.usuario.nombre}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{cambioRol.usuario.email}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                Rol actual {getRoleBadge(cambioRol.usuario.rol)}
                {cambioRol.usuario.es_coordinador === true && getRoleBadge('coordinador')}
                {cambioRol.usuario.es_coordinador_brigadas === true && getRoleBadge('coordinador_brigadas')}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Rol principal</span>
              {renderOpcionesRol(cambioRol.nuevoRol, (nuevoRol) => setCambioRol(prev => ({ ...prev, nuevoRol })), cambiandoRol)}
            </div>

            {/* Roles adicionales: se suman al principal, no lo reemplazan */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Roles adicionales</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '-0.35rem' }}>
                Sin uno de estos roles, un Admin no accede a Coordinación.
              </span>
              {Object.keys(ROLES_ADICIONALES).map(r => {
                const cfg = ROL_CONFIG[r];
                const Icon = ROL_ICONOS[r];
                const marcado = cambioRol.adicionales[r];
                return (
                  <label
                    key={r}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '1rem',
                      borderRadius: 'var(--radius-lg)',
                      border: `2px solid ${marcado ? cfg.color : 'var(--border-color)'}`,
                      background: marcado ? cfg.bg : 'var(--bg-surface)',
                      cursor: cambiandoRol ? 'default' : 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={cambiandoRol}
                      onChange={e => setCambioRol(prev => ({ ...prev, adicionales: { ...prev.adicionales, [r]: e.target.checked } }))}
                      style={{ marginTop: '3px', accentColor: cfg.color }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', fontSize: '0.9rem', color: marcado ? cfg.color : 'var(--text-secondary)' }}>
                        <Icon size={18} />
                        {cfg.titulo}
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '0.35rem 0 0', lineHeight: '1.4' }}>
                        {cfg.descripcion}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            {cambioRol.usuario.rol === 'super_admin' && cambioRol.nuevoRol !== 'super_admin' && (
              <div style={{ padding: '0.75rem', background: 'var(--warning-bg)', color: 'var(--warning-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  {cambioRol.usuario.nombre} dejará de ser Admin: perderá el acceso a Gestión de Personal
                  y a todo módulo que su nuevo rol no incluya.
                </span>
              </div>
            )}

            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              El cambio se aplica la próxima vez que {cambioRol.usuario.nombre} inicie sesión o recargue la app.
            </span>
          </div>
        )}
      </Modal>
    </div>
  );
};
