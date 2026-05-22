import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Database, LogOut, Users, HandHeart, Plus, ShoppingBag, Gift, User, UserCog, BadgeAlert, ChevronRight, Activity } from 'lucide-react';
import { Button } from '../ui/Button';
import { ProfileDropdown } from './ProfileDropdown';
import { LoteForm } from '../inventory/LoteForm';
import { SalidaFEFO } from '../inventory/SalidaFEFO';
import { DonacionGeneral } from '../inventory/DonacionGeneral';
import { SalidaGeneral } from '../inventory/SalidaGeneral';
// import { SaludStepper } from '../salud/SaludStepper';
import { useAuth } from '../../contexts/AuthContext';
import './layout.css';

export const Sidebar = () => {
  const [showLoteForm, setShowLoteForm] = useState(false);
  const [showSalida, setShowSalida] = useState(false);
  const [showDonacionGeneral, setShowDonacionGeneral] = useState(false);
  const [showSalidaGeneral, setShowSalidaGeneral] = useState(false);
  const [showSaludStepper, setShowSaludStepper] = useState(false);
  const { signOut, isSuperAdmin, isBrigadista, isVoluntario, profile } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
    <aside className="sidebar">

      <div className="sidebar-header" style={{ marginBottom: '1.5rem' }}>
        <div className="sidebar-header-content">
          <div className="sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/arupo-logo.png" alt="Arupo Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="desktop-only">Med-Track</span>
                <span className="mobile-only" style={{ fontSize: '1.1rem' }}>MedTrack</span>
              </div>
              {!isOnline && (
                <div style={{ 
                  padding: '1px 6px', 
                  background: 'var(--danger-color)', 
                  color: 'white', 
                  borderRadius: '100px', 
                  fontSize: '0.55rem', 
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  marginTop: '2px',
                  width: 'fit-content',
                  animation: 'pulse 2s infinite'
                }}>
                  Modo Local
                </div>
              )}
            </div>
          </div>
          <div className="header-actions">
            
            {/* Botones Médicos: Visibles para Super Admin y Brigadistas */}
            {(isSuperAdmin || isBrigadista) && (
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <Button
                  variant="outline"
                  onClick={() => setShowSaludStepper(true)}
                  style={{ width: '32px', minWidth: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#ec4899', borderColor: '#fbcfe8' }}
                  aria-label="Nueva Evaluación de Salud"
                  title="Nueva Evaluación de Salud"
                >
                  <Activity size={16} />
                </Button>
                <Button variant="outline" onClick={() => setShowSalida(true)} style={{ width: '32px', minWidth: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--success-color)', borderColor: 'var(--success-color)' }} aria-label="Entregar Donación Médica" title="Entregar Donación Médica">
                  <HandHeart size={16} />
                </Button>
                <Button variant="primary" onClick={() => setShowLoteForm(true)} style={{ width: '32px', minWidth: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 10px rgba(16,185,129,0.3)' }} aria-label="Registrar Ingreso Médico" title="Registrar Ingreso Médico">
                  <Plus size={18} strokeWidth={2.5} />
                </Button>
              </div>
            )}

            {/* Separador */}
            {isSuperAdmin && (
              <span style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 0.15rem' }} aria-hidden="true" />
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
                  style={{ width: '32px', minWidth: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', color: '#fff', boxShadow: '0 4px 10px rgba(124,58,237,0.3)', cursor: 'pointer' }}
                  aria-label="Registrar Donación General"
                  title="Registrar Donación General"
                >
                  <ShoppingBag size={15} />
                </Button>
              </div>
            )}
            {/* Separador final eliminado para mayor limpieza visual */}
            {/* Profile Link (The "Old" Button) */}
            <button 
              onClick={() => navigate('/perfil')} 
              className="icon-btn" 
              title="Mi Perfil" 
              style={{ 
                color: 'var(--primary-color)',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--primary-light)',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <User size={18} />
            </button>

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
            {navItem('/evaluaciones', Activity, 'Evaluaciones')}
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
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flex: 1, minWidth: 0 }}>
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
              <p style={{ fontSize: '0.8rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.nombre || 'Cargando...'}
              </p>
              <p style={{ fontSize: '0.65rem', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>
                {getRoleLabel(profile?.rol)}
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => navigate('/perfil')}
            className="icon-btn"
            style={{ color: 'var(--primary-color)' }}
            title="Ver Perfil"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', margin: 0, textAlign: 'center', fontWeight: '500' }}>
          Fundación Arupo &copy; {new Date().getFullYear()}
        </p>
      </div>

      <LoteForm isOpen={showLoteForm} onClose={() => setShowLoteForm(false)} onSuccess={() => window.dispatchEvent(new Event('inventory-updated'))} />
      <SalidaFEFO isOpen={showSalida} onClose={() => setShowSalida(false)} onSuccess={() => window.dispatchEvent(new Event('inventory-updated'))} />
      <DonacionGeneral isOpen={showDonacionGeneral} onClose={() => setShowDonacionGeneral(false)} onSuccess={() => window.dispatchEvent(new Event('inventory-updated'))} />
      <SalidaGeneral isOpen={showSalidaGeneral} onClose={() => setShowSalidaGeneral(false)} onSuccess={() => window.dispatchEvent(new Event('inventory-updated'))} />
      {/* <SaludStepper isOpen={showSaludStepper} onClose={() => setShowSaludStepper(false)} onSuccess={() => window.dispatchEvent(new Event('evaluaciones-updated'))} /> */}
    </aside>
  );
};


