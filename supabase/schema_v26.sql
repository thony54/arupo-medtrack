-- ============================================================================
-- schema_v26.sql — Bitácora con 1 a 3 fotos y aviso a Discord sin duplicados
-- ============================================================================
--
-- ⚠️  NO APLICADO. Se ejecuta A MANO en el SQL Editor de Supabase, DESPUÉS de
--     schema_v24.sql y schema_v25.sql.
--
-- Qué cambia:
--   1. `bitacoras.foto_path` (1 foto, opcional) pasa a `bitacoras.fotos` (TEXT[],
--      de 1 a 3). Las fotos que ya existen se copian al arreglo antes de borrar
--      la columna vieja. Las bitácoras anteriores pueden quedar con 0 fotos; solo
--      las NUEVAS exigen al menos 1.
--   2. `registrar_bitacora` pasa a recibir `p_fotos TEXT[]` (mín. 1, máx. 3).
--      Se elimina la versión anterior (con `p_foto_path TEXT`).
--   3. Aviso a Discord: `notificada_en` registra cuándo se avisó. Dos funciones
--      permiten que el endpoint /api/notify-bitacora (que actúa con la sesión
--      del voluntario) lea SU bitácora y la marque como avisada UNA sola vez.
--      Así nadie puede reenviar avisos repetidos.
--   4. Las bitácoras que ya existen se marcan como avisadas: no se envían a
--      Discord retroactivamente.
--
-- Todo va en una transacción: si algo falla, se revierte completo.
-- ============================================================================

BEGIN;

-- 1. Fotos: de una a varias ---------------------------------------------------
ALTER TABLE public.bitacoras
  ADD COLUMN IF NOT EXISTS fotos         TEXT[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notificada_en TIMESTAMPTZ;

-- Copia la foto única existente al arreglo (solo si la columna vieja sigue ahí).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'bitacoras' AND column_name = 'foto_path'
  ) THEN
    UPDATE public.bitacoras
       SET fotos = ARRAY[foto_path]
     WHERE foto_path IS NOT NULL AND cardinality(fotos) = 0;
    ALTER TABLE public.bitacoras DROP COLUMN foto_path;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.bitacoras'::regclass AND conname = 'bitacoras_fotos_max_check'
  ) THEN
    ALTER TABLE public.bitacoras
      ADD CONSTRAINT bitacoras_fotos_max_check CHECK (cardinality(fotos) <= 3);
  END IF;
END $$;

-- Lo que ya existe no se reenvía a Discord.
UPDATE public.bitacoras SET notificada_en = created_at WHERE notificada_en IS NULL;

