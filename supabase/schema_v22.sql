-- ============================================================================
-- schema_v22.sql — Rol adicional: Coordinador de Voluntariado (es_coordinador)
-- ============================================================================
--
-- ⚠️  NO APLICADO. Se ejecuta A MANO en el SQL Editor de Supabase, DESPUÉS de
--     probar la rama feat/coordinador-voluntariado. No cambia el rol de nadie:
--     la columna nace en FALSE para todos. La marca se otorga desde /usuarios
--     ("Gestionar roles") con la sesión del super admin principal.
--
-- Por qué una columna y no un valor más de `perfiles.rol`:
--   `rol` guarda UN solo valor. Un usuario como e_milton@fundacionarupo.org debe
--   conservar `super_admin` Y ser además Coordinador de Voluntariado, así que el
--   coordinador es un rol ADICIONAL que se suma al principal. `perfiles.rol` y
--   sus políticas no se tocan: nada de lo que ya funciona cambia.
--
-- Seguridad:
--   Con schema_v17 (si está aplicado) `perfiles_upd` solo deja escribir a
--   super_admin, así que nadie puede otorgarse la marca a sí mismo. Si en
--   producción existiera alguna política de auto-edición no versionada en este
--   repo, revísala: permitiría a cualquiera cambiar su propio `rol` y también
--   `es_coordinador`.
--   Esta migración no modifica políticas RLS. Si algún día se aplica
--   schema_v21.sql (RLS por rol, no aplicado), habrá que decidir ahí qué tablas
--   debe ver quien tenga es_coordinador.
-- ============================================================================

BEGIN;

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS es_coordinador BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.perfiles.es_coordinador IS
  'Rol adicional: Coordinador de Voluntariado. Se suma a perfiles.rol; solo lo otorga un super_admin.';

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (solo lectura)
-- ============================================================================
-- SELECT email, rol, es_coordinador FROM public.perfiles ORDER BY es_coordinador DESC, rol;

-- ============================================================================
-- ROLLBACK (pierde la marca de quien la tenga):
-- ============================================================================
-- ALTER TABLE public.perfiles DROP COLUMN IF EXISTS es_coordinador;
