-- ============================================================================
-- schema_v31.sql — Cerrar lo que sigue abierto SIN iniciar sesión
--                  (`perfiles` + vistas `alertas_vencimiento` / `historial_beneficiarios`)
-- ============================================================================
--
-- ⚠️  NO APLICADO. La app está en producción con datos reales. No se pudo probar
--     contra Postgres (no hay una base local): léelo entero antes de ejecutarlo.
--
-- Qué se comprobó (2026-10-21, sondas de solo lectura con la anon key, sin leer filas):
--   · perfiles                 → 10 filas visibles sin sesión; `relrowsecurity = false`
--   · alertas_vencimiento      → 26 filas visibles sin sesión
--   · historial_beneficiarios  → 16 filas visibles sin sesión
--   Las demás tablas (beneficiarios, lotes, medicinas, donantes, entregas, ...) ya
--   devuelven 0: schema_v21 las cerró. v21 NO tocó `perfiles` ni las vistas; la PARTE 1
--   de schema_v17 (que sí lo hacía) nunca se ejecutó.
--
-- Por qué `perfiles` es lo más grave:
--   Con RLS apagada y los permisos por defecto de Supabase, lo esperable es que
--   `perfiles` no solo se LEA sino también se pueda ESCRIBIR con la anon key (la
--   escritura NO se probó: habría que tocar datos reales). Y `rol_actual()` (la base de
--   TODAS las políticas de v21) lee el rol de ahí: quien pueda cambiar su propio `rol`
--   a 'super_admin' se salta toda la protección.
--
-- Qué hace este script:
--   1. Quita a `anon` todos los permisos sobre las tablas y vistas de `public`.
--   2. Hace que las vistas respeten la RLS de quien las consulta (security_invoker).
--   3. Activa RLS en `perfiles` con políticas nuevas:
--        · leer:    cualquier usuario con sesión (la app lo necesita: AuthContext, líderes, /equipos)
--        · insertar y borrar: solo super_admin
--        · editar:  super_admin cualquier fila; cada persona SOLO la suya
--   4. Un trigger impide que quien no es super_admin cambie, ni siquiera en su propia
--      fila, los campos de poder: rol, email, es_coordinador, es_lider, lider_id,
--      tiempo_estancia_meses, fecha_inicio_estancia. Sí puede cambiar nombre, avatar,
--      teléfono, dirección y los campos de perfil de la pantalla Perfil.
--
-- Qué NO cambia:
--   · Las funciones SECURITY DEFINER (guardar_tiempo_estancia, asignar_lider,
--     asignar_voluntario_a_lider, ...), la Edge Function `crear-personal` (service_role)
--     y el SQL Editor siguen pudiendo escribir esos campos: el trigger solo vigila las
--     peticiones directas de la API (rol `authenticated` / `anon`).
--   · Login: la app lee `perfiles` DESPUÉS de iniciar sesión (Login.jsx), no antes.
--
-- Requisitos: schema_v21 aplicado (existe `rol_actual()`) y las columnas de v22, v23 y
-- v27 en `perfiles` (se comprobó que existen). Si falta algo, el script aborta entero
-- y no cambia nada (va en una transacción).
-- ============================================================================

BEGIN;

-- 0. Comprobación previa --------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.rol_actual()') IS NULL THEN
    RAISE EXCEPTION 'Falta public.rol_actual(): aplica schema_v21.sql antes que este script.';
  END IF;
END $$;

-- 1. `anon` fuera de todo `public` ----------------------------------------------
-- La app no lee nada sin sesión (el login va por el endpoint de auth, no por tablas).
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- 2. Vistas: por defecto se ejecutan con los permisos de su creador e ignoran la RLS
-- de las tablas que consultan. security_invoker (PostgreSQL 15+) las hace respetarla.
-- `historial_donantes` ya devolvía 0, pero se deja igual por coherencia.
ALTER VIEW public.alertas_vencimiento     SET (security_invoker = on);
ALTER VIEW public.historial_beneficiarios SET (security_invoker = on);
ALTER VIEW public.historial_donantes      SET (security_invoker = on);

