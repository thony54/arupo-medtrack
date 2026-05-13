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

function App() {
  return (
    <AuthProvider>
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
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

