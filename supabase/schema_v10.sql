-- ============================================================
-- Arupo MedTrack — Schema v10: Limpieza de Datos CRM (Wipe)
-- ¡ADVERTENCIA! Este script borrará todos los beneficiarios y donantes.
-- ============================================================

-- 1. Borrar datos de Beneficiarios y Donantes (Manteniendo la estructura)
-- Usamos CASCADE para que también se borren movimientos asociados a ellos.
TRUNCATE TABLE public.beneficiarios CASCADE;
TRUNCATE TABLE public.donantes CASCADE;

-- 2. Reiniciar los contadores de los códigos automáticos (BEN-0000, DON-0000)
-- Esto asegura que el próximo registro vuelva a ser el número 1.
ALTER SEQUENCE IF EXISTS beneficiario_code_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS donante_code_seq RESTART WITH 1;

-- 3. (Opcional) Limpiar perfiles que no sean Super Admin
-- Si quieres borrar también a los brigadistas/voluntarios creados:
-- DELETE FROM public.perfiles WHERE rol != 'super_admin';
-- DELETE FROM auth.users WHERE id NOT IN (SELECT id FROM public.perfiles WHERE rol = 'super_admin');

-- 4. Asegurar que el Super Admin actual tenga todos los permisos habilitados
ALTER TABLE public.perfiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total Super Admin" ON public.perfiles;
CREATE POLICY "Acceso total Super Admin" 
  ON public.perfiles FOR ALL 
  TO authenticated 
  USING (
    (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'super_admin'
  );
