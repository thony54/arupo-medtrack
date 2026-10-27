// Fuente de verdad de los roles de MedTrack: etiquetas, colores y textos.
// El mapeo ruta → roles NO vive aquí: sigue en src/App.jsx (allowedRoles).
//
// Jerarquía: el ADMIN PRINCIPAL (EMAIL_ADMIN_PRINCIPAL) no tiene a nadie por encima. Debajo
// están los Admin (`rol = 'super_admin'`; "Admin" es solo la etiqueta: el valor en la base no
// cambia) y, por debajo, brigadistas y voluntarios. Ser Admin NO da acceso a Coordinación, a
// las Evaluaciones de salud ni a Gestión de Personal: cada una la da un rol que el admin
// principal asigne (ver abajo). El admin principal accede a todo.
//   · Coordinación ............ es_coordinador (voluntarios) / es_coordinador_brigadas (brigadistas)
//   · Evaluaciones de salud ... brigadista (las suyas) / es_coordinador_brigadas (todas)
//   · Gestión de Personal ..... es_gestor_personal (solo en un Admin)
//
// Hay dos tipos de rol:
//   · Rol PRINCIPAL: un solo valor en `perfiles.rol` (ROLES_ORDEN).
//   · Roles ADICIONALES de coordinación, que se SUMAN al principal (un super_admin
//     puede ser además Coordinador de Voluntariado), por eso no son valores de
//     `perfiles.rol`:
//       - "coordinador"           → `perfiles.es_coordinador`: lidera a los voluntarios.
//       - "coordinador_brigadas"  → `perfiles.es_coordinador_brigadas`: lidera a los
//                                   brigadistas (Coordinador de Brigadas Médicas).
//     Solo los otorga el super admin principal (Usuarios.jsx).
//
// `rgb` permite derivar sombras y bordes translúcidos del mismo color base.
// `badge` es la variante de <Badge>. `asignablePorDeveloper` marca los roles
// principales que solo puede otorgar el super admin principal (Usuarios.jsx).

// Único correo con rango de admin principal. Es solo para la interfaz: la base lo hace valer
// con `es_super_admin_principal()` (schema_v33.sql), que lee el correo del JWT.
export const EMAIL_ADMIN_PRINCIPAL = 'thony.karter@gmail.com';

export const esAdminPrincipal = (email) =>
  typeof email === 'string' && email.trim().toLowerCase() === EMAIL_ADMIN_PRINCIPAL;

export const ROL_CONFIG = {
  super_admin: {
    label: 'Admin',
    plural: 'Admins',
    titulo: 'Administrador',
    color: 'var(--danger-color)',
    bg: 'var(--danger-bg)',
    rgb: '225, 29, 72',
    badge: 'danger',
    permisos: 'Administración de inventario, CRM y personal.',
    descripcion: 'Administra inventario, CRM y personal. No accede a Coordinación salvo que el admin principal le asigne un rol de coordinación.',
    asignablePorDeveloper: true
  },
  brigadista: {
    label: 'Brigadista',
    plural: 'Brigadistas',
    titulo: 'Especialista Médico / Brigadista',
    color: 'var(--success-color)',
    bg: 'var(--success-bg)',
    rgb: '16, 185, 129',
    badge: 'success',
    permisos: 'Gestión de Medicinas, Lotes e Inventario.',
    descripcion: 'Acceso a inventario médico, registro de lotes y entregas de medicinas.',
    asignablePorDeveloper: false
  },
  voluntario: {
    label: 'Voluntario',
    plural: 'Voluntarios',
    titulo: 'Voluntario / Gestión de Donaciones',
    color: '#7c3aed',
    bg: '#ede9fe',
    rgb: '124, 58, 237',
    badge: 'info',
    permisos: 'Gestión del CRM, Donantes y Beneficiarios.',
    descripcion: 'Acceso a CRM, gestión de donantes y registro de beneficiarios.',
    asignablePorDeveloper: false
  },
  // Rol adicional (ver cabecera). Solo lo otorga el super admin principal.
  coordinador: {
    label: 'Coordinador',
    plural: 'Coordinadores',
    titulo: 'Coordinador de Voluntariado',
    color: '#d97706',
    bg: 'var(--warning-bg)',
    rgb: '217, 119, 6',
    badge: 'warning',
    permisos: 'Coordinación y supervisión del voluntariado.',
    descripcion: 'Rol adicional: gestión integral de voluntarios, supervisión de brigadas y auditoría de actividades. Se suma al rol principal.'
  },
  coordinador_brigadas: {
    label: 'Coordinador de Brigadas',
    plural: 'Coordinadores de Brigadas',
    titulo: 'Coordinador de Brigadas Médicas',
    color: '#0891b2',
    bg: 'rgba(8, 145, 178, 0.12)',
    rgb: '8, 145, 178',
    badge: 'brigadas',
    permisos: 'Monitoreo y liderazgo de los brigadistas.',
    descripcion: 'Rol adicional: monitorea y lidera a los brigadistas (revisa sus bitácoras, les asigna tareas y líder y sigue su curso) y ve todas las evaluaciones de salud. Se suma al rol principal.'
  },
  gestion_personal: {
    label: 'Gestión de Personal',
    plural: 'Gestión de Personal',
    titulo: 'Gestión de Personal',
    color: '#4f46e5',
    bg: 'rgba(79, 70, 229, 0.12)',
    rgb: '79, 70, 229',
    badge: 'gestion',
    permisos: 'Ve, registra y elimina personal.',
    descripcion: 'Rol adicional solo para Admins: ve, registra y elimina brigadistas y voluntarios en Gestión de Personal. No puede tocar a otros Admin. Sin este rol, un Admin no gestiona personal.'
  }
};

