import React, { useState, useEffect } from 'react';
import {
  UserPlus, Search, Shield, Mail, Trash2, UserCheck, AlertCircle,
  Eye, EyeOff, HandHeart, Activity, ClipboardCheck, UserCog, Stethoscope, X, Users, ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cargarPersonal } from '../lib/personal';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { ROL_CONFIG, ROLES_ORDEN, ROLES_ADICIONALES, ROLES_SOLO_ADMIN, SECCIONES_ROL, tieneRol, getRolColor, getRolBg } from '../utils/roles';
import './pages.css';
import './usuarios.css';

import { useAuth } from '../contexts/AuthContext';

const ROL_ICONOS = {
  super_admin: Shield,
  coordinador: ClipboardCheck,
  coordinador_brigadas: Stethoscope,
  gestion_personal: UserCog,
  brigadista: Activity,
  voluntario: HandHeart
};

// Personas que se pintan de golpe; el resto, con "Mostrar más". Un grupo como Voluntarios
// puede ser largo y nadie necesita ver todo para encontrar a una persona.
const POR_PAGINA = 20;

const normalizar = (texto) => (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

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
  // con `adicionales` = { coordinador, coordinador_brigadas, gestion_personal } (booleanos).
  const [cambioRol, setCambioRol] = useState(null);
  const [cambiandoRol, setCambiandoRol] = useState(false);
  const [errorCambioRol, setErrorCambioRol] = useState('');
  const [aviso, setAviso] = useState('');
  const [errorLista, setErrorLista] = useState('');
  const [eliminandoId, setEliminandoId] = useState(null);

  // Grupo de personal que se está viendo. Al abrir la pantalla no hay ninguno: se elige uno
  // (o se busca) y solo entonces se pinta esa lista.
  const [categoria, setCategoria] = useState(null);
  const [mostrar, setMostrar] = useState(POR_PAGINA);

  const elegirCategoria = (clave) => {
    setCategoria(prev => (prev === clave ? null : clave));
    setMostrar(POR_PAGINA);
  };

  const cambiarBusqueda = (valor) => {
    setSearch(valor);
    setMostrar(POR_PAGINA);
  };

  // Recarga silenciosa tras crear, eliminar o cambiar el rol de alguien.
  const fetchUsuarios = async () => {
    try {
      setUsuarios(await cargarPersonal());
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
    }
  };

  useEffect(() => {
    let vigente = true;
    cargarPersonal()
      .then(data => { if (vigente) setUsuarios(data); })
      .catch(err => {
        console.error('Error al cargar usuarios:', err);
        if (vigente) setUsuarios([]);
      })
      .finally(() => { if (vigente) setLoading(false); });
    return () => { vigente = false; };
  }, []);

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

    setEliminandoId(userId);
    setErrorLista('');
    try {
      const { error: delError } = await supabase.rpc('eliminar_usuario', {
        p_user_id: userId
      });

      if (delError) throw delError;

      setAviso(`${userNombre} fue eliminado.`);
      setTimeout(() => setAviso(''), 5000);
      fetchUsuarios();
    } catch (err) {
      console.error('Error al eliminar:', err);
      setErrorLista('No se pudo eliminar el usuario. Asegúrate de haber ejecutado schema_v13.sql');
    } finally {
      setEliminandoId(null);
    }
  };

  // Gestiona los roles de un usuario ya existente: el principal (`rol`) y los
  // adicionales (`es_coordinador`, `es_coordinador_brigadas`, `es_gestor_personal`). Solo los
  // ofrece la interfaz al admin principal; la base lo hace valer: el trigger de `perfiles`
  // exige al admin principal para cambiar cualquiera de ellos (schema_v33/v35/v36).
  const abrirCambioRol = (u) => {
    setErrorCambioRol('');
    setCambioRol({
      usuario: u,
      nuevoRol: u.rol,
      adicionales: Object.fromEntries(Object.keys(ROLES_ADICIONALES).map(r => [r, tieneRol(u, r)]))
    });
  };

  // Valor que quedará de un rol adicional: los que solo valen en un Admin se quitan si deja de serlo.
  const valorAdicional = (c, rolAdicional) =>
    ROLES_SOLO_ADMIN.includes(rolAdicional) && c.nuevoRol !== 'super_admin' ? false : c.adicionales[rolAdicional];

  // Campos que realmente cambian respecto al perfil actual.
  const cambiosPendientes = (c) => {
    const cambios = {};
    if (c.nuevoRol !== c.usuario.rol) cambios.rol = c.nuevoRol;
    for (const [rolAdicional, columna] of Object.entries(ROLES_ADICIONALES)) {
      const valor = valorAdicional(c, rolAdicional);
      if (valor !== tieneRol(c.usuario, rolAdicional)) cambios[columna] = valor;
    }
    return cambios;
  };

  // Insignias de los roles adicionales de una persona (el de gestión solo cuenta en un Admin).
  const insigniasAdicionales = (u) =>
    Object.keys(ROLES_ADICIONALES)
      .filter(r => tieneRol(u, r) && (!ROLES_SOLO_ADMIN.includes(r) || u.rol === 'super_admin'))
      .map(r => <React.Fragment key={r}>{getRoleBadge(r)}</React.Fragment>);

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
        // 42703 / PGRST204: la columna aún no existe (falta schema_v22, v33 o v36).
        const faltaColumna = ['42703', 'PGRST204'].includes(updError.code);
        const scriptFalta = 'es_gestor_personal' in cambios
          ? 'schema_v36.sql'
          : 'es_coordinador_brigadas' in cambios ? 'schema_v33.sql' : 'schema_v22.sql';
        throw new Error(
          faltaColumna
            ? `La base de datos aún no admite ese rol. Ejecuta ${scriptFalta} en el SQL Editor de Supabase.`
            : updError.code === '42501'
              ? 'La base de datos rechazó el cambio: solo el admin principal puede otorgar este rol.'
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

  const termino = normalizar(search.trim());
  const coincideBusqueda = (u) =>
    !termino ||
    normalizar(u.nombre).includes(termino) ||
    normalizar(u.email).includes(termino) ||
    normalizar(u.rol).includes(termino) ||
    normalizar(ROL_CONFIG[u.rol]?.label).includes(termino) ||
    Object.keys(ROLES_ADICIONALES).some(r => tieneRol(u, r) && normalizar(ROL_CONFIG[r].titulo).includes(termino));

  // Cuántas personas tiene cada grupo (con la búsqueda aplicada, si hay).
  const conteo = Object.fromEntries(
    SECCIONES_ROL.map(r => [r, usuarios.filter(u => tieneRol(u, r) && coincideBusqueda(u)).length])
  );

  const hayVista = categoria !== null || termino !== '';
  const lista = hayVista
    ? usuarios.filter(u => (categoria === null || tieneRol(u, categoria)) && coincideBusqueda(u))
    : [];
  const cfgCategoria = categoria ? ROL_CONFIG[categoria] : null;
  const IconoCategoria = categoria ? ROL_ICONOS[categoria] : Search;

  const renderPersona = (u) => {
    const rgb = ROL_CONFIG[u.rol]?.rgb ?? '100, 116, 139';
    return (
      <li key={u.id} className="persona">
        <span
          className="persona-avatar"
          style={{ '--c-rgb': rgb, backgroundColor: getRolBg(u.rol), color: getRolColor(u.rol) }}
          aria-hidden="true"
        >
          {(u.nombre || 'U').substring(0, 2).toUpperCase()}
        </span>

        <div className="persona-main">
          <span className="persona-nombre">{u.nombre}</span>
          <span className="persona-email">
            <Mail size={13} />
            <span>{u.email}</span>
          </span>
        </div>

        <div className="persona-roles">
          {getRoleBadge(u.rol)}
          {insigniasAdicionales(u)}
        </div>

        <span className="persona-fecha">
          {u.created_at ? new Date(u.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
        </span>

        {u.id !== user?.id && (
          <div className="persona-acciones">
            {isDeveloper && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => abrirCambioRol(u)}
                style={{ color: 'var(--primary-color)' }}
                title="Gestionar roles"
                aria-label={`Gestionar roles de ${u.nombre}`}
              >
                <UserCog size={18} />
              </Button>
            )}
            {/* Solo el admin principal elimina a un Admin (la base lo hace valer). */}
            {(u.rol !== 'super_admin' || isDeveloper) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteUser(u.id, u.nombre)}
                disabled={eliminandoId === u.id}
                style={{ color: 'var(--danger-color)' }}
                title="Eliminar usuario"
                aria-label={`Eliminar a ${u.nombre}`}
              >
                <Trash2 size={18} />
              </Button>
            )}
          </div>
        )}
      </li>
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

      {errorLista && (
        <div role="alert" style={{ padding: '0.75rem 1rem', marginBottom: '1.5rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{errorLista}</span>
        </div>
      )}

      <div className="personal-buscar">
        <Search size={18} />
        <input
          className="input-field"
          type="search"
          placeholder="Buscar por nombre, email o rol..."
          aria-label="Buscar personal"
          value={search}
          onChange={e => cambiarBusqueda(e.target.value)}
        />
        {search && (
          <button type="button" className="personal-buscar-limpiar" onClick={() => cambiarBusqueda('')} aria-label="Borrar búsqueda">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Selector de grupo: se elige uno y solo se pinta su lista */}
      <div className="personal-filtros" role="group" aria-label="Grupo de personal">
        {SECCIONES_ROL.map(r => {
          const cfg = ROL_CONFIG[r];
          const Icon = ROL_ICONOS[r];
          const activo = categoria === r;
          const n = conteo[r];
          return (
            <button
              key={r}
              type="button"
              className={`personal-filtro ${activo ? 'is-active' : ''} ${n === 0 ? 'is-vacio' : ''}`}
              style={{ '--c': cfg.color, '--c-bg': cfg.bg, '--c-rgb': cfg.rgb }}
              aria-pressed={activo}
              onClick={() => elegirCategoria(r)}
            >
              <span className="personal-filtro-icono"><Icon size={19} /></span>
              <span className="personal-filtro-texto">
                <strong>{cfg.plural}</strong>
                <small>{loading ? '…' : `${n} ${n === 1 ? 'persona' : 'personas'}`}</small>
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="card glass" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Cargando personal de la fundación...
        </div>
      ) : !hayVista ? (
        <div className="personal-hint">
          <Users size={40} />
          <strong>Elige un grupo para ver a su personal</strong>
          <span>
            Hay {usuarios.length} {usuarios.length === 1 ? 'persona registrada' : 'personas registradas'}. Toca un grupo arriba o escribe en el buscador para encontrar a alguien en todos.
          </span>
        </div>
      ) : (
        <div style={cfgCategoria ? { '--c': cfgCategoria.color, '--c-bg': cfgCategoria.bg, '--c-rgb': cfgCategoria.rgb } : undefined}>
          <div className="personal-resultados-head">
            <span className="personal-resultados-icono"><IconoCategoria size={18} /></span>
            <div className="personal-resultados-titulo">
              <h2>{cfgCategoria ? cfgCategoria.plural : 'Resultados de la búsqueda'} · {lista.length}</h2>
              {cfgCategoria && <p>{cfgCategoria.permisos}</p>}
            </div>
          </div>

          {categoria && termino && (
            <button type="button" className="personal-todos-btn" onClick={() => setCategoria(null)}>
              Buscar “{search.trim()}” en todos los grupos
            </button>
          )}

          {lista.length === 0 ? (
            <div className="personal-hint">
              <Shield size={36} />
              <span>
                {termino
                  ? 'Nadie coincide con la búsqueda.'
                  : 'No hay personal registrado en este grupo.'}
              </span>
            </div>
          ) : (
            <>
              <ul className="personal-lista">
                {lista.slice(0, mostrar).map(renderPersona)}
              </ul>
              {lista.length > mostrar && (
                <div className="personal-mas">
                  <Button variant="outline" onClick={() => setMostrar(m => m + POR_PAGINA)}>
                    <ChevronDown size={16} /> Mostrar más ({lista.length - mostrar} restantes)
                  </Button>
                </div>
              )}
            </>
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
                {insigniasAdicionales(cambioRol.usuario)}
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
                // Los roles que solo valen en un Admin aparecen solo si la persona será Admin.
                if (ROLES_SOLO_ADMIN.includes(r) && cambioRol.nuevoRol !== 'super_admin') return null;
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
