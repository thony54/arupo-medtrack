-- ============================================================================
-- schema_v32.sql — Rechazar bitácoras con un mensaje para el voluntario
-- ============================================================================
--
-- ⚠️  NO APLICADO. Se ejecuta A MANO en el SQL Editor de Supabase, DESPUÉS de
--     schema_v25.sql. No toca datos: las bitácoras existentes conservan su estado.
--     No se pudo probar contra Postgres (no hay una base local): léelo antes de ejecutarlo.
--
-- Qué hace:
--   1. Permite el estado 'rechazada' en `bitacoras` (hasta ahora solo 'pendiente' y
--      'aprobada') y añade `motivo_rechazo`: el mensaje que la coordinación le deja al
--      voluntario. Quién rechazó y cuándo se guarda en las columnas de revisión que ya
--      existen (`revisado_por`, `revisado_por_nombre`, `revisado_en`, de schema_v25).
--   2. Crea `rechazar_bitacora(id, motivo)`, ÚNICA vía para pasar a 'rechazada'. Sigue sin
--      haber políticas de UPDATE: la API no puede editar bitácoras, solo estas funciones.
--
-- Reglas que hace valer el servidor (las mismas de aprobar_bitacora + el mensaje):
--   · Solo super_admin o coordinador (`puede_revisar_bitacoras()`).
--   · Solo si está 'pendiente': una aprobada o rechazada no se vuelve a tocar. El
--     voluntario que quiera corregir registra una jornada nueva.
--   · Nadie rechaza su propia bitácora.
--   · El motivo es obligatorio (1 a 500 caracteres).
--
-- El voluntario ya lee sus propias bitácoras (`bitacoras_sel`), así que ve el estado y el
-- mensaje en "Mis Actividades" sin cambiar ninguna política.
-- ============================================================================

BEGIN;

-- 1. Estado 'rechazada' y mensaje --------------------------------------------------
-- La restricción del estado se declaró en línea en schema_v24 (nombre automático): se
-- busca por su definición en lugar de suponer el nombre.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.bitacoras'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%estado%'
       AND pg_get_constraintdef(oid) LIKE '%pendiente%'
  LOOP
    EXECUTE format('ALTER TABLE public.bitacoras DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.bitacoras
  ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;

ALTER TABLE public.bitacoras
  ADD CONSTRAINT bitacoras_estado_check
    CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  ADD CONSTRAINT bitacoras_rechazo_check
    CHECK (estado <> 'rechazada' OR (motivo_rechazo IS NOT NULL AND char_length(motivo_rechazo) BETWEEN 1 AND 500));

-- 2. Rechazar -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rechazar_bitacora(p_id UUID, p_motivo TEXT)
RETURNS TABLE (rechazada_en TIMESTAMPTZ, rechazada_por TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_nombre TEXT;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_motivo, '')), '');
  v_en     TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.puede_revisar_bitacoras() THEN
    RAISE EXCEPTION 'No tienes permiso para rechazar bitácoras' USING ERRCODE = '42501';
  END IF;

  IF v_motivo IS NULL OR char_length(v_motivo) > 500 THEN
    RAISE EXCEPTION 'Escribe el motivo del rechazo (hasta 500 caracteres)' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(NULLIF(btrim(nombre), ''), email, 'Sin nombre')
    INTO v_nombre
    FROM public.perfiles
   WHERE id = v_uid;

  UPDATE public.bitacoras b
     SET estado              = 'rechazada',
         motivo_rechazo      = v_motivo,
         revisado_por        = v_uid,
         revisado_por_nombre = v_nombre,
         revisado_en         = NOW()
   WHERE b.id = p_id
     AND b.estado = 'pendiente'
     AND b.voluntario_id <> v_uid
  RETURNING b.revisado_en INTO v_en;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La bitácora no existe, ya fue revisada o es tuya' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY SELECT v_en, v_nombre;
END;
$$;

REVOKE ALL     ON FUNCTION public.rechazar_bitacora(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rechazar_bitacora(UUID, TEXT) TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (solo lectura)
-- ============================================================================
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.bitacoras'::regclass AND contype = 'c';
-- SELECT proname FROM pg_proc WHERE proname IN ('aprobar_bitacora', 'rechazar_bitacora');

-- ============================================================================
-- ROLLBACK (las bitácoras rechazadas vuelven a 'pendiente' y se pierde el mensaje):
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.rechazar_bitacora(UUID, TEXT);
-- ALTER TABLE public.bitacoras DROP CONSTRAINT IF EXISTS bitacoras_rechazo_check;
-- ALTER TABLE public.bitacoras DROP CONSTRAINT IF EXISTS bitacoras_estado_check;
-- UPDATE public.bitacoras SET estado = 'pendiente', revisado_por = NULL,
--        revisado_por_nombre = NULL, revisado_en = NULL WHERE estado = 'rechazada';
-- ALTER TABLE public.bitacoras DROP COLUMN IF EXISTS motivo_rechazo;
-- ALTER TABLE public.bitacoras ADD CONSTRAINT bitacoras_estado_check
--   CHECK (estado IN ('pendiente', 'aprobada'));
-- COMMIT;
