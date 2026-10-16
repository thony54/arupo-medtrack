-- ============================================================================
-- schema_v30.sql — Tareas asignadas a voluntarios por la coordinación
-- ============================================================================
--
-- ⚠️  NO APLICADO. Se ejecuta A MANO en el SQL Editor de Supabase, DESPUÉS de
--     schema_v24.sql (usa public.puede_revisar_bitacoras()). No toca datos
--     existentes: solo crea una tabla nueva y tres funciones.
--
-- Qué es: el documento de módulos pide que la pestaña "Mis Actividades" muestre las
-- "tareas asignadas" del voluntario. Las asigna el Coordinador de Voluntariado
-- (y el super_admin, igual que el resto de acciones de coordinación).
--
-- Quién ve qué: cada voluntario ve SOLO sus tareas; super_admin y coordinadores ven todas.
-- Quién escribe: únicamente las funciones de abajo (la API no tiene INSERT/UPDATE/DELETE):
--   · asignar_tarea(voluntario, título, descripción, fecha límite)   → coordinación
--   · completar_tarea(tarea, completada)                             → el voluntario dueño o la coordinación
--   · retirar_tarea(tarea)                                           → coordinación (borra una tarea asignada por error)
--
-- Reglas que hace valer el servidor:
--   · Solo se asigna a usuarios con rol 'voluntario'.
--   · Título de 1 a 120 caracteres, descripción de hasta 500, máximo 50 tareas
--     pendientes por voluntario.
--   · El nombre de quien asigna y la fecha se fijan en el servidor (reloj de la base).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tareas_voluntario (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  voluntario_id       UUID        NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  titulo              TEXT        NOT NULL,
  descripcion         TEXT,
  fecha_limite        DATE,
  asignada_por        UUID        REFERENCES public.perfiles(id) ON DELETE SET NULL,
  asignada_por_nombre TEXT        NOT NULL,
  estado              TEXT        NOT NULL DEFAULT 'pendiente',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completada_en       TIMESTAMPTZ,
  CONSTRAINT tareas_voluntario_titulo_check      CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 120),
  CONSTRAINT tareas_voluntario_descripcion_check CHECK (descripcion IS NULL OR char_length(descripcion) <= 500),
  CONSTRAINT tareas_voluntario_estado_check      CHECK (estado IN ('pendiente', 'completada'))
);

CREATE INDEX IF NOT EXISTS tareas_voluntario_voluntario_idx
  ON public.tareas_voluntario (voluntario_id, created_at DESC);

ALTER TABLE public.tareas_voluntario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tareas_voluntario_sel ON public.tareas_voluntario;
CREATE POLICY tareas_voluntario_sel ON public.tareas_voluntario
  FOR SELECT TO authenticated
  USING (voluntario_id = auth.uid() OR public.puede_revisar_bitacoras());

REVOKE ALL ON public.tareas_voluntario FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tareas_voluntario FROM authenticated;
GRANT  SELECT ON public.tareas_voluntario TO authenticated;

-- Asignar una tarea a un voluntario ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.asignar_tarea(
  p_voluntario_id UUID,
  p_titulo        TEXT,
  p_descripcion   TEXT,
  p_fecha_limite  DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_nombre      TEXT;
  v_titulo      TEXT := btrim(COALESCE(p_titulo, ''));
  v_descripcion TEXT := NULLIF(btrim(COALESCE(p_descripcion, '')), '');
  v_id          UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  IF NOT public.puede_revisar_bitacoras() THEN
    RAISE EXCEPTION 'No tienes permiso para asignar tareas' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_titulo) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'El título debe tener entre 1 y 120 caracteres' USING ERRCODE = '22023';
  END IF;
  IF v_descripcion IS NOT NULL AND char_length(v_descripcion) > 500 THEN
    RAISE EXCEPTION 'La descripción admite hasta 500 caracteres' USING ERRCODE = '22023';
  END IF;
  -- Un día de margen: el reloj de la base va en UTC y la Fundación en Ecuador (UTC-5).
  IF p_fecha_limite IS NOT NULL AND p_fecha_limite < CURRENT_DATE - 1 THEN
    RAISE EXCEPTION 'La fecha límite ya pasó' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.perfiles WHERE id = p_voluntario_id AND rol = 'voluntario') THEN
    RAISE EXCEPTION 'El voluntario no existe' USING ERRCODE = 'P0002';
  END IF;
  IF (SELECT COUNT(*) FROM public.tareas_voluntario
       WHERE voluntario_id = p_voluntario_id AND estado = 'pendiente') >= 50 THEN
    RAISE EXCEPTION 'Este voluntario ya tiene 50 tareas pendientes' USING ERRCODE = '54000';
  END IF;

  SELECT COALESCE(NULLIF(btrim(nombre), ''), email, 'Sin nombre') INTO v_nombre
    FROM public.perfiles WHERE id = v_uid;

  INSERT INTO public.tareas_voluntario
    (voluntario_id, titulo, descripcion, fecha_limite, asignada_por, asignada_por_nombre)
  VALUES
    (p_voluntario_id, v_titulo, v_descripcion, p_fecha_limite, v_uid, COALESCE(v_nombre, 'Sin nombre'))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Marcar una tarea como hecha (o volver a pendiente) --------------------------------------
-- El voluntario dueño de la tarea o la coordinación.
CREATE OR REPLACE FUNCTION public.completar_tarea(p_id UUID, p_completada BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  IF p_completada IS NULL THEN
    RAISE EXCEPTION 'Valor inválido' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tareas_voluntario
     SET estado        = CASE WHEN p_completada THEN 'completada' ELSE 'pendiente' END,
         completada_en = CASE WHEN p_completada THEN NOW() ELSE NULL END
   WHERE id = p_id
     AND (voluntario_id = v_uid OR public.puede_revisar_bitacoras());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La tarea no existe o no tienes permiso' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- Retirar una tarea asignada por error -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.retirar_tarea(p_id UUID)
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
    RAISE EXCEPTION 'No tienes permiso para retirar tareas' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.tareas_voluntario WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La tarea no existe' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL     ON FUNCTION public.asignar_tarea(UUID, TEXT, TEXT, DATE) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.asignar_tarea(UUID, TEXT, TEXT, DATE) TO authenticated;
REVOKE ALL     ON FUNCTION public.completar_tarea(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.completar_tarea(UUID, BOOLEAN) TO authenticated;
REVOKE ALL     ON FUNCTION public.retirar_tarea(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.retirar_tarea(UUID) TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (solo lectura)
-- ============================================================================
-- SELECT to_regclass('public.tareas_voluntario');
-- SELECT proname FROM pg_proc WHERE proname IN ('asignar_tarea', 'completar_tarea', 'retirar_tarea');

-- ============================================================================
-- ROLLBACK (borra todas las tareas asignadas):
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.retirar_tarea(UUID);
-- DROP FUNCTION IF EXISTS public.completar_tarea(UUID, BOOLEAN);
-- DROP FUNCTION IF EXISTS public.asignar_tarea(UUID, TEXT, TEXT, DATE);
-- DROP TABLE IF EXISTS public.tareas_voluntario;
-- COMMIT;
