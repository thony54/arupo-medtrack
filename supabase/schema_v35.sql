-- ============================================================================
-- schema_v35.sql — Coordinación solo para quien tiene un rol de coordinación
-- ============================================================================
--
-- ⚠️  NO APLICADO. Se ejecuta A MANO en el SQL Editor de Supabase, DESPUÉS de
--     schema_v33.sql. No toca datos ni cambia el `rol` de nadie. No se pudo probar
--     contra Postgres (no hay una base local): léelo antes de ejecutarlo.
--
-- Jerarquía que fija este script:
--   · Admin principal (thony.karter@gmail.com): nada por encima. Ve y gestiona todo,
--     incluida la Coordinación de ambos equipos.
--   · Admin (`rol = 'super_admin'`): administra inventario, CRM y personal, pero NO entra
--     a Coordinación por ser admin. Solo entra si el admin principal le asignó un rol de
--     coordinación (`es_coordinador` o `es_coordinador_brigadas`), y entonces ve solo a su
--     equipo.
--   · Voluntarios y brigadistas, por debajo.
--
-- Qué cambia respecto a schema_v33.sql (que daba a TODO super_admin acceso a los dos equipos):
--   1. `puede_revisar_bitacoras()` y `puede_gestionar_usuario()`: el acceso por ser
--      super_admin pasa a ser solo del admin principal. Como todas las políticas y RPC de
--      Coordinación (bitácoras, fotos, tareas, avance del curso, líderes) cuelgan de estas
--      dos funciones, un admin corriente deja de leer y de escribir en ellas.
--   2. Los roles de coordinación y los líderes (`es_coordinador`, `es_coordinador_brigadas`,
--      `es_lider`, `lider_id`) solo los cambia el admin principal. Antes, la interfaz solo se
--      lo mostraba a él, pero la API dejaba a cualquier admin ponerse `es_coordinador = true`
--      con una petición directa. Las funciones de Coordinación (SECURITY DEFINER) siguen
--      pudiendo asignar líderes porque el trigger solo vigila las peticiones de la API.
--   3. `asignar_lider`: la excepción "super_admin puede quitar a cualquier líder" pasa a ser
--      del admin principal.
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
    RAISE EXCEPTION 'Falta schema_v33.sql: aplícalo antes que este script.';
  END IF;
END $$;

-- 1. ¿Tiene acceso a Coordinación? -------------------------------------------------
-- Solo un rol de coordinación asignado, o el admin principal. Ser super_admin ya no basta.
CREATE OR REPLACE FUNCTION public.puede_revisar_bitacoras()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (es_coordinador
             OR es_coordinador_brigadas
             OR (rol = 'super_admin' AND public.es_super_admin_principal()))
       FROM public.perfiles WHERE id = auth.uid()),
    FALSE
  )
$$;

-- ¿Puede quien llama gestionar a ESTA persona?
--   admin principal           → voluntarios y brigadistas
--   es_coordinador            → voluntarios
--   es_coordinador_brigadas   → brigadistas
--   cualquier otro (incluido un admin corriente) → nadie
CREATE OR REPLACE FUNCTION public.puede_gestionar_usuario(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT CASE
              WHEN me.rol = 'super_admin' AND public.es_super_admin_principal() THEN TRUE
              ELSE EXISTS (
                SELECT 1 FROM public.perfiles t
                 WHERE t.id = p_user_id
                   AND ((me.es_coordinador AND t.rol = 'voluntario')
                     OR (me.es_coordinador_brigadas AND t.rol = 'brigadista'))
              )
            END
       FROM public.perfiles me
      WHERE me.id = auth.uid()),
    FALSE
  )
$$;

REVOKE ALL     ON FUNCTION public.puede_revisar_bitacoras() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.puede_revisar_bitacoras() TO authenticated;
REVOKE ALL     ON FUNCTION public.puede_gestionar_usuario(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.puede_gestionar_usuario(UUID) TO authenticated;

-- 2. Los roles de coordinación y los líderes solo los cambia el admin principal ------
-- Igual que en schema_v33.sql, ampliando la lista de campos que exigen al admin principal.
-- Sigue sin ser SECURITY DEFINER a propósito: `current_user` es el rol de la petición
-- ('authenticated' en la API) y las funciones SECURITY DEFINER, la Edge Function y el SQL
-- Editor (dueño o service_role) pasan sin restricción.
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
      OR NEW.es_lider             IS DISTINCT FROM OLD.es_lider
      OR NEW.lider_id             IS DISTINCT FROM OLD.lider_id)
     AND NOT public.es_super_admin_principal() THEN
    RAISE EXCEPTION 'Solo el admin principal puede asignar roles de coordinación'
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

-- 3. Quitar un líder: la excepción es del admin principal ---------------------------------
-- Igual que en schema_v33.sql; solo cambia quién puede quitar a un líder que tiene personas
-- de otro equipo asignadas.
CREATE OR REPLACE FUNCTION public.asignar_lider(p_user_id UUID, p_es_lider BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  IF NOT public.puede_revisar_bitacoras() THEN
    RAISE EXCEPTION 'No tienes permiso para designar líderes' USING ERRCODE = '42501';
  END IF;
  IF p_es_lider IS NULL THEN
    RAISE EXCEPTION 'Valor inválido' USING ERRCODE = '22023';
  END IF;

  IF NOT p_es_lider AND NOT public.es_super_admin_principal() AND EXISTS (
       SELECT 1 FROM public.perfiles
        WHERE lider_id = p_user_id AND NOT public.puede_gestionar_usuario(id)
     ) THEN
    RAISE EXCEPTION 'Este líder tiene personas de otro equipo asignadas' USING ERRCODE = '55006';
  END IF;

  UPDATE public.perfiles SET es_lider = p_es_lider WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario no existe' USING ERRCODE = 'P0002';
  END IF;

  -- Si deja de ser líder, las personas que tenía asignadas quedan sin asignar.
  IF NOT p_es_lider THEN
    UPDATE public.perfiles SET lider_id = NULL WHERE lider_id = p_user_id;
  END IF;
END;
$$;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (solo lectura). Después de aplicar, con una sesión de cada tipo:
-- ============================================================================
--   · Admin corriente (p. ej. Mayra), en la app: el menú ya no muestra "Coordinación" y
--     /bitacoras, /equipos y /asignar-tareas redirigen al Inicio.
--   · Ese mismo admin, desde el SQL Editor con su sesión simulada o con una petición directa
--     a la API, no puede leer `bitacoras` ni `tareas_voluntario` de otros, ni ponerse
--     `es_coordinador = true` (error 42501 "Solo el admin principal...").
--   · Milton (admin + Coordinador de Voluntariado): ve solo voluntarios.
--   · Admin principal (thony.karter): ve voluntarios y brigadistas.
--
-- -- ¿Quién tiene hoy acceso a Coordinación? (debe ser el admin principal + quien tenga un flag):
-- SELECT email, rol, es_coordinador, es_coordinador_brigadas FROM public.perfiles
--  WHERE es_coordinador OR es_coordinador_brigadas OR email = 'thony.karter@gmail.com';

-- ============================================================================
-- ROLLBACK (vuelve a dar a todo super_admin acceso a Coordinación): ejecutar de nuevo
-- las definiciones de puede_revisar_bitacoras, puede_gestionar_usuario,
-- perfiles_proteger_campos y asignar_lider de schema_v33.sql.
-- ============================================================================
