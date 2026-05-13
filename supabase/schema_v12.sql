-- ============================================================
-- Arupo MedTrack — Schema v12: RESET TOTAL Y REPARACIÓN FINAL
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================

-- 1. LIMPIEZA TOTAL DE DISPARADORES (TRIGGERS)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.crear_usuario_completo(text, text, text, text);
DROP FUNCTION IF EXISTS public.crear_usuario_completo(text, text, text, text, text);

-- 2. RESET DE LA TABLA DE PERFILES
-- Re-creamos la tabla desde cero para asegurar que no haya restricciones corruptas
DROP TABLE IF EXISTS public.perfiles CASCADE;
CREATE TABLE public.perfiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT,
  email       TEXT,
  rol         TEXT        NOT NULL DEFAULT 'brigadista',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DESACTIVAR SEGURIDAD (RLS) TEMPORALMENTE EN PERFILES
-- Esto garantiza que no haya errores de "No tienes permisos" mientras pruebas.
ALTER TABLE public.perfiles DISABLE ROW LEVEL SECURITY;

-- 4. NUEVO DISPARADOR (TRIGGER) SIMPLIFICADO
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, email, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'rol', 'brigadista')
  )
  ON CONFLICT (id) DO UPDATE 
  SET nombre = EXCLUDED.nombre, rol = EXCLUDED.rol;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. RECONSTRUCCIÓN DE IDENTIDADES (FIX DE LOGIN)
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
SELECT 
  gen_random_uuid(), 
  id, 
  id::text, 
  jsonb_build_object('sub', id, 'email', email), 
  'email', 
  NOW(), 
  NOW()
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities WHERE auth.identities.user_id = auth.users.id
);

-- 6. ASIGNAR ROL SUPER ADMIN A TI
-- INSERTAR PERFILES PARA USUARIOS EXISTENTES
INSERT INTO public.perfiles (id, email, nombre, rol)
SELECT id, email, COALESCE(raw_user_meta_data->>'nombre', email), 'super_admin'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
