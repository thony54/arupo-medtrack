// Fuente de verdad de los roles de MedTrack: etiquetas, colores y textos.
// El mapeo ruta → roles NO vive aquí: sigue en src/App.jsx (allowedRoles).
//
// Hay dos tipos de rol:
//   · Rol PRINCIPAL: un solo valor en `perfiles.rol` (ROLES_ORDEN).
//   · Rol ADICIONAL "coordinador": marca `perfiles.es_coordinador`. Se SUMA al
//     principal (un super_admin puede ser además Coordinador de Voluntariado),
//     por eso no es un valor más de `perfiles.rol`.
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
  }
};

// Roles principales (valores de `perfiles.rol`), de mayor a menor nivel.
export const ROLES_ORDEN = ['super_admin', 'brigadista', 'voluntario'];

// Secciones de la pantalla de personal: los principales + el adicional.
export const SECCIONES_ROL = [...ROLES_ORDEN, 'coordinador'];

// ¿El perfil tiene este rol? Cubre el principal y el adicional.
export const tieneRol = (perfil, rol) =>
  rol === 'coordinador' ? perfil?.es_coordinador === true : perfil?.rol === rol;

export const getRolLabel = (rol, porDefecto = 'Usuario') => ROL_CONFIG[rol]?.label ?? porDefecto;
export const getRolColor = (rol) => ROL_CONFIG[rol]?.color ?? 'var(--text-secondary)';
export const getRolBg = (rol) => ROL_CONFIG[rol]?.bg ?? 'var(--bg-surface-hover)';
