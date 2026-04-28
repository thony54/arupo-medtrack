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

  const navItem = (to, Icon, label, animClass = '', end = false) => (
    <NavLink to={to} className={({ isActive }) => `nav-item ${animClass} ${isActive ? 'active' : ''}`} end={end}>
      <Icon size={20} />
      <span>{label}</span>
    </NavLink>
  );

  return (
    <aside className="sidebar animate-blur-in">
      <div className="sidebar-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div className="sidebar-title animate-reveal" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/arupo-logo.png" alt="Arupo Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
            <span>MedTrack</span>
          </div>
          <div className="header-actions" style={{ display: 'flex', gap: '0.25rem' }}>
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
        <div className="nav-group-title animate-reveal stagger-1" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '0.25rem 0.5rem 0.25rem', marginTop: '0.25rem' }}>
          General
        </div>
        {navItem('/', LayoutDashboard, 'Inicio', 'animate-reveal stagger-2', true)}

        <div className="nav-group-title animate-reveal stagger-2" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '0.75rem 0.5rem 0.25rem' }}>
          Donaciones
        </div>
        {navItem('/inventory', Package, 'Inventario', 'animate-reveal stagger-3')}
        {navItem('/catalog', Database, 'Catálogo', 'animate-reveal stagger-3')}

        <div className="nav-group-title animate-reveal stagger-3" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '0.75rem 0.5rem 0.25rem' }}>
          CRM
        </div>
        {navItem('/beneficiarios', Users, 'Beneficiarios', 'animate-reveal stagger-4')}
        {navItem('/donantes', HandHeart, 'Donantes', 'animate-reveal stagger-5')}
      </nav>


    </aside>
  );
};
