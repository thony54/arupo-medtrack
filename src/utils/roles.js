// Fuente de verdad de los roles de MedTrack: etiquetas, colores y textos.
// El mapeo ruta → roles NO vive aquí: sigue en src/App.jsx (allowedRoles).
//
// `rgb` permite derivar sombras y bordes translúcidos del mismo color base.
// `badge` es la variante de <Badge>. `asignablePorDeveloper` marca los roles que
// solo puede otorgar el super admin principal (ver Usuarios.jsx).

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
  coordinador: {
    label: 'Coordinador',
    plural: 'Coordinadores',
    titulo: 'Coordinador de Voluntariado',
    color: '#d97706',
    bg: 'var(--warning-bg)',
    rgb: '217, 119, 6',
    badge: 'warning',
    permisos: 'Coordinación y supervisión del voluntariado.',
    descripcion: 'Gestión integral de voluntarios, supervisión de brigadas y auditoría de actividades.',
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
  }
};

// Orden jerárquico: de mayor a menor nivel.
export const ROLES_ORDEN = ['super_admin', 'coordinador', 'brigadista', 'voluntario'];

export const getRolLabel = (rol, porDefecto = 'Usuario') => ROL_CONFIG[rol]?.label ?? porDefecto;
export const getRolColor = (rol) => ROL_CONFIG[rol]?.color ?? 'var(--text-secondary)';
export const getRolBg = (rol) => ROL_CONFIG[rol]?.bg ?? 'var(--bg-surface-hover)';
