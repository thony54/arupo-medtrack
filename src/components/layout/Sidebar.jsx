import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Database, Users, HandHeart, Plus, ShoppingBag, Gift, User, UserCog, ChevronRight, Activity, ClipboardCheck, ClipboardList, ListChecks, ListPlus, Network, GraduationCap } from 'lucide-react';
import { Button } from '../ui/Button';
import { LoteForm } from '../inventory/LoteForm';
import { SalidaFEFO } from '../inventory/SalidaFEFO';
import { DonacionGeneral } from '../inventory/DonacionGeneral';
import { SalidaGeneral } from '../inventory/SalidaGeneral';
import { MobileNav } from './MobileNav';
// import { SaludStepper } from '../salud/SaludStepper';
import { useAuth } from '../../contexts/AuthContext';
import { getRolColor } from '../../utils/roles';
import { useI18n } from '../../i18n/useI18n';
import './layout.css';

const estiloTituloGrupo = {
  fontSize: '0.7rem',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-tertiary)'
};

export const Sidebar = () => {
  const [showLoteForm, setShowLoteForm] = useState(false);
  const [showSalida, setShowSalida] = useState(false);
  const [showDonacionGeneral, setShowDonacionGeneral] = useState(false);
  const [showSalidaGeneral, setShowSalidaGeneral] = useState(false);
  const { signOut, isSuperAdmin, isCoordinador, isCoordinadorBrigadas, esCoordinacion, puedeGestionarPersonal, puedeVerEvaluaciones, participaVoluntariado, isBrigadista, isVoluntario, profile } = useAuth();
  const { t } = useI18n();
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

  // Una sola definición de módulos para la barra lateral (escritorio) y el menú del teléfono
  // (MobileNav). `pin` decide qué módulos tienen atajo en el dock del teléfono (menor = antes).
  // `rgb` del área pinta su punto en el panel del teléfono; `rgb` de cada módulo es el color de su
  // icono, como el de una app.
  const secciones = [
    {
      clave: 'general',
      titulo: t('nav.general'),
      rgb: '13, 148, 136',
      items: [
        { to: '/', icon: LayoutDashboard, rgb: '13, 148, 136', label: t('nav.inicio'), end: true, pin: 0 },
        participaVoluntariado && { to: '/actividades', icon: ClipboardList, rgb: '2, 132, 199', label: t('nav.actividades'), pin: 1 },
        participaVoluntariado && { to: '/tareas', icon: ListChecks, rgb: '217, 119, 6', label: t('nav.tareas'), pin: 3 },
        (participaVoluntariado || isSuperAdmin) && { to: '/curso', icon: GraduationCap, rgb: '219, 39, 119', label: t('nav.curso') }
      ]
    },
    // Inventario y Catálogo para Admins y Brigadistas. Evaluaciones, solo para brigadistas,
    // Coordinador de Brigadas y admin principal: ser Admin no basta.
    {
      clave: 'medicina',
      titulo: isBrigadista ? 'Medicina' : 'Donaciones Médicas',
      rgb: '225, 29, 72',
      items: [
        (isSuperAdmin || isBrigadista) && { to: '/inventory', icon: Package, rgb: '225, 29, 72', label: 'Inventario', rutas: ['/lotes'], pin: 2 },
        (isSuperAdmin || isBrigadista) && { to: '/catalog', icon: Database, rgb: '234, 88, 12', label: 'Catálogo' },
        puedeVerEvaluaciones && { to: '/evaluaciones', icon: Activity, rgb: '5, 150, 105', label: 'Evaluaciones', pin: 3 }
      ]
    },
    // CRM: Super Admin y Voluntarios.
    {
      clave: 'comunidad',
      titulo: t('nav.comunidad'),
      rgb: '124, 58, 237',
      items: [
        (isSuperAdmin || isVoluntario) && { to: '/beneficiarios', icon: Users, rgb: '124, 58, 237', label: t('nav.beneficiarios'), pin: 3 },
        (isSuperAdmin || isVoluntario) && { to: '/donantes', icon: HandHeart, rgb: '192, 38, 211', label: t('nav.donantes') }
      ]
    },
    // Coordinación: solo con un rol de coordinación asignado (o el admin principal).
    // Ser Admin no basta.
    {
      clave: 'coordinacion',
      titulo: 'Coordinación',
      rgb: '217, 119, 6',
      items: [
        esCoordinacion && { to: '/bitacoras', icon: ClipboardCheck, rgb: '8, 145, 178', label: 'Bitácoras', pin: 2 },
        esCoordinacion && { to: '/equipos', icon: Network, rgb: '79, 70, 229', label: 'Equipos' },
        esCoordinacion && { to: '/asignar-tareas', icon: ListPlus, rgb: '101, 163, 13', label: 'Asignar tareas' }
      ]
    },
    // Administración: solo el admin principal o un Admin con el rol "Gestión de Personal"
    // que él asigne. Ser Admin no basta.
    {
      clave: 'administracion',
      titulo: 'Administración',
      rgb: '79, 70, 229',
      items: [
        puedeGestionarPersonal && { to: '/usuarios', icon: UserCog, rgb: '71, 85, 105', label: 'Gestión de Personal', corto: 'Personal' }
      ]
    }
  ]
    .map((s) => ({ ...s, items: s.items.filter(Boolean) }))
    .filter((s) => s.items.length > 0);

  const etiquetaRol = `${t(`roles.${profile?.rol}`) === `roles.${profile?.rol}` ? t('roles.usuario') : t(`roles.${profile?.rol}`)}${isCoordinador ? ` · ${t('roles.coordinador')}` : ''}${isCoordinadorBrigadas ? ` · ${t('roles.coordinador_brigadas')}` : ''}`;

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
                  {t('nav.modo_local')}
                </div>
              )}
            </div>
          </div>
          <div className="header-actions">

            {/* Botones Médicos: Visibles para Super Admin y Brigadistas */}
            {(isSuperAdmin || isBrigadista) && (
              <div style={{ display: 'flex', gap: '0.3rem' }}>
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
                  aria-label={t('nav.entregar_items')}
                  title={t('nav.entregar_items')}
                >
                  <Gift size={15} />
                </Button>
                <Button
                  onClick={() => setShowDonacionGeneral(true)}
                  style={{ width: '32px', minWidth: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', color: '#fff', boxShadow: '0 4px 10px rgba(124,58,237,0.3)', cursor: 'pointer' }}
                  aria-label={t('nav.registrar_donacion')}
                  title={t('nav.registrar_donacion')}
                >
                  <ShoppingBag size={15} />
                </Button>
              </div>
            )}
            {/* Separador final eliminado para mayor limpieza visual */}
            {/* Profile Link (The "Old" Button) */}
            <button
              onClick={() => navigate('/perfil')}
              className="icon-btn mobile-only"
              title={t('nav.mi_perfil')}
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

      {/* Escritorio: lista lateral con todos los módulos. En el teléfono la reemplaza MobileNav. */}
      <nav className="sidebar-nav" style={{ flex: 1, overflowY: 'auto' }}>
        {secciones.map((s, i) => (
          <React.Fragment key={s.clave}>
            <div
              className="nav-group-title"
              style={i === 0
                ? { ...estiloTituloGrupo, padding: '0.25rem 0.5rem 0.25rem', marginTop: '0.25rem' }
                : { ...estiloTituloGrupo, padding: '0.75rem 0.5rem 0.25rem' }}
            >
              {s.titulo}
            </div>
            {s.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Icon size={20} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      <MobileNav secciones={secciones} etiquetaRol={etiquetaRol} onLogout={handleLogout} />

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
              backgroundColor: profile?.avatar ? 'transparent' : getRolColor(profile?.rol),
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '0.85rem',
              flexShrink: 0,
              overflow: 'hidden',
              border: profile?.avatar ? '1px solid var(--border-color)' : 'none'
            }}>
              {profile?.avatar ? (
                <img
                  src={profile.avatar}
                  alt="Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                (profile?.nombre || 'U').substring(0, 2).toUpperCase()
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.8rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.nombre || t('comun.cargando')}
              </p>
              <p style={{ fontSize: '0.65rem', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>
                {etiquetaRol}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/perfil')}
            className="icon-btn"
            style={{ color: 'var(--primary-color)' }}
            title={t('nav.ver_perfil')}
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