-- 2. registrar_bitacora con 1 a 3 fotos --------------------------------------------
DROP FUNCTION IF EXISTS public.registrar_bitacora(TIMESTAMPTZ, JSONB, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.registrar_bitacora(
  p_abierta_en  TIMESTAMPTZ,
  p_actividades JSONB,
  p_lider_id    UUID,
  p_fotos       TEXT[],
  p_formacion   TEXT
)
RETURNS TABLE (bitacora_id UUID, creada_en TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_rol          TEXT;
  v_act          JSONB;
  v_actividades  JSONB;
  v_lider_nombre TEXT;
  v_formacion    TEXT;
  v_foto         TEXT;
  v_id           UUID;
  v_creada       TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT rol INTO v_rol FROM public.perfiles WHERE id = v_uid;
  IF v_rol IS DISTINCT FROM 'voluntario' THEN
    RAISE EXCEPTION 'Solo los voluntarios pueden registrar una bitácora' USING ERRCODE = '42501';
  END IF;

  -- Actividades: de 1 a 20, cada una con descripción y horas HH:MM válidas.
  IF p_actividades IS NULL
     OR jsonb_typeof(p_actividades) <> 'array'
     OR jsonb_array_length(p_actividades) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Registra entre 1 y 20 actividades' USING ERRCODE = '22023';
  END IF;

  FOR v_act IN SELECT value FROM jsonb_array_elements(p_actividades) LOOP
    IF jsonb_typeof(v_act) <> 'object'
       OR btrim(COALESCE(v_act->>'descripcion', '')) = ''
       OR char_length(v_act->>'descripcion') > 300
       OR char_length(COALESCE(v_act->>'lugar', '')) > 200
       OR COALESCE(v_act->>'hora_inicio', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       OR COALESCE(v_act->>'hora_fin', '')    !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       OR (v_act->>'hora_fin') <= (v_act->>'hora_inicio') THEN
      RAISE EXCEPTION 'Actividad inválida: revisa descripción y horario' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  SELECT jsonb_agg(
           jsonb_build_object(
             'descripcion', btrim(t.elem->>'descripcion'),
             'hora_inicio', t.elem->>'hora_inicio',
             'hora_fin',    t.elem->>'hora_fin',
             'lugar',       btrim(COALESCE(t.elem->>'lugar', ''))
           ) ORDER BY t.ord
         )
    INTO v_actividades
    FROM jsonb_array_elements(p_actividades) WITH ORDINALITY AS t(elem, ord);

  -- Líder responsable: un superior (super_admin, brigadista o coordinador).
  SELECT COALESCE(NULLIF(btrim(nombre), ''), email, 'Sin nombre') INTO v_lider_nombre
    FROM public.perfiles
   WHERE id = p_lider_id
     AND (rol IN ('super_admin', 'brigadista') OR es_coordinador);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selecciona un líder responsable válido' USING ERRCODE = '22023';
  END IF;

  -- Fotos: de 1 a 3, sin repetidas, en la carpeta del propio usuario y existentes.
  IF p_fotos IS NULL OR cardinality(p_fotos) NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'Adjunta entre 1 y 3 fotos' USING ERRCODE = '22023';
  END IF;
  IF cardinality(p_fotos) <> (SELECT COUNT(DISTINCT f) FROM unnest(p_fotos) AS f) THEN
    RAISE EXCEPTION 'Hay fotos repetidas' USING ERRCODE = '22023';
  END IF;
  FOREACH v_foto IN ARRAY p_fotos LOOP
    IF v_foto IS NULL
       OR v_foto NOT LIKE v_uid::TEXT || '/%'
       OR v_foto LIKE '%..%'
       OR char_length(v_foto) > 200
       OR NOT EXISTS (
            SELECT 1 FROM storage.objects
             WHERE bucket_id = 'momentos-felices' AND name = v_foto
          ) THEN
      RAISE EXCEPTION 'Una de las fotos no es válida' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  v_formacion := NULLIF(btrim(COALESCE(p_formacion, '')), '');
  IF v_formacion IS NOT NULL AND char_length(v_formacion) > 1000 THEN
    RAISE EXCEPTION 'La formación continua admite hasta 1000 caracteres' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.bitacoras
    (voluntario_id, abierta_en, actividades, lider_id, lider_nombre, fotos, formacion_continua)
  VALUES
    (v_uid, CASE WHEN p_abierta_en IS NULL THEN NULL ELSE LEAST(p_abierta_en, NOW()) END,
     v_actividades, p_lider_id, v_lider_nombre, p_fotos, v_formacion)
  RETURNING id, created_at INTO v_id, v_creada;

  RETURN QUERY SELECT v_id, v_creada;
END;
$$;

REVOKE ALL     ON FUNCTION public.registrar_bitacora(TIMESTAMPTZ, JSONB, UUID, TEXT[], TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registrar_bitacora(TIMESTAMPTZ, JSONB, UUID, TEXT[], TEXT) TO authenticated;

-- 3. Aviso a Discord: leer y marcar, una sola vez --------------------------------------
-- Devuelve la bitácora (con el nombre del voluntario) SOLO si es del usuario que
-- llama, aún no se avisó y tiene menos de 3 días. Si no, devuelve NULL.
CREATE OR REPLACE FUNCTION public.obtener_bitacora_a_notificar(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT to_jsonb(b) || jsonb_build_object(
           'voluntario_nombre', COALESCE(NULLIF(btrim(p.nombre), ''), p.email, 'Voluntario'),
           'voluntario_rol',    p.rol
         )
    INTO v_row
    FROM public.bitacoras b
    JOIN public.perfiles p ON p.id = b.voluntario_id
   WHERE b.id = p_id
     AND b.voluntario_id = v_uid
     AND b.notificada_en IS NULL
     AND b.created_at > NOW() - INTERVAL '3 days';

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_bitacora_notificada(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  UPDATE public.bitacoras
     SET notificada_en = NOW()
   WHERE id = p_id
     AND voluntario_id = auth.uid()
     AND notificada_en IS NULL;
END;
$$;

REVOKE ALL     ON FUNCTION public.obtener_bitacora_a_notificar(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.obtener_bitacora_a_notificar(UUID) TO authenticated;
REVOKE ALL     ON FUNCTION public.marcar_bitacora_notificada(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.marcar_bitacora_notificada(UUID) TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (solo lectura)
-- ============================================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'bitacoras'
--    AND column_name IN ('fotos', 'notificada_en', 'foto_path');   -- foto_path NO debe aparecer
-- SELECT proname, pg_get_function_identity_arguments(oid) FROM pg_proc
--  WHERE proname IN ('registrar_bitacora', 'obtener_bitacora_a_notificar', 'marcar_bitacora_notificada');

-- ============================================================================
-- ROLLBACK (las bitácoras con 2 o 3 fotos perderían las extra al volver a 1 foto):
-- ============================================================================
-- Es una migración de forma de datos: para revertirla hay que restaurar
-- `foto_path` desde `fotos[1]` y volver a crear registrar_bitacora de schema_v24.sql.
