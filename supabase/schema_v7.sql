-- ============================================================
-- Arupo MedTrack — Schema v7: Corrección de Login de Usuarios
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================

-- 1. Actualizar la función para incluir auth.identities
-- Supabase requiere que cada usuario tenga una "identidad" registrada para poder iniciar sesión.
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

  -- Generar el UUID para el nuevo usuario
  v_user_id := gen_random_uuid();

  -- Insertar en auth.users
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

  -- IMPORTANTE: Insertar en auth.identities para permitir el inicio de sesión
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

  -- Forzar la actualización del perfil por si el trigger falla
  INSERT INTO public.perfiles (id, nombre, email, rol)
  VALUES (v_user_id, p_nombre, p_email, p_rol)
  ON CONFLICT (id) DO UPDATE 
  SET rol = EXCLUDED.rol, nombre = EXCLUDED.nombre;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Reparar los usuarios que ya se crearon pero no pueden iniciar sesión
-- Esto buscará cualquier usuario que no tenga identidad (los que creaste y dieron error)
-- y les creará su acceso para que puedan loguearse correctamente.
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
