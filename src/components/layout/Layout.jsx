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

  // Swipe logic
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const swipeDistance = touchStartX.current - touchEndX.current;
    const threshold = 100; // px

    if (Math.abs(swipeDistance) > threshold) {
      const currentIndex = routes.indexOf(location.pathname);
      if (currentIndex === -1) return;

      if (swipeDistance > 0 && currentIndex < routes.length - 1) {
        // Swipe left -> Next page
        navigate(routes[currentIndex + 1]);
      } else if (swipeDistance < 0 && currentIndex > 0) {
        // Swipe right -> Previous page
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
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Outlet />
      </main>
    </div>
  );
};
