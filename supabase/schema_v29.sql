-- ============================================================================
-- schema_v29.sql — Curso de español: progreso por lección
-- ============================================================================
--
-- ⚠️  NO APLICADO. Se ejecuta A MANO en el SQL Editor de Supabase, DESPUÉS de
--     schema_v24.sql (usa public.puede_revisar_bitacoras()). No toca datos.
--
-- Qué guarda: una fila por voluntario y lección completada (`leccion_id` es el
-- identificador del contenido, p. ej. 'u1-l2'), con el mejor puntaje, la fecha de
-- la primera vez que la completó y el número de intentos.
--
-- Quién lo ve: cada usuario ve lo SUYO; super_admin y coordinadores ven todo (el
-- seguimiento del proceso formativo es tarea de la coordinación).
-- Quién lo escribe: solo la función guardar_progreso_leccion(), para la sesión que
-- llama (la API no tiene INSERT/UPDATE/DELETE).
--
-- Nota de integridad: el contenido y las respuestas del curso viajan en la app, así
-- que un voluntario técnico podría marcar lecciones como hechas. El curso es
-- OPCIONAL y formativo; si el certificado necesitara garantía fuerte, habría que
-- mover la corrección de respuestas al servidor.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.curso_progreso (
  user_id       UUID        NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  leccion_id    TEXT        NOT NULL,
  puntaje       SMALLINT    NOT NULL CHECK (puntaje BETWEEN 0 AND 100),
  intentos      SMALLINT    NOT NULL DEFAULT 1,
  completada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, leccion_id),
  CONSTRAINT curso_progreso_leccion_check CHECK (leccion_id ~ '^u[0-9]{1,2}-l[0-9]{1,2}$')
);

ALTER TABLE public.curso_progreso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS curso_progreso_sel ON public.curso_progreso;
CREATE POLICY curso_progreso_sel ON public.curso_progreso
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.puede_revisar_bitacoras());

REVOKE ALL ON public.curso_progreso FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.curso_progreso FROM authenticated;
GRANT  SELECT ON public.curso_progreso TO authenticated;

-- Guardar el resultado de una lección (única vía de escritura) ------------------------
-- Conserva la fecha de la primera vez y el mejor puntaje; suma un intento cada vez.
CREATE OR REPLACE FUNCTION public.guardar_progreso_leccion(p_leccion_id TEXT, p_puntaje INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  IF p_leccion_id IS NULL OR p_leccion_id !~ '^u[0-9]{1,2}-l[0-9]{1,2}$' THEN
    RAISE EXCEPTION 'Lección inválida' USING ERRCODE = '22023';
  END IF;
  IF p_puntaje IS NULL OR p_puntaje < 0 OR p_puntaje > 100 THEN
    RAISE EXCEPTION 'Puntaje inválido' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.curso_progreso (user_id, leccion_id, puntaje)
  VALUES (auth.uid(), p_leccion_id, p_puntaje::SMALLINT)
  ON CONFLICT (user_id, leccion_id) DO UPDATE
     SET puntaje   = GREATEST(public.curso_progreso.puntaje, EXCLUDED.puntaje),
         intentos  = LEAST(public.curso_progreso.intentos + 1, 32000),
         ultima_en = NOW();
END;
$$;

REVOKE ALL     ON FUNCTION public.guardar_progreso_leccion(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.guardar_progreso_leccion(TEXT, INTEGER) TO authenticated;

-- Resumen para la coordinación: lecciones completadas por voluntario ---------------------
CREATE OR REPLACE FUNCTION public.curso_resumen()
RETURNS TABLE (user_id UUID, completadas INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  IF NOT public.puede_revisar_bitacoras() THEN
    RAISE EXCEPTION 'No tienes permiso' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT cp.user_id, COUNT(*)::INTEGER
    FROM public.curso_progreso cp
   GROUP BY cp.user_id;
END;
$$;

REVOKE ALL     ON FUNCTION public.curso_resumen() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.curso_resumen() TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (solo lectura)
-- ============================================================================
-- SELECT to_regclass('public.curso_progreso');
-- SELECT proname FROM pg_proc WHERE proname IN ('guardar_progreso_leccion', 'curso_resumen');

-- ============================================================================
-- ROLLBACK (borra todo el progreso del curso):
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.curso_resumen();
-- DROP FUNCTION IF EXISTS public.guardar_progreso_leccion(TEXT, INTEGER);
-- DROP TABLE IF EXISTS public.curso_progreso;
-- COMMIT;
