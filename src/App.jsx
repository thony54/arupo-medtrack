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
            <Route index element={<Dashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="catalog" element={<Catalog />} />
            <Route path="lotes/:productoId" element={<LoteDetail />} />
            <Route path="beneficiarios" element={<Beneficiarios />} />
            <Route path="donantes" element={<Donantes />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
