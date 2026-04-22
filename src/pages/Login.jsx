import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);
    
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/', { replace: true });
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: 'var(--bg-base)',
      backgroundImage: 'radial-gradient(circle at top right, var(--primary-light), transparent 40%)',
      padding: '1rem'
    }}>
      <div className="card glass animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem 2rem', boxShadow: 'var(--shadow-glass)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div style={{ width: '64px', height: '64px', background: 'var(--primary-gradient)', color: 'white', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', boxShadow: '0 8px 16px rgba(16,185,129,0.3)' }} className="animate-slide-up">
            <Activity size={32} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-primary)' }} className="animate-slide-up stagger-1">Arupo MedTrack</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }} className="animate-slide-up stagger-2">Ingresa tus credenciales para continuar</p>
        </div>

        {error && (
          <div className="animate-slide-up stagger-2" style={{ padding: '0.75rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center', border: '1px solid rgba(239,68,68,0.2)' }} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="animate-slide-up stagger-3">
          <Input
            id="email"
            label="Correo Electrónico"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
          />
          <Input
            id="password"
            label="Contraseña"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          
          <Button type="submit" variant="primary" disabled={loading} style={{ width: '100%', marginTop: '1rem', padding: '0.875rem' }}>
            {loading ? 'Verificando...' : 'Iniciar Sesión'}
          </Button>
        </form>
      </div>
    </div>
  );
};
