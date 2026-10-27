import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// `permitirCoordinador`: además de allowedRoles, deja pasar a quien tenga alguno de los
// roles adicionales de coordinación (perfiles.es_coordinador o es_coordinador_brigadas),
// que no son valores de `rol`. Qué personas ve cada uno lo decide la base (RLS).
export const ProtectedRoute = ({ children, allowedRoles, permitirCoordinador = false }) => {
  const { session, role, isCoordinador, isCoordinadorBrigadas, profileStatus, signOut } = useAuth();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Las rutas con roles declarados NO se resuelven hasta conocer el rol real.
  // Antes se decidía con el rol que hubiera en ese instante y, como el valor
  // por defecto era 'super_admin', bastaba esa ventana para entrar a /usuarios.
  if (allowedRoles) {
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

    if (!allowedRoles.includes(role) && !(permitirCoordinador && (isCoordinador || isCoordinadorBrigadas))) {
      console.warn(`Acceso denegado a la ruta. Rol '${role}' no está en la lista permitida:`, allowedRoles);
      return <Navigate to="/" replace />;
    }
  }

  return children;
};
