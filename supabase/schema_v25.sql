-- ============================================================================
-- schema_v25.sql — Aprobación de bitácoras por super_admin / coordinador
-- ============================================================================
--
-- ⚠️  NO APLICADO. Se ejecuta A MANO en el SQL Editor de Supabase, DESPUÉS de
--     schema_v24.sql. No toca datos: las bitácoras existentes siguen
--     'pendiente' hasta que alguien las apruebe desde la pantalla Bitácoras.
--
-- Qué hace:
--   1. Añade a `bitacoras` quién aprobó y cuándo (`revisado_por`,
--      `revisado_por_nombre`, `revisado_en`). El nombre se copia para que el
--      historial no cambie si luego se renombra o elimina al revisor.
--   2. Crea `aprobar_bitacora(id)`, ÚNICA vía para pasar a 'aprobada'. Sigue sin
--      haber políticas de UPDATE: la API no puede editar bitácoras, solo esta
--      función, que además fija la fecha de revisión con el reloj de la base.
--
-- Reglas que hace valer el servidor:
--   · Solo super_admin o coordinador (`puede_revisar_bitacoras()`).
--   · Solo si está 'pendiente' (una aprobada no se vuelve a tocar).
--   · Nadie aprueba su propia bitácora.
-- ============================================================================

BEGIN;

ALTER TABLE public.bitacoras
  ADD COLUMN IF NOT EXISTS revisado_por        UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revisado_por_nombre TEXT,
  ADD COLUMN IF NOT EXISTS revisado_en         TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.aprobar_bitacora(p_id UUID)
RETURNS TABLE (aprobada_en TIMESTAMPTZ, aprobada_por TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_nombre TEXT;
  v_en     TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.puede_revisar_bitacoras() THEN
    RAISE EXCEPTION 'No tienes permiso para aprobar bitácoras' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(NULLIF(btrim(nombre), ''), email, 'Sin nombre')
    INTO v_nombre
    FROM public.perfiles
   WHERE id = v_uid;

  UPDATE public.bitacoras b
     SET estado              = 'aprobada',
         revisado_por        = v_uid,
         revisado_por_nombre = v_nombre,
         revisado_en         = NOW()
   WHERE b.id = p_id
     AND b.estado = 'pendiente'
     AND b.voluntario_id <> v_uid
  RETURNING b.revisado_en INTO v_en;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La bitácora no existe, ya fue aprobada o es tuya' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY SELECT v_en, v_nombre;
END;
$$;

REVOKE ALL     ON FUNCTION public.aprobar_bitacora(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.aprobar_bitacora(UUID) TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (solo lectura)
-- ============================================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'bitacoras'
--    AND column_name IN ('revisado_por', 'revisado_por_nombre', 'revisado_en');
-- SELECT proname FROM pg_proc WHERE proname = 'aprobar_bitacora';

-- ============================================================================
-- ROLLBACK (pierde quién aprobó cada bitácora; el estado 'aprobada' se conserva):
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.aprobar_bitacora(UUID);
-- ALTER TABLE public.bitacoras
--   DROP COLUMN IF EXISTS revisado_por,
--   DROP COLUMN IF EXISTS revisado_por_nombre,
--   DROP COLUMN IF EXISTS revisado_en;
-- COMMIT;
