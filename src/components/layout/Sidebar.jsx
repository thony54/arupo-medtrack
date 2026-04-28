import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Moon, Sun, Activity, Database, LogOut, Users, HandHeart, Layers, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { LoteForm } from '../inventory/LoteForm';
import { SalidaFEFO } from '../inventory/SalidaFEFO';
import { useAuth } from '../../contexts/AuthContext';
import './layout.css';

export const Sidebar = () => {
  const [isDark, setIsDark] = useState(false);
  const [showLoteForm, setShowLoteForm] = useState(false);
  const [showSalida, setShowSalida] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark', !isDark);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItem = (to, Icon, label, end = false) => (
    <NavLink to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end={end}>
      <Icon size={20} />
      <span>{label}</span>
    </NavLink>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div className="sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/arupo-logo.png" alt="Arupo Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
            <span>MedTrack</span>
          </div>
          <div className="header-actions" style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <Button variant="outline" onClick={() => setShowSalida(true)} style={{ width: '32px', minWidth: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--success-color)', borderColor: 'var(--success-color)' }} aria-label="Entregar Donación" title="Entregar Donación">
              <HandHeart size={16} />
            </Button>
            <Button variant="primary" onClick={() => setShowLoteForm(true)} style={{ width: '32px', minWidth: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 10px rgba(16,185,129,0.4)', marginRight: '0.25rem' }} aria-label="Registrar Ingreso" title="Registrar Ingreso">
              <Plus size={18} strokeWidth={2.5} />
            </Button>
            <Button variant="ghost" className="theme-toggle" onClick={toggleTheme} aria-label="Ajustar tema" style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <Button variant="ghost" className="logout-btn" onClick={handleLogout} aria-label="Cerrar sesión" style={{ color: 'var(--danger-color)', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
              <LogOut size={18} />
            </Button>
          </div>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '-1rem', paddingLeft: '0.25rem', fontWeight: '600' }}>Fundación Arupo</p>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-group-title" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '0.25rem 0.5rem 0.25rem', marginTop: '0.25rem' }}>
          General
        </div>
        {navItem('/', LayoutDashboard, 'Inicio', true)}

        <div className="nav-group-title" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '0.75rem 0.5rem 0.25rem' }}>
          Donaciones
        </div>
        {navItem('/inventory', Package, 'Inventario')}
        {navItem('/catalog', Database, 'Catálogo')}

        <div className="nav-group-title" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '0.75rem 0.5rem 0.25rem' }}>
          CRM
        </div>
        {navItem('/beneficiarios', Users, 'Beneficiarios')}
        {navItem('/donantes', HandHeart, 'Donantes')}
      </nav>

      <LoteForm isOpen={showLoteForm} onClose={() => setShowLoteForm(false)} onSuccess={() => { setShowLoteForm(false); window.dispatchEvent(new Event('inventory-updated')); }} />
      <SalidaFEFO isOpen={showSalida} onClose={() => setShowSalida(false)} onSuccess={() => { setShowSalida(false); window.dispatchEvent(new Event('inventory-updated')); }} />
    </aside>
  );
};
