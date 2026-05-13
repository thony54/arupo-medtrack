-- ============================================================
-- Arupo MedTrack — Schema v6: Realtime & Permisos Super Admin
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================

-- 1. Habilitar Supabase Realtime para todas las tablas clave
-- Esto permite que los cambios de cualquier Super Admin, Brigadista o Voluntario
-- se reflejen instantáneamente en las pantallas de los demás.
BEGIN;
  -- Borrar la publicación si ya existe (para evitar errores si ya estaba activada parcialmente)
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE public.perfiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.beneficiarios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.donantes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.medicinas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lotes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.movimientos;

-- 2. Asegurar que los usuarios existentes en auth.users (creados desde el panel)
-- tengan su perfil correspondiente en public.perfiles como 'super_admin'.
-- Esto soluciona el error "No tienes permisos para crear usuarios".
INSERT INTO public.perfiles (id, email, nombre, rol)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'nombre', email), 
  'super_admin'
FROM auth.users
ON CONFLICT (id) DO UPDATE 
SET rol = 'super_admin'
WHERE public.perfiles.rol IS NULL OR public.perfiles.rol != 'super_admin';

-- 3. Asegurar que las políticas de seguridad (RLS) en perfiles permitan a los super_admin 
-- realizar cualquier acción (por si alguna estaba bloqueada).
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

-- 4. Asegurarnos que las políticas de RLS en las otras tablas (si las hay) 
-- no restrinjan el acceso a los usuarios autenticados.
-- Actualmente, al no haber RLS activado en medicinas, beneficiarios, etc,
-- el acceso es público para todos los usuarios logueados. Pero por si acaso:
ALTER TABLE public.beneficiarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.donantes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicinas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos DISABLE ROW LEVEL SECURITY;

-- 5. Actualizamos la función crear_usuario_completo para evitar errores de contexto
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
  -- 1. Validar que quien ejecuta sea super_admin
  SELECT rol INTO v_caller_role FROM public.perfiles WHERE id = auth.uid();
  
  -- Si no hay perfiles aún, permitimos crear el primero como bypass de seguridad.
  -- De lo contrario, verificamos que sea super_admin.
  IF EXISTS (SELECT 1 FROM public.perfiles) AND (v_caller_role IS DISTINCT FROM 'super_admin') THEN
    RAISE EXCEPTION 'No tienes permisos para crear usuarios. Tu rol actual es: %', v_caller_role;
  END IF;

  -- 2. Crear en auth.users
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
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('nombre', p_nombre, 'rol', p_rol),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_user_id;

  -- Actualizar el perfil recién creado por el trigger para asegurar nombre y rol
  UPDATE public.perfiles 
  SET rol = p_rol, nombre = p_nombre 
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
