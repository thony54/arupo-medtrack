-- ============================================================
-- Arupo MedTrack — Schema v8: Reparación Absoluta de Registro
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================

-- 1. Asegurar la extensión para encriptar contraseñas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Asegurarnos que tu usuario actual tenga el rol de 'super_admin' correctamente
-- Esto previene el error "No tienes permisos"
INSERT INTO public.perfiles (id, email, nombre, rol)
SELECT id, email, COALESCE(raw_user_meta_data->>'nombre', email), 'super_admin'
FROM auth.users
WHERE id = auth.uid()
ON CONFLICT (id) DO UPDATE SET rol = 'super_admin';

-- 3. Eliminar la función actual para evitar conflictos de sobrecarga
DROP FUNCTION IF EXISTS public.crear_usuario_completo(text, text, text, text);

-- 4. Recrear la función de forma completamente segura
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
  -- Validar que tengas permiso de forma segura
  SELECT rol INTO v_caller_role FROM public.perfiles WHERE id = auth.uid();
  
  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Permiso denegado. Tu rol detectado es: %', COALESCE(v_caller_role, 'NULO');
  END IF;

  v_user_id := gen_random_uuid();

  -- Insertar en auth.users (el corazón del sistema de autenticación)
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
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nombre', p_nombre, 'rol', p_rol),
    NOW(),
    NOW()
  );

  -- IMPORTANTE: Crear la identidad requerida por Supabase para iniciar sesión
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id, 'email', p_email),
    'email',
    NOW(),
    NOW()
  );

  -- Asegurarnos que el perfil refleje el rol y nombre que escogiste
  INSERT INTO public.perfiles (id, nombre, email, rol)
  VALUES (v_user_id, p_nombre, p_email, p_rol)
  ON CONFLICT (id) DO UPDATE 
  SET rol = EXCLUDED.rol, nombre = EXCLUDED.nombre;

  RETURN v_user_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'El correo electrónico % ya está registrado.', p_email;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error interno en la base de datos: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Auto-reparar CUALQUIER usuario existente que se haya quedado sin acceso (como el que creaste antes)
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
