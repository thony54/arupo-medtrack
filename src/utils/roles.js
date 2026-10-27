// Fuente de verdad de los roles de MedTrack: etiquetas, colores y textos.
// El mapeo ruta → roles NO vive aquí: sigue en src/App.jsx (allowedRoles).
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

export const ROL_CONFIG = {
  super_admin: {
    label: 'Super Admin',
    plural: 'Admins',
    titulo: 'Administrador del Sistema',
    color: 'var(--danger-color)',
    bg: 'var(--danger-bg)',
    rgb: '225, 29, 72',
    badge: 'danger',
    permisos: 'Acceso total e irrestricto en todos los módulos.',
    descripcion: 'Acceso total e irrestricto en todos los módulos y gestión de personal.',
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
    descripcion: 'Rol adicional: monitorea y lidera a los brigadistas (revisa sus bitácoras, les asigna tareas y líder y sigue su curso). Se suma al rol principal.'
  }
};

// Roles principales (valores de `perfiles.rol`), de mayor a menor nivel.
export const ROLES_ORDEN = ['super_admin', 'brigadista', 'voluntario'];

// Roles adicionales de coordinación, con la columna booleana de `perfiles` que los marca.
export const ROLES_ADICIONALES = {
  coordinador: 'es_coordinador',
  coordinador_brigadas: 'es_coordinador_brigadas'
};

// Secciones de la pantalla de personal: los principales + los adicionales.
export const SECCIONES_ROL = [...ROLES_ORDEN, ...Object.keys(ROLES_ADICIONALES)];

// ¿El perfil tiene este rol? Cubre el principal y los adicionales.
export const tieneRol = (perfil, rol) =>
  rol in ROLES_ADICIONALES ? perfil?.[ROLES_ADICIONALES[rol]] === true : perfil?.rol === rol;

// Roles principales cuyo personal gestiona el perfil como coordinación: el super_admin, a
// todos; el coordinador, a los voluntarios; el coordinador de brigadas, a los brigadistas.
// Es solo para la interfaz: la base lo hace valer con `puede_gestionar_usuario` (schema_v33).
export const cohortesGestionadas = (perfil) => {
  if (perfil?.rol === 'super_admin') return ['voluntario', 'brigadista'];
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
