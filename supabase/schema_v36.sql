-- ============================================================================
-- schema_v36.sql — Evaluaciones de salud y Gestión de Personal solo con rol asignado
-- ============================================================================
--
-- ⚠️  NO APLICADO. Se ejecuta A MANO en el SQL Editor de Supabase, DESPUÉS de
--     schema_v35.sql. No toca datos ni cambia el `rol` de nadie. No se pudo probar
--     contra Postgres (no hay una base local): léelo antes de ejecutarlo.
--
-- Dos reglas del dueño (Karter, admin principal), sobre la jerarquía de schema_v35.sql:
--
--   1. EVALUACIONES DE SALUD. Un Admin (`rol = 'super_admin'`) NO ve las evaluaciones por
--      serlo. Es un beneficio del rol Coordinador de Brigadas Médicas. Quedan así:
--        · admin principal ................ ve todas y puede registrar
--        · es_coordinador_brigadas ......... ve todas y puede registrar
--        · brigadista ...................... registra y ve solo las suyas (como hasta ahora)
--        · Admin sin ese rol, voluntario ... nada (ni leer ni registrar)
--      Hoy la política "Super Admins pueden ver todas las evaluaciones" deja leer a cualquier
--      super_admin, y otra deja insertar a cualquier super_admin: se sustituyen.
--
--   2. GESTIÓN DE PERSONAL (/usuarios: ver, registrar y eliminar personal). Es un rol
--      ADICIONAL, `perfiles.es_gestor_personal`, que solo el admin principal otorga y solo a
--      un Admin. Sin él, un Admin no gestiona personal. Se hace valer en:
--        · las políticas INSERT/UPDATE/DELETE de `perfiles` (antes: cualquier super_admin);
--        · `eliminar_usuario` (antes: cualquier super_admin);
--        · el trigger de `perfiles`, que exige al admin principal para cambiar la columna nueva;
--        · la Edge Function `crear-personal` (código en supabase/functions; hay que redesplegarla).
--      Quien gestiona personal tampoco puede crear, modificar ni eliminar a otros Admin ni al
--      admin principal: eso queda para el admin principal.
--
-- Efecto inmediato al aplicar: los Admin actuales (Milton, Mayra, María Fernanda, ...) pierden
-- el acceso a Gestión de Personal hasta que el admin principal les asigne el rol desde
-- /usuarios → "Gestionar roles". El script no se lo da a nadie.
--
-- Todo va en una transacción: si algo falla, se revierte completo.
-- ============================================================================

BEGIN;

-- 0. Comprobación previa ----------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.es_super_admin_principal()') IS NULL
     OR to_regprocedure('public.puede_gestionar_usuario(uuid)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'perfiles'
                       AND column_name = 'es_coordinador_brigadas') THEN
    RAISE EXCEPTION 'Faltan schema_v33.sql y schema_v35.sql: aplícalos antes que este script.';
  END IF;
END $$;

-- 1. Columna ------------------------------------------------------------------------
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS es_gestor_personal BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.perfiles.es_gestor_personal IS
  'Rol adicional (solo para Admin): gestiona personal (Gestión de Personal). Solo lo otorga el admin principal.';

-- 2. Funciones de permiso -------------------------------------------------------------
-- ¿Puede gestionar personal? El admin principal, o un Admin con el rol asignado.
CREATE OR REPLACE FUNCTION public.puede_gestionar_personal()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (rol = 'super_admin' AND (es_gestor_personal OR public.es_super_admin_principal()))
       FROM public.perfiles WHERE id = auth.uid()),
    FALSE
  )
$$;

-- ¿Ve TODAS las evaluaciones? Admin principal o Coordinador de Brigadas Médicas.
CREATE OR REPLACE FUNCTION public.puede_ver_todas_evaluaciones()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (es_coordinador_brigadas
             OR (rol = 'super_admin' AND public.es_super_admin_principal()))
       FROM public.perfiles WHERE id = auth.uid()),
    FALSE
  )
