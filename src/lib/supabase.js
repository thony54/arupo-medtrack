import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Qué variable falta exactamente. Antes solo se validaba la URL: con una URL
// correcta y la clave vacía se creaba el cliente igualmente y cada consulta
// fallaba con un error de autenticación difícil de interpretar.
const faltantes = [];
if (!supabaseUrl) faltantes.push('VITE_SUPABASE_URL');
else if (!isValidUrl(supabaseUrl)) faltantes.push('VITE_SUPABASE_URL (no es una URL válida)');
if (!supabaseAnonKey) faltantes.push('VITE_SUPABASE_ANON_KEY');

export const variablesFaltantes = faltantes;

if (faltantes.length > 0) {
  console.error(
    'Supabase no se pudo inicializar. Faltan variables de entorno en el build: ' +
    faltantes.join(', ') +
    '. Recuerda que las VITE_* se incrustan al compilar: si las añades en Vercel, ' +
    'hay que volver a desplegar para que surtan efecto.'
  );
}

export const supabase = faltantes.length === 0
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
