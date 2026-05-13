-- ============================================================
-- Arupo MedTrack — Schema v6: Realtime & Permisos Super Admin (CORREGIDO)
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================

-- 1. Habilitar Supabase Realtime para todas las tablas clave
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE public.perfiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.beneficiarios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.donantes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.medicinas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lotes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.movimientos;

-- 2. Asegurar que los perfiles existan. 
-- NO convertimos a todos en super_admin. Respetamos el rol en los metadatos.
-- Solo convertimos en super_admin al primer usuario si no hay ningún super_admin.
INSERT INTO public.perfiles (id, email, nombre, rol)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'nombre', email), 
  COALESCE(raw_user_meta_data->>'rol', 'brigadista')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Garantizar que haya al menos un super_admin (el primer usuario registrado)
UPDATE public.perfiles
SET rol = 'super_admin'
WHERE id = (
  SELECT id FROM public.perfiles ORDER BY created_at ASC LIMIT 1
) AND NOT EXISTS (
  SELECT 1 FROM public.perfiles WHERE rol = 'super_admin'
);

-- 3. Habilitar pg_crypto para la generación de contraseñas de usuarios
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 4. Actualizar la función de creación de usuarios para manejar errores
CREATE OR REPLACE FUNCTION public.crear_usuario_completo(
  p_email TEXT,
  p_password TEXT,
  p_nombre TEXT,
  p_rol TEXT
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_caller_role TEXT;
BEGIN
  -- Verificar permisos del usuario que ejecuta
  SELECT rol INTO v_caller_role FROM public.perfiles WHERE id = auth.uid();
  
  IF EXISTS (SELECT 1 FROM public.perfiles WHERE rol = 'super_admin') AND (v_caller_role IS DISTINCT FROM 'super_admin') THEN
    RAISE EXCEPTION 'No tienes permisos para crear usuarios. Acceso denegado.';
  END IF;

  -- Insertar en auth.users (Supabase maneja la encriptación con crypt)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nombre', p_nombre, 'rol', p_rol),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_user_id;

  -- Forzar la actualización del perfil por si el trigger falla
  INSERT INTO public.perfiles (id, nombre, email, rol)
  VALUES (v_user_id, p_nombre, p_email, p_rol)
  ON CONFLICT (id) DO UPDATE 
  SET rol = EXCLUDED.rol, nombre = EXCLUDED.nombre;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Asegurar políticas de seguridad abiertas temporalmente para evitar bloqueos
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura de perfiles autenticados" ON public.perfiles;
CREATE POLICY "Lectura de perfiles autenticados" 
  ON public.perfiles FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Super admins editan perfiles" ON public.perfiles;
CREATE POLICY "Super admins editan perfiles" 
  ON public.perfiles FOR ALL 
  TO authenticated 
  USING (
    (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'super_admin'
  );

ALTER TABLE public.beneficiarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.donantes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicinas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos DISABLE ROW LEVEL SECURITY;
