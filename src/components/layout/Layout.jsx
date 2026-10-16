import React, { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { AceptarTerminos } from '../legal/AceptarTerminos';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n/useI18n';
import './layout.css';

export const Layout = () => {
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const mainRef = useRef(null);
  const { terminos, profileStatus } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    const handleScroll = () => {
      if (!mainRef.current) return;
      const currentScrollY = mainRef.current.scrollTop;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }
      setLastScrollY(currentScrollY);
    };

    const mainElement = mainRef.current;
    if (mainElement) {
      mainElement.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (mainElement) mainElement.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY]);

  // Compuerta de términos: sin aceptar la versión vigente no se ve nada de la app.
  if (profileStatus === 'ready' && terminos === 'pendientes') return <AceptarTerminos />;
  if (profileStatus === 'ready' && terminos === 'verificando') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        {t('comun.cargando')}
      </div>
    );
  }

  return (
    <div className={`layout-container animate-opacity-in ${showHeader ? 'header-visible' : 'header-hidden'}`}>
      {/* Decorative Ambient Background Elements */}
      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>
      <div className="ambient-glow glow-3"></div>
      
      <Sidebar />
      <main 
        ref={mainRef}
        className="main-content"
      >
        <Outlet />
      </main>
      
      <PWAInstallPrompt />
    </div>
  );
};

