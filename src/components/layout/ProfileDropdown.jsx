import { Settings, LogOut, User, Shield, ChevronRight, Edit2, Check, X, Mail, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import './layout.css';

export const ProfileDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const { profile, role, user, signOut, refreshProfile } = useAuth();
  const [tempNombre, setTempNombre] = useState(profile?.nombre || '');
  const [showEmail, setShowEmail] = useState(false);
  const [updating, setUpdating] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (profile?.nombre) setTempNombre(profile.nombre);
  }, [profile]);

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

  const handleUpdateName = async () => {
    if (!tempNombre.trim()) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('perfiles')
        .update({ nombre: tempNombre.trim() })
        .eq('id', user.id);
      if (error) throw error;
      refreshProfile();
      setIsEditingName(false);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
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
              {isEditingName ? (
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <input 
                    className="popover-input"
                    value={tempNombre}
                    onChange={e => setTempNombre(e.target.value)}
                    autoFocus
                    disabled={updating}
                  />
                  <button onClick={handleUpdateName} className="icon-btn-tiny success"><Check size={14} /></button>
                  <button onClick={() => setIsEditingName(false)} className="icon-btn-tiny"><X size={14} /></button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <p className="user-name">{profile?.nombre || 'Cargando...'}</p>
                  <button onClick={() => setIsEditingName(true)} className="edit-mini-btn"><Edit2 size={12} /></button>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
                <p className="user-email-mini">{showEmail ? user?.email : '••••••••@••••.•••'}</p>
                <button onClick={() => setShowEmail(!showEmail)} className="edit-mini-btn">
                  {showEmail ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              <p className="user-role-mini">{role.replace('_', ' ')}</p>
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
