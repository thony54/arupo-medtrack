-- ============================================================
-- Arupo MedTrack — Schema v4: Roles y Gestión de Usuarios
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================

-- 1. TABLA DE PERFILES DE USUARIO
CREATE TABLE IF NOT EXISTS public.perfiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT,
  email       TEXT,
  rol         TEXT        NOT NULL DEFAULT 'brigadista' 
                          CHECK (rol IN ('super_admin', 'brigadista', 'voluntario')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Política para que cualquier usuario autenticado lea su propio perfil y otros perfiles
DROP POLICY IF EXISTS "Lectura de perfiles autenticados" ON public.perfiles;
CREATE POLICY "Lectura de perfiles autenticados" 
  ON public.perfiles FOR SELECT 
  TO authenticated 
  USING (true);

-- Política para que los super admins editen perfiles
DROP POLICY IF EXISTS "Super admins editan perfiles" ON public.perfiles;
CREATE POLICY "Super admins editan perfiles" 
  ON public.perfiles FOR ALL 
  TO authenticated 
  USING (
    (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'super_admin'
  );

-- 2. TRIGGER PARA CREAR PERFIL AUTOMÁTICAMENTE EN SIGN UP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Por defecto el rol es brigadista, pero si es el primero o segun la logica puede ser super_admin
  -- Para facilitar, insertamos con el rol de metadatos si existe, sino brigadista
  INSERT INTO public.perfiles (id, nombre, email, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'rol', 'brigadista')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vincular trigger a auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. FUNCIÓN PARA QUE EL SUPER ADMIN CREE OTROS USUARIOS SIN CAMBIAR DE SESIÓN
-- Esta función usa SECURITY DEFINER para eludir restricciones y se ejecuta como admin.
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
    RAISE EXCEPTION 'No tienes permisos para crear usuarios.';
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

  -- El trigger handle_new_user se ejecutará automáticamente aquí, 
  -- pero nos aseguramos de que el rol quede bien definido:
  UPDATE public.perfiles 
  SET rol = p_rol, nombre = p_nombre 
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ASIGNAR ROL SUPER ADMIN AL USUARIO ACTUAL (Opcional/Referencia)
-- Si ya tienes un usuario y quieres hacerlo super admin, ejecuta:
-- UPDATE public.perfiles SET rol = 'super_admin' WHERE email = 'tu_correo@email.com';
--
-- Si la tabla de perfiles no existía y ya tenías usuarios en auth.users, ejecuta esto para migrarlos:
-- INSERT INTO public.perfiles (id, email, nombre, rol)
-- SELECT id, email, COALESCE(raw_user_meta_data->>'nombre', email), 'super_admin'
-- FROM auth.users
-- ON CONFLICT (id) DO NOTHING;
