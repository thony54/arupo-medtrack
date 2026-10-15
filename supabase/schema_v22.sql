-- ============================================================================
-- schema_v22.sql — Nuevo rol: Coordinador de Voluntariado ('coordinador')
-- ============================================================================
--
-- ⚠️  NO APLICADO. Se ejecuta A MANO en el SQL Editor de Supabase, DESPUÉS de
--     probar la rama feat/coordinador-voluntariado. No toca datos: no cambia el
--     rol de ningún usuario. El rol se otorga desde /usuarios con la sesión del
--     super admin principal (botón "Cambiar rol").
--
-- Qué hace:
--   Deja que `perfiles.rol` acepte 'coordinador'. Si en producción existiera un
--   CHECK sobre `rol` (schema_v4 lo definía; schema_v12 recreó la tabla sin él,
--   así que puede no existir), se sustituye por uno que incluya los 4 roles.
--
-- Qué NO hace (a propósito):
--   · No modifica políticas RLS. Con las de schema_v17 (si están aplicadas)
--     cualquier autenticado LEE las tablas y solo escribe super_admin /
--     brigadista / voluntario según el dominio, así que 'coordinador' no puede
--     escribir en inventario ni CRM. Las políticas de perfiles (solo super_admin
--     escribe) son las que impiden que otro rol se otorgue roles a sí mismo.
--   · Si algún día se aplica schema_v21.sql (RLS por rol, no aplicado), habrá
--     que añadir 'coordinador' a las listas de rol_actual() que correspondan.
--
-- Antes de aplicar (solo lectura): confirma que no hay roles fuera de los 4.
--   SELECT rol, COUNT(*) FROM public.perfiles GROUP BY rol;
-- Si aparece algún valor distinto de super_admin/brigadista/voluntario, el
-- ALTER de abajo fallará y la transacción se revertirá sin cambios.
-- ============================================================================

BEGIN;

-- 1. Retirar cualquier CHECK existente que dependa de `rol`, sea cual sea su
--    nombre (el autogenerado suele ser perfiles_rol_check).
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum   = ANY (con.conkey)
    WHERE con.conrelid = 'public.perfiles'::regclass
      AND con.contype  = 'c'
      AND att.attname  = 'rol'
  LOOP
    EXECUTE format('ALTER TABLE public.perfiles DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- 2. CHECK con los cuatro roles vigentes.
ALTER TABLE public.perfiles
  ADD CONSTRAINT perfiles_rol_check
  CHECK (rol IN ('super_admin', 'coordinador', 'brigadista', 'voluntario'));

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (solo lectura)
-- ============================================================================
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.perfiles'::regclass AND contype = 'c';

-- ============================================================================
-- ROLLBACK (solo si ningún perfil tiene aún rol 'coordinador'; si lo tiene,
-- primero devuélvelo a otro rol desde /usuarios):
-- ============================================================================
-- BEGIN;
-- ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
-- ALTER TABLE public.perfiles
--   ADD CONSTRAINT perfiles_rol_check
--   CHECK (rol IN ('super_admin', 'brigadista', 'voluntario'));
-- COMMIT;
