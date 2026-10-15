-- ============================================================================
-- schema_v23.sql — Tiempo de estancia del voluntario (3 a 24 meses)
-- ============================================================================
--
-- ⚠️  NO APLICADO. Se ejecuta A MANO en el SQL Editor de Supabase, después de
--     schema_v22.sql y de probar la rama feat/coordinador-voluntariado. No toca
--     datos existentes: las columnas nacen en NULL para todos.
--
-- Qué hace:
--   1. Añade a `perfiles` el tiempo de permanencia del voluntario en la
--      Fundación (`tiempo_estancia_meses`, de 3 a 24) y su fecha de inicio.
--      Con ambos se calcula la fecha de fin y, más adelante, la duración del
--      curso de español y la emisión del certificado.
--   2. Crea la función `guardar_tiempo_estancia(meses)`, que cada usuario usa
--      para guardar SU PROPIA estancia.
--
-- Por qué una función y no un UPDATE directo desde la app:
--   Con schema_v17, `perfiles_upd` solo deja escribir a super_admin. En lugar de
--   abrir una política de auto-edición sobre toda la fila (que permitiría a
--   alguien cambiar su propio `rol` o `es_coordinador`), esta función solo puede
--   tocar estas dos columnas y solo de la fila del usuario autenticado.
--
-- La app detecta si las columnas existen: antes de aplicar este script no muestra
-- el campo ni el aviso, así que se puede desplegar en cualquier orden.
-- ============================================================================

BEGIN;

-- 1. Columnas ----------------------------------------------------------------
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS tiempo_estancia_meses SMALLINT,
  ADD COLUMN IF NOT EXISTS fecha_inicio_estancia DATE;

COMMENT ON COLUMN public.perfiles.tiempo_estancia_meses IS
  'Meses que el voluntario permanecerá en la Fundación (3 a 24). Lo fija el propio voluntario.';
COMMENT ON COLUMN public.perfiles.fecha_inicio_estancia IS
  'Fecha en que el voluntario indicó por primera vez su estancia. Base del cálculo de fin y certificado.';

-- ADD CONSTRAINT no admite IF NOT EXISTS: se comprueba a mano.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.perfiles'::regclass
      AND conname  = 'perfiles_estancia_check'
  ) THEN
    ALTER TABLE public.perfiles
      ADD CONSTRAINT perfiles_estancia_check
      CHECK (tiempo_estancia_meses IS NULL OR tiempo_estancia_meses BETWEEN 3 AND 24);
  END IF;
END $$;

-- 2. Función para que cada usuario guarde su propia estancia ------------------
-- La fecha de inicio se fija la primera vez y se conserva si luego cambia la
-- duración (p. ej. una ampliación).
CREATE OR REPLACE FUNCTION public.guardar_tiempo_estancia(p_meses INTEGER)
RETURNS TABLE (meses SMALLINT, inicio DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meses  SMALLINT;
  v_inicio DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_meses IS NULL OR p_meses < 3 OR p_meses > 24 THEN
    RAISE EXCEPTION 'El tiempo de estancia debe estar entre 3 y 24 meses' USING ERRCODE = '22023';
  END IF;

  UPDATE public.perfiles p
     SET tiempo_estancia_meses = p_meses::SMALLINT,
         fecha_inicio_estancia = COALESCE(p.fecha_inicio_estancia, CURRENT_DATE)
   WHERE p.id = auth.uid()
  RETURNING p.tiempo_estancia_meses, p.fecha_inicio_estancia
       INTO v_meses, v_inicio;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil no encontrado' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY SELECT v_meses, v_inicio;
END;
$$;

REVOKE ALL     ON FUNCTION public.guardar_tiempo_estancia(INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.guardar_tiempo_estancia(INTEGER) TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (solo lectura)
-- ============================================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'perfiles'
--   AND column_name IN ('tiempo_estancia_meses', 'fecha_inicio_estancia');
--
-- SELECT proname FROM pg_proc WHERE proname = 'guardar_tiempo_estancia';

-- ============================================================================
-- ROLLBACK (pierde las estancias ya guardadas):
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.guardar_tiempo_estancia(INTEGER);
-- ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_estancia_check;
-- ALTER TABLE public.perfiles
--   DROP COLUMN IF EXISTS tiempo_estancia_meses,
--   DROP COLUMN IF EXISTS fecha_inicio_estancia;
-- COMMIT;
