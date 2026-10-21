import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { Catalog } from './pages/Catalog';
import { LoteDetail } from './pages/LoteDetail';
import { Beneficiarios } from './pages/Beneficiarios';
import { Donantes } from './pages/Donantes';
import { Usuarios } from './pages/Usuarios';
import { Perfil } from './pages/Perfil';
import { Evaluaciones } from './pages/Evaluaciones';
import { Bitacoras } from './pages/Bitacoras';
import { Equipos } from './pages/Equipos';
import { Curso } from './pages/Curso';
import { MisActividades } from './pages/MisActividades';
import { Tareas } from './pages/Tareas';
import { ProteccionPantalla } from './components/security/ProteccionPantalla';
import { I18nProvider } from './i18n/I18nProvider';

function App() {
  return (
    <AuthProvider>
      <I18nProvider>
      <ProteccionPantalla />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            {/* La pantalla de inicio / dashboard está permitida para todos los autenticados */}
            <Route index element={<Dashboard />} />
            
            {/* Donaciones Médicas e Inventario: Super Admin y Brigadistas */}
            <Route path="inventory" element={
              <ProtectedRoute allowedRoles={['super_admin', 'brigadista']}>
                <Inventory />
              </ProtectedRoute>
            } />
            
            <Route path="catalog" element={
              <ProtectedRoute allowedRoles={['super_admin', 'brigadista']}>
                <Catalog />
              </ProtectedRoute>
            } />
            
            <Route path="lotes/:productoId" element={
              <ProtectedRoute allowedRoles={['super_admin', 'brigadista']}>
                <LoteDetail />
              </ProtectedRoute>
            } />
            
            <Route path="evaluaciones" element={
              <ProtectedRoute allowedRoles={['super_admin', 'brigadista']}>
                <Evaluaciones />
              </ProtectedRoute>
            } />
            
            {/* CRM y Comunidad: Super Admin y Voluntarios */}
            <Route path="beneficiarios" element={
              <ProtectedRoute allowedRoles={['super_admin', 'voluntario']}>
                <Beneficiarios />
              </ProtectedRoute>
            } />
            
            <Route path="donantes" element={
              <ProtectedRoute allowedRoles={['super_admin', 'voluntario']}>
                <Donantes />
              </ProtectedRoute>
            } />
            
            {/* Administración Interna: Solo Super Admin */}
            <Route path="usuarios" element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <Usuarios />
              </ProtectedRoute>
            } />
            {/* Bitácoras de voluntariado: Super Admin y Coordinadores (rol adicional) */}
            <Route path="bitacoras" element={
              <ProtectedRoute allowedRoles={['super_admin']} permitirCoordinador>
                <Bitacoras />
              </ProtectedRoute>
            } />
            {/* Equipos de voluntariado (líderes y asignaciones): Super Admin y Coordinadores */}
            <Route path="equipos" element={
              <ProtectedRoute allowedRoles={['super_admin']} permitirCoordinador>
                <Equipos />
              </ProtectedRoute>
            } />
            {/* Curso de español (opcional): Voluntarios; el Super Admin puede revisarlo */}
            <Route path="curso" element={
              <ProtectedRoute allowedRoles={['voluntario', 'super_admin']}>
                <Curso />
              </ProtectedRoute>
            } />
            {/* Jornadas cerradas y tareas asignadas: solo Voluntarios */}
            <Route path="actividades" element={
              <ProtectedRoute allowedRoles={['voluntario']}>
                <MisActividades />
              </ProtectedRoute>
            } />
            <Route path="tareas" element={
              <ProtectedRoute allowedRoles={['voluntario']}>
                <Tareas />
              </ProtectedRoute>
            } />
            {/* Perfil del Usuario: Accesible para todos los autenticados */}
            <Route path="perfil" element={<Perfil />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </I18nProvider>
    </AuthProvider>
  );
}

export default App;

