import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.warn('Error al obtener el perfil del usuario. Es posible que falte ejecutar el script SQL schema_v4.sql:', error.message);
        // Si hay error o no existe la tabla, damos perfil por defecto de super_admin 
        // para mantener retrocompatibilidad hasta que corran el script SQL
        setProfile({ rol: 'super_admin', nombre: 'Admin Provisional' });
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Error inesperado al obtener perfil:', err);
      setProfile({ rol: 'super_admin' });
    }
  };

  useEffect(() => {
    // Check active session
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        setSession(session);
        if (session?.user) {
          await fetchProfile(session.user.id);
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

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user: session?.user,
    profile,
    role: profile?.rol || 'super_admin', // Fallback preventivo
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

