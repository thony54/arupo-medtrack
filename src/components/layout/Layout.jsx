import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import './layout.css';

export const Layout = () => {
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const mainRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Routes for swipe navigation
  const routes = ['/', '/inventory', '/catalog', '/beneficiarios', '/donantes'];

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

  // Swipe logic refined
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);

  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    touchStartTime.current = Date.now();
  };

  const handleTouchEnd = (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndTime = Date.now();
    
    const dx = touchStartX.current - touchEndX;
    const dy = touchStartY.current - touchEndY;
    const dt = touchEndTime - touchStartTime.current;

    const thresholdX = 120; // Aumentamos umbral horizontal
    const thresholdY = 60;  // Umbral máximo vertical para evitar detectar scroll como swipe
    const minTime = 100;    // Evitar taps accidentales

    // Solo navegar si:
    // 1. Ha pasado suficiente tiempo (no es un tap)
    // 2. El movimiento horizontal es significativamente mayor que el vertical
    // 3. El movimiento horizontal supera el umbral
    if (dt > minTime && Math.abs(dx) > thresholdX && Math.abs(dy) < thresholdY) {
      const currentIndex = routes.indexOf(location.pathname);
      if (currentIndex === -1) return;

      if (dx > 0 && currentIndex < routes.length - 1) {
        navigate(routes[currentIndex + 1]);
      } else if (dx < 0 && currentIndex > 0) {
        navigate(routes[currentIndex - 1]);
      }
    }
  };

  return (
    <div className={`layout-container animate-fade-in ${showHeader ? 'header-visible' : 'header-hidden'}`}>
      <Sidebar />
      <main 
        ref={mainRef}
        className="main-content"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Outlet />
      </main>
    </div>
  );
};
