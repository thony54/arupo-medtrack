import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Permisos que no son un valor de `perfiles.rol`: cada uno lo da un rol adicional que asigna el
// admin principal (o lo es). Ser Admin (`super_admin`) NO basta para ninguno. Qué datos ve cada
// uno lo decide la base (RLS), no esta ruta. El valor es la propiedad de useAuth() que lo expresa.
const PERMISOS = {
  coordinacion: 'esCoordinacion',          // es_coordinador / es_coordinador_brigadas
  personal: 'puedeGestionarPersonal',      // es_gestor_personal (en un Admin)
  evaluaciones: 'puedeVerEvaluaciones'     // brigadista / es_coordinador_brigadas
};

// `allowedRoles`: lista de valores de `rol` que pasan. `permiso`: una clave de PERMISOS.
export const ProtectedRoute = ({ children, allowedRoles, permiso }) => {
  const auth = useAuth();
  const { session, role, profileStatus, signOut } = auth;

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Las rutas con roles o permisos declarados NO se resuelven hasta conocer el rol real.
  // Antes se decidía con el rol que hubiera en ese instante y, como el valor
  // por defecto era 'super_admin', bastaba esa ventana para entrar a /usuarios.
  if (allowedRoles || permiso) {
    if (profileStatus === 'idle' || profileStatus === 'loading') {
      return (
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          Verificando permisos...
        </div>
      );
    }

    // Fail closed: si el perfil no se pudo leer, no se concede nada.
    if (profileStatus === 'error' || !role) {
      return (
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700' }}>No se pudo verificar tu perfil</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px' }}>
            No fue posible leer tu rol, así que no se concede acceso a esta sección.
            Vuelve a intentarlo o cierra sesión e ingresa de nuevo. Si continúa,
            avisa al administrador: puede que tu cuenta no tenga perfil asignado.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => window.location.reload()} className="btn btn-primary">Reintentar</button>
            <button onClick={() => signOut()} className="btn btn-ghost">Cerrar sesión</button>
          </div>
        </div>
      );
    }

    // Un permiso desconocido no concede nada (fail closed).
    const permitido = permiso ? auth[PERMISOS[permiso]] === true : allowedRoles.includes(role);
    if (!permitido) {
      console.warn(permiso
        ? `Acceso denegado: el rol '${role}' no tiene el permiso '${permiso}'.`
        : `Acceso denegado a la ruta. Rol '${role}' no está en la lista permitida: ${allowedRoles.join(', ')}`);
      return <Navigate to="/" replace />;
    }
  }

  return children;
};