-- 3. perfiles: RLS + políticas ---------------------------------------------------
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Con RLS apagada cualquier política vieja era inocua; al encenderla pasarían a
-- aplicarse todas, incluidas las creadas a mano en el panel. Se parte de cero.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'perfiles'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.perfiles', p.policyname);
  END LOOP;
END $$;

CREATE POLICY perfiles_sel ON public.perfiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY perfiles_ins ON public.perfiles
  FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() = 'super_admin');

CREATE POLICY perfiles_upd ON public.perfiles
  FOR UPDATE TO authenticated
  USING      (public.rol_actual() = 'super_admin' OR id = auth.uid())
  WITH CHECK (public.rol_actual() = 'super_admin' OR id = auth.uid());

CREATE POLICY perfiles_del ON public.perfiles
  FOR DELETE TO authenticated
  USING (public.rol_actual() = 'super_admin');

-- 4. Los campos de poder no se editan solos ---------------------------------------
-- La política deja a cada persona editar SU fila; este trigger acota QUÉ columnas.
-- No es SECURITY DEFINER a propósito: así `current_user` es el rol efectivo de la
-- petición ('authenticated' en la API) y, dentro de una función SECURITY DEFINER,
-- el dueño de la función (postgres), que pasa sin restricción.
CREATE OR REPLACE FUNCTION public.perfiles_proteger_campos()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF public.rol_actual() = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.rol                   IS DISTINCT FROM OLD.rol
     OR NEW.email              IS DISTINCT FROM OLD.email
     OR NEW.es_coordinador     IS DISTINCT FROM OLD.es_coordinador
     OR NEW.es_lider           IS DISTINCT FROM OLD.es_lider
     OR NEW.lider_id           IS DISTINCT FROM OLD.lider_id
     OR NEW.tiempo_estancia_meses  IS DISTINCT FROM OLD.tiempo_estancia_meses
     OR NEW.fecha_inicio_estancia  IS DISTINCT FROM OLD.fecha_inicio_estancia
  THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar ese dato del perfil'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS perfiles_proteger_campos ON public.perfiles;
CREATE TRIGGER perfiles_proteger_campos
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.perfiles_proteger_campos();

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (solo lectura). Después de aplicar:
-- ============================================================================
-- -- RLS activa en perfiles (debe dar true):
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'perfiles';
--
-- -- Políticas de perfiles (deben ser exactamente 4, todas {authenticated}):
-- SELECT policyname, roles, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'perfiles';
--
-- -- Ninguna política del esquema debe alcanzar a anon/public:
-- SELECT tablename, policyname, roles, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND (roles::text LIKE '%anon%' OR roles::text LIKE '%public%');
--
-- Pruebas con sesión (una por rol), tras aplicar:
--   · super_admin: /usuarios carga, puede cambiar un rol y "Gestionar roles".
--   · voluntario:  Perfil → cambiar nombre, teléfono, foto y tiempo de estancia (RPC) funcionan;
--                  Inicio carga; el selector de líder del cierre de jornada lista líderes.
--   · brigadista:  Perfil → guardar especialidad/licencia/institución; Inventario carga.
--   · coordinador: /equipos carga y puede designar líder / asignar voluntarios (RPC).

-- ============================================================================
-- ROLLBACK de emergencia (si alguna pantalla queda en blanco y no hay tiempo de
-- depurar). Deja `perfiles` como estaba (abierta): es un salvavidas, NO es seguro.
-- ============================================================================
-- BEGIN;
-- ALTER TABLE public.perfiles DISABLE ROW LEVEL SECURITY;
-- DROP TRIGGER IF EXISTS perfiles_proteger_campos ON public.perfiles;
-- ALTER VIEW public.alertas_vencimiento     SET (security_invoker = off);
-- ALTER VIEW public.historial_beneficiarios SET (security_invoker = off);
-- ALTER VIEW public.historial_donantes      SET (security_invoker = off);
-- COMMIT;
