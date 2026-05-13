import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Stethoscope, HandHeart, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const Login = () => {
  const [portal, setPortal] = useState('brigadista'); // Por defecto a brigadista, Super Admin oculto visualmente
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: loginErr } = await signIn(email, password);
      
      if (loginErr) {
        setError(loginErr.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : loginErr.message);
        setLoading(false);
        return;
      }

      if (data?.user && supabase) {
        // Consultar perfil en tiempo real para validar contra el portal seleccionado
        const { data: profileData, error: profileErr } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', data.user.id)
          .single();

        if (profileErr) {
          console.warn('No se pudo leer rol en login. Asumiendo fallback inicial:', profileErr.message);
          navigate('/', { replace: true });
          return;
        }

        const userRole = profileData?.rol || 'super_admin';

        // REGGLA DE NEGOCIO:
        // 1. Los Super Admins ingresan SIEMPRE desde cualquier portal.
        if (userRole === 'super_admin') {
          navigate('/', { replace: true });
          return;
        }

        // 2. Si eligió portal de Brigadista, su rol debe ser brigadista.
        if (portal === 'brigadista' && userRole === 'brigadista') {
          navigate('/', { replace: true });
          return;
        }

        // 3. Si eligió portal de Voluntario, su rol debe ser voluntario.
        if (portal === 'voluntario' && userRole === 'voluntario') {
          navigate('/', { replace: true });
          return;
        }

        // 4. En cualquier otro caso, denegar acceso y desloguear sesión del navegador
        const portalLabel = portal === 'brigadista' ? 'Brigadistas' : 'Voluntarios';
        setError(`Acceso restringido. Esta cuenta no pertenece al portal de ${portalLabel}.`);
        await signOut();
        setLoading(false);
      } else {
        // Fallback si no hay SDK conectado
        navigate('/', { replace: true });
      }
    } catch (err) {
      console.error('Error catastrófico en login:', err);
      setError('Ha ocurrido un error inesperado de conexión.');
      setLoading(false);
    }
  };

  const portalOptions = [
    { id: 'brigadista', label: 'Brigadista', icon: Stethoscope, color: 'var(--success-color)', bg: 'rgba(16, 185, 129, 0.08)' },
    { id: 'voluntario', label: 'Voluntario', icon: HandHeart, color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.08)' }
  ];

  return (
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: 'var(--bg-base)',
      backgroundImage: 'radial-gradient(circle at top right, var(--primary-light), transparent 40%), radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.05), transparent 40%)',
      padding: '1.5rem',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div className="card glass animate-blur-in" style={{ width: '100%', maxWidth: '460px', padding: '2.5rem 2rem', boxShadow: 'var(--shadow-glass)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '72px', height: '72px', marginBottom: '1rem' }} className="animate-reveal">
            <img 
              src="/arupo-logo.png" 
              alt="Logo ARUPO" 
              style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))' }} 
            />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            Arupo Med-Track
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '0.9rem' }}>
            Gestión y Control de Donaciones
          </p>
        </div>

        {/* Selector Visual de Portal de Acceso */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: '0.75rem', textAlign: 'center' }}>
            Selecciona tu Portal de Entrada
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>

            {portalOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = portal === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { setPortal(opt.id); setError(''); }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.75rem 0.25rem',
                    background: isSelected ? opt.bg : 'var(--bg-surface)',
                    border: `2px solid ${isSelected ? opt.color : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isSelected ? `0 4px 12px ${opt.bg}` : 'none',
                    opacity: isSelected ? 1 : 0.7
                  }}
                  className="portal-btn"
                >
                  <Icon size={20} color={isSelected ? opt.color : 'var(--text-secondary)'} strokeWidth={isSelected ? 2.5 : 2} />
                  <span style={{ 
                    fontSize: '0.7rem', 
                    fontWeight: '700', 
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap'
                  }}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="animate-fade-in" style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', marginBottom: '1.5rem', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }} role="alert">
            <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>⚠️</span>
            <span style={{ fontWeight: '500' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Input
            id="email"
            label="Correo Electrónico"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@fundacion.org"
            disabled={loading}
          />
          
          <Input
            id="password"
            label="Contraseña"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
          />
          
          <Button 
            type="submit" 
            variant="primary" 
            disabled={loading} 
            style={{ 
              width: '100%', 
              marginTop: '0.75rem', 
              padding: '0.875rem', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: portal === 'voluntario' ? 'linear-gradient(135deg, #7c3aed, #9333ea)' : portal === 'brigadista' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--primary-gradient)'
            }}
          >
            <Key size={16} />
            {loading ? 'Verificando...' : `Entrar como ${portalOptions.find(o => o.id === portal).label}`}
          </Button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: 0 }}>
            Acceso seguro • Cifrado de extremo a extremo
          </p>
        </div>
      </div>
    </div>
  );
};

