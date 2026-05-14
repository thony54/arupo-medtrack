import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, User, Shield, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './layout.css';

export const ProfileDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
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
    <div className="profile-dropdown-container" ref={dropdownRef}>
      <button 
        className={`profile-trigger-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Opciones de cuenta"
      >
        <Settings size={22} className={isOpen ? 'spin-once' : ''} />
      </button>

      {isOpen && (
        <div className="profile-popover glass animate-scale-in">
          <div className="popover-header">
            <div className="user-avatar" style={{ backgroundColor: getRoleColor(profile?.rol) }}>
              {(profile?.nombre || 'U').substring(0, 2).toUpperCase()}
            </div>
            <div className="user-info">
              <p className="user-name">{profile?.nombre || 'Cargando...'}</p>
              <p className="user-role">{role.replace('_', ' ')}</p>
            </div>
          </div>

          <div className="popover-divider" />

          <div className="popover-actions">
            <button className="popover-item" onClick={() => { navigate('/perfil'); setIsOpen(false); }}>
              <div className="item-icon"><User size={18} /></div>
              <span>Mi Perfil</span>
              <ChevronRight size={14} className="chevron" />
            </button>
            
            <button className="popover-item" onClick={handleLogout}>
              <div className="item-icon danger"><LogOut size={18} /></div>
              <span className="danger">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
