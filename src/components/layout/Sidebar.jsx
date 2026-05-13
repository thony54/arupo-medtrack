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
      <div className="sidebar-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div className="sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/arupo-logo.png" alt="Arupo Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
            <span>Med-Track</span>
          </div>
          <div className="header-actions" style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            
            {/* Botones Médicos: Visibles para Super Admin y Brigadistas */}
            {(isSuperAdmin || isBrigadista) && (
              <>
                <Button variant="outline" onClick={() => setShowSalida(true)} style={{ width: '32px', minWidth: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--success-color)', borderColor: 'var(--success-color)' }} aria-label="Entregar Donación Médica" title="Entregar Donación Médica">
                  <HandHeart size={16} />
                </Button>
                <Button variant="primary" onClick={() => setShowLoteForm(true)} style={{ width: '32px', minWidth: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 10px rgba(16,185,129,0.4)' }} aria-label="Registrar Ingreso Médico" title="Registrar Ingreso Médico">
                  <Plus size={18} strokeWidth={2.5} />
                </Button>
              </>
            )}

            {/* Separador si hay acceso a ambos sets */}
            {isSuperAdmin && (
              <span style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 0.1rem' }} aria-hidden="true" />
            )}

            {/* Botones Generales: Visibles para Super Admin y Voluntarios */}
            {(isSuperAdmin || isVoluntario) && (
              <>
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
                  title="Registrar Donación General (ropa, higiene, etc.)"
                >
                  <ShoppingBag size={15} />
                </Button>
              </>
            )}
            
            <span style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 0.1rem' }} aria-hidden="true" />
            <Button variant="ghost" className="theme-toggle" onClick={toggleTheme} aria-label="Ajustar tema" style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          </div>
        </div>
        
        {/* Perfil del Usuario en la Barra Lateral */}
        <div style={{ 
          padding: '0.75rem', 
          borderRadius: 'var(--radius-lg)', 
          background: 'rgba(255,255,255,0.04)', 
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.05)', 
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '50%', 
              backgroundColor: getRoleColor(profile?.rol), 
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '0.9rem'
            }}>
              {profile?.nombre ? profile.nombre.substring(0, 2).toUpperCase() : 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.85rem', fontWeight: '600', margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.nombre || 'Cargando...'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.1rem' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  backgroundColor: getRoleColor(profile?.rol)
                }} />
                <span style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                  {getRoleLabel(profile?.rol)}
                </span>
              </div>
            </div>
            <Button variant="ghost" onClick={handleLogout} aria-label="Cerrar sesión" style={{ color: 'var(--danger-color)', padding: '0.35rem', borderRadius: 'var(--radius-md)', width: 'auto', minWidth: 'unset', height: 'auto' }}>
              <LogOut size={16} />
            </Button>
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

      <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: 0, textAlign: 'center', fontWeight: '500' }}>
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

