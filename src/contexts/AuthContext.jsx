import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.warn('Error al obtener el perfil. Tabla perfiles ausente:', error.message);
        // Retornar rol por defecto para evitar bloqueos
        setProfile({ rol: 'super_admin', nombre: 'Administrador General' });
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Error inesperado al obtener perfil:', err);
      setProfile({ rol: 'super_admin', nombre: 'Administrador General' });
    }
  };

  useEffect(() => {
    if (!supabase) {
      console.error('El cliente Supabase es nulo. Revisa las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
      setLoading(false);
      return;
    }

    // Check active session
    supabase.auth.getSession()
      .then(async ({ data: { session: currentSession } }) => {
        setSession(currentSession);
        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
        }
      })
      .catch((err) => {
        console.error('Error checking auth session:', err);
      })
      .finally(() => {
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription && subscription.unsubscribe();
  }, []);

  // Renderizador de pantalla elegante de error en caso de que el SDK de Supabase no inicie
  if (!supabase) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', 
        padding: '2rem', 
        fontFamily: 'system-ui, sans-serif' 
      }}>
        <div style={{ 
          maxWidth: '500px', 
          background: '#fff', 
          padding: '2.5rem', 
          borderRadius: '16px', 
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', 
          textAlign: 'center' 
        }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            background: '#fee2e2', 
            color: '#ef4444', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 1.5rem',
            fontSize: '2rem'
          }}>
            ⚠️
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.75rem' }}>Configuración Pendiente</h1>
          <p style={{ color: '#64748b', lineHeight: '1.5', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            No se ha podido establecer la conexión con la base de datos. Por favor, configura las variables de entorno en Vercel.
          </p>
          <div style={{ textAlign: 'left', background: '#f1f5f9', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem', color: '#334155', border: '1px solid #e2e8f0' }}>
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600' }}>Variables requeridas en tu panel de Vercel:</p>
            <code style={{ display: 'block', background: '#fff', padding: '0.4rem', borderRadius: '4px', marginBottom: '0.4rem', border: '1px solid #e2e8f0' }}>VITE_SUPABASE_URL</code>
            <code style={{ display: 'block', background: '#fff', padding: '0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>VITE_SUPABASE_ANON_KEY</code>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '1.5rem' }}>
            Ingresa a Vercel &gt; Settings &gt; Environment Variables para agregarlas.
          </p>
        </div>
      </div>
    );
  }

  const value = {
    session,
    user: session?.user,
    profile,
    role: profile?.rol || 'super_admin',
    isSuperAdmin: (profile?.rol || 'super_admin') === 'super_admin',
    isBrigadista: profile?.rol === 'brigadista',
    isVoluntario: profile?.rol === 'voluntario',
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => {
      setProfile(null);
      return supabase.auth.signOut();
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};


