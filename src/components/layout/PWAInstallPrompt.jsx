import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '../ui/Button';

export const PWAInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Escuchar el evento de instalación de PWA
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Solo mostrar si no está en modo standalone
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      if (!isStandalone) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '2rem',
      right: '2rem',
      zIndex: 1000,
      background: 'rgba(15, 23, 42, 0.9)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '1.25rem',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      maxWidth: '320px',
      animation: 'slide-up 0.5s ease-out'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'var(--primary-color)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <Download size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: 'white' }}>Instalar Arupo MedTrack</h4>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)' }}>Descarga la aplicación de escritorio para un acceso más rápido.</p>
          </div>
        </div>
        <button 
          onClick={() => setShowPrompt(false)}
          style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.4)', cursor: 'pointer', padding: '0.25rem' }}
        >
          <X size={16} />
        </button>
      </div>
      <Button variant="primary" onClick={handleInstall} style={{ width: '100%' }}>
        Instalar Ahora
      </Button>
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
