-- ============================================================
-- Arupo MedTrack — Schema v13: Función para eliminar usuarios
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================

-- Esta función permite que un Super Admin elimine a otro usuario 
-- (tanto de auth.users como de public.perfiles automáticamente)
CREATE OR REPLACE FUNCTION public.eliminar_usuario(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- 1. Verificar el rol de quien ejecuta la función
  SELECT rol INTO v_caller_role FROM public.perfiles WHERE id = auth.uid();
  
  -- 2. Solo permitir si es super_admin
  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'No tienes permisos para eliminar usuarios. Acceso denegado.';
  END IF;

  -- 3. Evitar que un super_admin se borre a sí mismo por error
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia cuenta de administrador.';
  END IF;

  -- 4. Borrar de auth.users (el trigger ON DELETE CASCADE se encarga del perfil)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
