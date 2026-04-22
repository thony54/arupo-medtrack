import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Moon, Sun, Activity, Database, LogOut, Users, HandHeart, Layers } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import './layout.css';

export const Sidebar = () => {
  const [isDark, setIsDark] = useState(false);
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
        <div className="sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/logo.png" alt="Arupo Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
          <span>MedTrack</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', paddingLeft: '0.25rem', fontWeight: '600' }}>Fundación Arupo</p>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-group-title" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '0.25rem 0.5rem 0.25rem', marginTop: '0.25rem' }}>
          General
        </div>
        {navItem('/', LayoutDashboard, 'Centro de Operaciones', true)}

        <div className="nav-group-title" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '0.75rem 0.5rem 0.25rem' }}>
          Donaciones
        </div>
        {navItem('/inventory', Package, 'Banco de Medicamentos')}
        {navItem('/catalog', Database, 'Medicamentos Base')}

        <div className="nav-group-title" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '0.75rem 0.5rem 0.25rem' }}>
          CRM
        </div>
        {navItem('/beneficiarios', Users, 'Beneficiarios')}
        {navItem('/donantes', HandHeart, 'Donantes')}
      </nav>

      <div className="sidebar-footer" style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
        <Button variant="ghost" className="theme-toggle" onClick={toggleTheme} aria-label="Ajustar tema">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
          <span>{isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>
        </Button>
        <Button variant="ghost" className="logout-btn" onClick={handleLogout} aria-label="Cerrar sesión" style={{ color: 'var(--danger-color)' }}>
          <LogOut size={20} />
          <span>Salir</span>
        </Button>
      </div>
    </aside>
  );
};
