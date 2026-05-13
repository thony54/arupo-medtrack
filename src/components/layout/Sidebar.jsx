import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Moon, Sun, Database, LogOut, Users, HandHeart, Plus, ShoppingBag, Gift, UserCog, BadgeAlert } from 'lucide-react';
import { Button } from '../ui/Button';
import { LoteForm } from '../inventory/LoteForm';
import { SalidaFEFO } from '../inventory/SalidaFEFO';
import { DonacionGeneral } from '../inventory/DonacionGeneral';
import { SalidaGeneral } from '../inventory/SalidaGeneral';
import { useAuth } from '../../contexts/AuthContext';
import './layout.css';

export const Sidebar = () => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; 
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const [showLoteForm, setShowLoteForm] = useState(false);
  const [showSalida, setShowSalida] = useState(false);
  const [showDonacionGeneral, setShowDonacionGeneral] = useState(false);
  const [showSalidaGeneral, setShowSalidaGeneral] = useState(false);
  const { signOut, isSuperAdmin, isBrigadista, isVoluntario, profile } = useAuth();
  const navigate = useNavigate();

  const toggleTheme = () => {
    setIsDark(prev => !prev);
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

  const getRoleLabel = (rol) => {
    switch (rol) {
      case 'super_admin': return 'Super Admin';
      case 'brigadista': return 'Brigadista';
      case 'voluntario': return 'Voluntario';
      default: return 'Usuario';
    }
  };

  const getRoleColor = (rol) => {
    switch (rol) {
      case 'super_admin': return 'var(--danger-color)';
      case 'brigadista': return 'var(--success-color)';
      case 'voluntario': return '#7c3aed';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sidebar-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div className="sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/arupo-logo.png" alt="Arupo Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
            <span className="desktop-only">Med-Track</span>
            <span className="mobile-only" style={{ fontSize: '1.1rem' }}>MedTrack</span>
          </div>
          <div className="header-actions" style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
            
            {/* Botones Médicos: Visibles para Super Admin y Brigadistas */}
            {(isSuperAdmin || isBrigadista) && (
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <Button variant="outline" onClick={() => setShowSalida(true)} style={{ width: '32px', minWidth: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--success-color)', borderColor: 'var(--success-color)' }} aria-label="Entregar Donación Médica" title="Entregar Donación Médica">
                  <HandHeart size={16} />
                </Button>
                <Button variant="primary" onClick={() => setShowLoteForm(true)} style={{ width: '32px', minWidth: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 10px rgba(16,185,129,0.4)' }} aria-label="Registrar Ingreso Médico" title="Registrar Ingreso Médico">
                  <Plus size={18} strokeWidth={2.5} />
                </Button>
              </div>
            )}

            {/* Separador si hay acceso a ambos sets (Solo Desktop para ahorrar espacio) */}
            {isSuperAdmin && (
              <span className="desktop-only" style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 0.15rem' }} aria-hidden="true" />
            )}

            {/* Botones Generales: Visibles para Super Admin y Voluntarios */}
            {(isSuperAdmin || isVoluntario) && (
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <Button
                  variant="outline"
                  onClick={() => setShowSalidaGeneral(true)}
                  style={{ width: '32px', minWidth: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#7c3aed', borderColor: '#c4b5fd' }}
                  aria-label="Entregar Ítems Generales"
                  title="Entregar Ítems Generales"
                >
                  <Gift size={15} />
                </Button>
                <Button
                  onClick={() => setShowDonacionGeneral(true)}
                  style={{ width: '32px', minWidth: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', color: '#fff', boxShadow: '0 4px 10px rgba(124,58,237,0.35)', cursor: 'pointer' }}
                  aria-label="Registrar Donación General"
                  title="Registrar Donación General"
                >
                  <ShoppingBag size={15} />
                </Button>
              </div>
            )}
            
            <span style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 0.15rem' }} aria-hidden="true" />
            
            {/* Theme Switcher */}
            <Button variant="ghost" className="theme-toggle" onClick={toggleTheme} aria-label="Ajustar tema" style={{ padding: '0.5rem', width: '32px', minWidth: '32px', height: '32px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </Button>

            {/* MINI AVATAR DE USUARIO EN MÓVIL (Limpio y en su sitio) */}
            <div 
              className="mobile-only-flex" 
              onClick={() => navigate('/perfil')}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: getRoleColor(profile?.rol),
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '0.75rem',
                cursor: 'pointer',
                marginLeft: '0.25rem',
                border: '2px solid var(--bg-surface)'
              }}
              title="Mi Perfil"
            >
              {(profile?.nombre || 'U').substring(0, 2).toUpperCase()}
            </div>

          </div>
        </div>
      </div>

      <nav className="sidebar-nav" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="nav-group-title" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '0.25rem 0.5rem 0.25rem', marginTop: '0.25rem' }}>
          General
        </div>
        {navItem('/', LayoutDashboard, 'Inicio', true)}

        {/* Sección Donaciones / Medicinas: Visible para Super Admin y Brigadistas */}
        {(isSuperAdmin || isBrigadista) && (
          <>
            <div className="nav-group-title" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '0.75rem 0.5rem 0.25rem' }}>
              {isBrigadista ? 'Medicina' : 'Donaciones Médicas'}
            </div>
            {navItem('/inventory', Package, 'Inventario')}
            {navItem('/catalog', Database, 'Catálogo')}
          </>
        )}

        {/* Sección CRM: Visible para Super Admin y Voluntarios */}
        {(isSuperAdmin || isVoluntario) && (
          <>
            <div className="nav-group-title" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '0.75rem 0.5rem 0.25rem' }}>
              Comunidad / CRM
            </div>
            {navItem('/beneficiarios', Users, 'Beneficiarios')}
            {navItem('/donantes', HandHeart, 'Donantes')}
          </>
        )}

        {/* Sección Administración: Visible SOLO para Super Admin */}
        {isSuperAdmin && (
          <>
            <div className="nav-group-title" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '0.75rem 0.5rem 0.25rem' }}>
              Administración
            </div>
            {navItem('/usuarios', UserCog, 'Gestión de Personal')}
          </>
        )}
      </nav>

      {/* FOOTER DE ESCRITORIO: Tarjeta del Usuario y Copyright en la parte inferior */}
      <div className="desktop-only" style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        
        {/* Perfil del Usuario Adaptable */}
        <div style={{ 
          padding: '0.75rem', 
          borderRadius: 'var(--radius-lg)', 
          background: 'var(--bg-surface-hover)', 
          border: '1px solid var(--border-color)', 
          marginBottom: '0.75rem'
        }}>
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            <div 
              onClick={() => navigate('/perfil')} 
              title="Ver mi perfil"
              style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flex: 1, minWidth: 0, cursor: 'pointer' }}
            >
              <div style={{ 
                width: '34px', 
                height: '34px', 
                borderRadius: '50%', 
                backgroundColor: getRoleColor(profile?.rol), 
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '0.85rem',
                flexShrink: 0
              }}>
                {(profile?.nombre || 'U').substring(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: '600', margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {profile?.nombre || 'Cargando...'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.1rem' }}>
                  <span style={{ 
                    display: 'inline-block', 
                    width: '5px', 
                    height: '5px', 
                    borderRadius: '50%', 
                    backgroundColor: getRoleColor(profile?.rol)
                  }} />
                  <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    {getRoleLabel(profile?.rol)}
                  </span>
                </div>
              </div>
            </div>
            <Button variant="ghost" onClick={handleLogout} aria-label="Cerrar sesión" style={{ color: 'var(--danger-color)', padding: '0.35rem', borderRadius: 'var(--radius-md)', width: 'auto', minWidth: 'unset', height: 'auto' }} title="Cerrar Sesión">
              <LogOut size={15} />
            </Button>
          </div>
        </div>

        <p style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', margin: 0, textAlign: 'center', fontWeight: '500' }}>
          Fundación Arupo &copy; {new Date().getFullYear()}
        </p>
      </div>

      <LoteForm isOpen={showLoteForm} onClose={() => setShowLoteForm(false)} onSuccess={() => window.dispatchEvent(new Event('inventory-updated'))} />
      <SalidaFEFO isOpen={showSalida} onClose={() => setShowSalida(false)} onSuccess={() => window.dispatchEvent(new Event('inventory-updated'))} />
      <DonacionGeneral isOpen={showDonacionGeneral} onClose={() => setShowDonacionGeneral(false)} onSuccess={() => window.dispatchEvent(new Event('inventory-updated'))} />
      <SalidaGeneral isOpen={showSalidaGeneral} onClose={() => setShowSalidaGeneral(false)} onSuccess={() => window.dispatchEvent(new Event('inventory-updated'))} />
    </aside>
  );
};


