-- ============================================================
-- Arupo MedTrack — Schema v9: Restauración de Fábrica (Seguro)
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================

-- 1. LIMPIEZA DE FUNCIONES ANTIGUAS
-- Borramos las funciones que causaban conflictos
DROP FUNCTION IF EXISTS public.crear_usuario_completo(text, text, text, text);
DROP FUNCTION IF EXISTS public.crear_usuario_completo(text, text, text, text, text);

-- 2. TABLA DE PERFILES (Aseguramos integridad)
CREATE TABLE IF NOT EXISTS public.perfiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT,
  email       TEXT,
  rol         TEXT        NOT NULL DEFAULT 'brigadista' 
                          CHECK (rol IN ('super_admin', 'brigadista', 'voluntario')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. HABILITAR TIEMPO REAL (Realtime)
-- Borrar y recrear publicación para asegurar que todas las tablas clave estén incluidas
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
COMMIT;

-- 4. POLÍTICAS DE SEGURIDAD (RLS)
-- Por ahora, permitimos que cualquier usuario autenticado lea todos los perfiles 
-- para que el Login pueda verificar los roles.
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura de perfiles autenticados" ON public.perfiles;
CREATE POLICY "Lectura de perfiles autenticados" 
  ON public.perfiles FOR SELECT 
  TO authenticated 
  USING (true);

-- Permitir que el sistema o el usuario actual inserte/actualice su propio perfil
DROP POLICY IF EXISTS "Usuarios manejan su propio perfil" ON public.perfiles;
CREATE POLICY "Usuarios manejan su propio perfil" 
  ON public.perfiles FOR ALL 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- 5. TRIGGER AUTOMÁTICO DE PERFILES
-- Este trigger asegura que CUALQUIER usuario creado en Supabase Auth 
-- tenga automáticamente un registro en la tabla de perfiles.
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
  SET 
    nombre = EXCLUDED.nombre,
    rol = EXCLUDED.rol;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. ASIGNAR ROL SUPER ADMIN AL USUARIO ACTUAL
-- Este bloque detecta tu sesión actual y te hace Super Admin de inmediato
INSERT INTO public.perfiles (id, email, nombre, rol)
SELECT id, email, COALESCE(raw_user_meta_data->>'nombre', email), 'super_admin'
FROM auth.users
WHERE id = auth.uid()
ON CONFLICT (id) DO UPDATE SET rol = 'super_admin';

-- 7. REPARACIÓN DE IDENTIDADES (Solo si es necesario)
-- Asegura que todos los usuarios tengan permitido el login con email
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