$$;

-- ¿Puede registrar evaluaciones (y ver las suyas)? Lo anterior, más los brigadistas.
CREATE OR REPLACE FUNCTION public.puede_registrar_evaluaciones()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (rol = 'brigadista'
             OR es_coordinador_brigadas
             OR (rol = 'super_admin' AND public.es_super_admin_principal()))
       FROM public.perfiles WHERE id = auth.uid()),
    FALSE
  )
$$;

REVOKE ALL     ON FUNCTION public.puede_gestionar_personal() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.puede_gestionar_personal() TO authenticated;
REVOKE ALL     ON FUNCTION public.puede_ver_todas_evaluaciones() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.puede_ver_todas_evaluaciones() TO authenticated;
REVOKE ALL     ON FUNCTION public.puede_registrar_evaluaciones() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.puede_registrar_evaluaciones() TO authenticated;

-- 3. Evaluaciones de salud: políticas nuevas ------------------------------------------
-- Se parte de cero (como en schema_v31.sql con `perfiles`): al ser datos clínicos, no debe
-- quedar viva ninguna política vieja o creada a mano en el panel.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'evaluaciones_salud'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.evaluaciones_salud', p.policyname);
  END LOOP;
END $$;

ALTER TABLE public.evaluaciones_salud ENABLE ROW LEVEL SECURITY;

-- Ver: todas (admin principal / coordinador de brigadas) o las propias (quien puede registrar).
CREATE POLICY evaluaciones_sel ON public.evaluaciones_salud
  FOR SELECT TO authenticated
  USING (
    public.puede_ver_todas_evaluaciones()
    OR (brigadista_id = auth.uid() AND public.puede_registrar_evaluaciones())
  );

-- Registrar: brigadistas, coordinador de brigadas y admin principal.
CREATE POLICY evaluaciones_ins ON public.evaluaciones_salud
  FOR INSERT TO authenticated
  WITH CHECK (public.puede_registrar_evaluaciones());

-- (Sin UPDATE ni DELETE, igual que hasta ahora: una evaluación registrada no se edita ni se borra.)
REVOKE ALL ON public.evaluaciones_salud FROM anon;

-- 4. Perfiles: gestionar personal exige el rol ------------------------------------------
-- Antes: cualquier super_admin. Ahora: quien gestiona personal, pero nunca sobre un Admin ni sobre
-- el admin principal (esas filas solo las toca el admin principal). Cada persona sigue pudiendo
-- editar la suya; el trigger acota qué columnas.
DROP POLICY IF EXISTS perfiles_ins ON public.perfiles;
DROP POLICY IF EXISTS perfiles_upd ON public.perfiles;
DROP POLICY IF EXISTS perfiles_del ON public.perfiles;

CREATE POLICY perfiles_ins ON public.perfiles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.puede_gestionar_personal()
    AND (rol <> 'super_admin' OR public.es_super_admin_principal())
  );

CREATE POLICY perfiles_upd ON public.perfiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (public.puede_gestionar_personal() AND (rol <> 'super_admin' OR public.es_super_admin_principal()))
  )
  WITH CHECK (
    id = auth.uid()
    OR (public.puede_gestionar_personal() AND (rol <> 'super_admin' OR public.es_super_admin_principal()))
  );

CREATE POLICY perfiles_del ON public.perfiles
  FOR DELETE TO authenticated
  USING (
    public.puede_gestionar_personal()
    AND (rol <> 'super_admin' OR public.es_super_admin_principal())
  );

