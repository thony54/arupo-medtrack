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
        let msg = loginErr.message;
        if (msg === 'Invalid login credentials') msg = 'Correo o contraseña incorrectos.';
        if (msg === 'Email not confirmed') msg = 'Debes confirmar tu correo electrónico para ingresar.';
        setError(msg);
        setLoading(false);
        return;
      }

      if (data?.user) {
        // 1. Consultar perfil con reintentos o fallback
        const { data: profileData, error: profileErr } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileErr) {
          console.error('Error leyendo perfil:', profileErr);
          // Si hay error de red pero hay usuario, intentamos entrar igual como fallback
        }

        const userRole = profileData?.rol || 'brigadista'; 

        // 2. REGLA DE ORO: Super Admin entra a TODO
        if (userRole === 'super_admin') {
          navigate('/', { replace: true });
          return;
        }

        // 3. Validación de Portal vs Rol
        const isCorrectPortal = (portal === 'brigadista' && userRole === 'brigadista') || 
                               (portal === 'voluntario' && userRole === 'voluntario');

        if (isCorrectPortal) {
          navigate('/', { replace: true });
        } else {
          const portalLabel = portal === 'brigadista' ? 'Brigadistas' : 'Voluntarios';
          setError(`Acceso denegado. Tu cuenta tiene rol de "${userRole}" y no pertenece al portal de ${portalLabel}.`);
          await signOut();
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('Login Failure:', err);
      setError('Error de conexión con el servidor. Inténtalo de nuevo.');
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
      backgroundColor: '#050505', // Deep premium dark background
      backgroundImage: 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.15), transparent 40%), radial-gradient(circle at bottom left, rgba(124, 58, 237, 0.12), transparent 40%), radial-gradient(circle at center, rgba(255,255,255,0.02) 0%, transparent 100%)',
      padding: '1.5rem',
      fontFamily: 'system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative ambient elements for ultra-premium look */}
      <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '400px', height: '400px', background: 'var(--primary-color)', opacity: 0.15, filter: 'blur(100px)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: '400px', height: '400px', background: '#7c3aed', opacity: 0.12, filter: 'blur(100px)', borderRadius: '50%', pointerEvents: 'none' }} />
      
      <div className="card glass animate-blur-in" style={{ 
        width: '100%', 
        maxWidth: '460px', 
        padding: '2.5rem 2rem', 
        background: 'rgba(15, 20, 30, 0.65)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.08)', 
        border: 'none',
        borderRadius: '24px',
        position: 'relative',
        zIndex: 1
      }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div style={{ width: '76px', height: '76px', marginBottom: '1.25rem', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: 'inset 0 2px 10px rgba(255,255,255,0.02)' }} className="animate-reveal">
            <img 
              src="/arupo-logo.png" 
              alt="Logo ARUPO" 
              style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }} 
            />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.02em', margin: 0, textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            Arupo Med-Track
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '0.35rem', fontSize: '0.95rem', fontWeight: '500' }}>
            Gestión y Control de Donaciones
          </p>
        </div>

        {/* Selector Visual de Portal de Acceso */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', marginBottom: '1rem', textAlign: 'center' }}>
            Selecciona tu Portal
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
                    gap: '0.5rem',
                    padding: '0.875rem 0.25rem',
                    background: isSelected ? opt.bg : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isSelected ? opt.color : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isSelected ? '0 8px 24px -8px rgba(0, 0, 0, 0.4)' : 'none',
                    opacity: isSelected ? 1 : 0.6,
                    transform: isSelected ? 'translateY(-2px)' : 'none'
                  }}
                  className="portal-btn"
                >
                  <Icon size={24} color={isSelected ? opt.color : 'rgba(255,255,255,0.6)'} strokeWidth={isSelected ? 2.5 : 2} />
                  <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: isSelected ? '700' : '600', 
                    color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.6)',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.02em'
                  }}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="animate-fade-in" style={{ padding: '0.875rem 1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '1.75rem', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start', backdropFilter: 'blur(8px)' }} role="alert">
            <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>⚠️</span>
            <span style={{ fontWeight: '500', lineHeight: 1.4 }}>{error}</span>
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
              marginTop: '1rem', 
              padding: '0.875rem', 
              fontWeight: '700',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              background: portal === 'voluntario' ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : portal === 'brigadista' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--primary-gradient)',
              boxShadow: '0 8px 20px -8px rgba(0, 0, 0, 0.5)',
              border: 'none',
              borderRadius: '12px',
              transition: 'all 0.3s ease'
            }}
          >
            <Key size={18} />
            {loading ? 'Verificando...' : `Entrar como ${portalOptions.find(o => o.id === portal).label}`}
          </Button>
        </form>

        <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', margin: 0, fontWeight: '500', letterSpacing: '0.02em' }}>
            Acceso seguro • Cifrado de extremo a extremo
          </p>
        </div>
      </div>
    </div>
  );
};