// Roles principales (valores de `perfiles.rol`), de mayor a menor nivel.
export const ROLES_ORDEN = ['super_admin', 'brigadista', 'voluntario'];

// Roles adicionales de coordinación, con la columna booleana de `perfiles` que los marca.
export const ROLES_ADICIONALES = {
  coordinador: 'es_coordinador',
  coordinador_brigadas: 'es_coordinador_brigadas',
  gestion_personal: 'es_gestor_personal'
};

// Roles adicionales que solo tienen sentido en un Admin (`rol = 'super_admin'`).
export const ROLES_SOLO_ADMIN = ['gestion_personal'];

// Secciones de la pantalla de personal: los principales + los adicionales.
export const SECCIONES_ROL = [...ROLES_ORDEN, ...Object.keys(ROLES_ADICIONALES)];

// ¿El perfil tiene este rol? Cubre el principal y los adicionales.
export const tieneRol = (perfil, rol) =>
  rol in ROLES_ADICIONALES ? perfil?.[ROLES_ADICIONALES[rol]] === true : perfil?.rol === rol;

// Roles principales cuyo personal gestiona el perfil como coordinación: el admin principal, a
// todos; el coordinador, a los voluntarios; el coordinador de brigadas, a los brigadistas.
// Un Admin corriente no gestiona a nadie: [] = sin acceso a Coordinación.
// Es solo para la interfaz: la base lo hace valer con `puede_gestionar_usuario` (schema_v35).
export const cohortesGestionadas = (perfil, email) => {
  if (perfil?.rol === 'super_admin' && esAdminPrincipal(email)) return ['voluntario', 'brigadista'];
  const cohortes = [];
  if (perfil?.es_coordinador === true) cohortes.push('voluntario');
  if (perfil?.es_coordinador_brigadas === true) cohortes.push('brigadista');
  return cohortes;
};

// Cómo llamar a la gente que gestiona la pantalla según las cohortes que le tocan.
//   singular / plural → títulos y columnas ("Voluntario", "Voluntarios (12)")
//   personas          → minúsculas, para contar ("3 voluntarios")
//   quienes           → "Jornadas que cierran {quienes}"
//   elige             → "Elige {elige}..."
//   todos             → opción "sin filtrar" de un selector
//   area              → "Bitácoras {area}"
const ETIQUETAS_PERSONAL = {
  brigadista: { singular: 'Brigadista', plural: 'Brigadistas', personas: 'brigadistas', quienes: 'los brigadistas', elige: 'al brigadista', todos: 'Todos los brigadistas', area: 'de Brigadas Médicas' },
  voluntario: { singular: 'Voluntario', plural: 'Voluntarios', personas: 'voluntarios', quienes: 'los voluntarios', elige: 'al voluntario', todos: 'Todos los voluntarios', area: 'de Voluntariado' },
  ambos: { singular: 'Persona', plural: 'Personal', personas: 'personas', quienes: 'los voluntarios y brigadistas', elige: 'a la persona', todos: 'Todas las personas', area: 'de Voluntariado y Brigadas' }
};

export const etiquetasPersonal = (cohortes) =>
  cohortes.length === 1 ? ETIQUETAS_PERSONAL[cohortes[0]] ?? ETIQUETAS_PERSONAL.ambos : ETIQUETAS_PERSONAL.ambos;

export const getRolLabel = (rol, porDefecto = 'Usuario') => ROL_CONFIG[rol]?.label ?? porDefecto;
export const getRolColor = (rol) => ROL_CONFIG[rol]?.color ?? 'var(--text-secondary)';
export const getRolBg = (rol) => ROL_CONFIG[rol]?.bg ?? 'var(--bg-surface-hover)';