-- 5. El trigger de `perfiles` protege también la columna nueva -------------------------------
-- Igual que en schema_v35.sql; solo se añade `es_gestor_personal` a la lista de campos que exigen
-- al admin principal. Sigue sin ser SECURITY DEFINER a propósito (ver schema_v31/v35).
CREATE OR REPLACE FUNCTION public.perfiles_proteger_campos()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF (NEW.es_coordinador          IS DISTINCT FROM OLD.es_coordinador
      OR NEW.es_coordinador_brigadas IS DISTINCT FROM OLD.es_coordinador_brigadas
      OR NEW.es_gestor_personal   IS DISTINCT FROM OLD.es_gestor_personal
      OR NEW.es_lider             IS DISTINCT FROM OLD.es_lider
      OR NEW.lider_id             IS DISTINCT FROM OLD.lider_id)
     AND NOT public.es_super_admin_principal() THEN
    RAISE EXCEPTION 'Solo el admin principal puede asignar roles adicionales'
      USING ERRCODE = '42501';
  END IF;

  IF public.rol_actual() = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.rol                   IS DISTINCT FROM OLD.rol
     OR NEW.email              IS DISTINCT FROM OLD.email
     OR NEW.tiempo_estancia_meses  IS DISTINCT FROM OLD.tiempo_estancia_meses
     OR NEW.fecha_inicio_estancia  IS DISTINCT FROM OLD.fecha_inicio_estancia
  THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar ese dato del perfil'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

-- 6. Eliminar usuarios: exige gestionar personal ------------------------------------------------
-- Antes: cualquier super_admin (schema_v13.sql). Ahora: quien gestiona personal, y solo el admin
-- principal puede eliminar a un Admin. Nadie se elimina a sí mismo.
CREATE OR REPLACE FUNCTION public.eliminar_usuario(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol_objetivo TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.puede_gestionar_personal() THEN
    RAISE EXCEPTION 'No tienes permisos para eliminar usuarios. Acceso denegado.' USING ERRCODE = '42501';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia cuenta de administrador.' USING ERRCODE = '42501';
  END IF;

  SELECT rol INTO v_rol_objetivo FROM public.perfiles WHERE id = p_user_id;
  IF v_rol_objetivo = 'super_admin' AND NOT public.es_super_admin_principal() THEN
    RAISE EXCEPTION 'Solo el admin principal puede eliminar a un Admin.' USING ERRCODE = '42501';
  END IF;

  -- Borrar de auth.users (ON DELETE CASCADE se encarga del perfil).
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE ALL     ON FUNCTION public.eliminar_usuario(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.eliminar_usuario(UUID) TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (solo lectura). Después de aplicar, con una sesión de cada tipo:
-- ============================================================================
--   · Admin corriente (p. ej. Mayra): el menú ya no muestra Evaluaciones ni Gestión de Personal y
--     /evaluaciones y /usuarios redirigen al Inicio. Por la API no lee `evaluaciones_salud` ni
--     inserta en `perfiles`, ni llama a eliminar_usuario (42501).
--   · Brigadista: sigue viendo y registrando sus evaluaciones.
--   · Coordinador de Brigadas: ve todas las evaluaciones y puede registrar.
--   · Admin con "Gestión de Personal": entra a /usuarios, registra y elimina brigadistas y
--     voluntarios, pero no puede tocar a otro Admin ni al admin principal.
--   · Admin principal: todo lo anterior.
--
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname = 'public' AND tablename IN ('evaluaciones_salud', 'perfiles') ORDER BY 1;
-- SELECT email, rol, es_coordinador_brigadas, es_gestor_personal FROM public.perfiles WHERE rol = 'super_admin';

-- ============================================================================
-- ROLLBACK (devuelve a todo super_admin el acceso a evaluaciones y a Gestión de Personal):
-- ejecutar de nuevo las definiciones de perfiles_proteger_campos (schema_v35.sql), eliminar_usuario
-- (schema_v13.sql), las políticas perfiles_ins/upd/del (schema_v31.sql) y las de evaluaciones_salud
-- (schema_salud.sql). La columna `es_gestor_personal` puede quedarse: sin políticas que la lean,
-- no hace nada.
-- ============================================================================
