import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { session, role } = useAuth();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Si se especifican roles permitidos y el rol actual no está en la lista
  if (allowedRoles && !allowedRoles.includes(role)) {
    console.warn(`Acceso denegado a la ruta. Rol '${role}' no está en la lista permitida:`, allowedRoles);
    return <Navigate to="/" replace />;
  }

  return children;
};

