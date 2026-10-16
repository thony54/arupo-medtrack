-- ============================================================================
-- schema_v27.sql — Líderes de grupo y asignación de voluntarios
-- ============================================================================
--
-- ⚠️  NO APLICADO. Se ejecuta A MANO en el SQL Editor de Supabase, DESPUÉS de
--     schema_v22.sql … v26.sql.
--
-- Qué hace:
--   1. `perfiles.es_lider`: quién es líder de grupo (lo designa un super_admin o
--      un coordinador). `perfiles.lider_id`: el líder al que está asignado un
--      voluntario.
--   2. Para no cambiar nada de golpe, marca como líderes a quienes hoy ya pueden
--      figurar como "líder responsable": super_admin, brigadista y coordinadores.
--      A partir de ahora la lista de líderes de la bitácora son los `es_lider`.
--   3. Dos funciones permiten asignar SIN dar a los coordinadores permiso general
--      de escritura sobre `perfiles` (que sigue siendo solo de super_admin):
--        · asignar_lider(usuario, es_lider)
--        · asignar_voluntario_a_lider(voluntario, lider)
--      Ambas exigen super_admin o coordinador (`puede_revisar_bitacoras()`).
--   4. `registrar_bitacora` valida el líder con `es_lider` (única condición que
--      cambia respecto a schema_v26.sql).
--
-- Todo va en una transacción: si algo falla, se revierte completo.
-- ============================================================================

BEGIN;

-- 1. Columnas ----------------------------------------------------------------
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS es_lider BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lider_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.perfiles'::regclass AND conname = 'perfiles_lider_distinto_check'
  ) THEN
    ALTER TABLE public.perfiles
      ADD CONSTRAINT perfiles_lider_distinto_check CHECK (lider_id IS NULL OR lider_id <> id);
  END IF;
END $$;

-- 2. Líderes iniciales = quienes hoy pueden ser "líder responsable" -----------------
UPDATE public.perfiles
   SET es_lider = TRUE
 WHERE NOT es_lider
   AND (rol IN ('super_admin', 'brigadista') OR es_coordinador);

-- 3. Designar o quitar un líder ----------------------------------------------------
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

  UPDATE public.perfiles SET es_lider = p_es_lider WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario no existe' USING ERRCODE = 'P0002';
  END IF;

  -- Si deja de ser líder, sus voluntarios quedan sin asignar.
  IF NOT p_es_lider THEN
    UPDATE public.perfiles SET lider_id = NULL WHERE lider_id = p_user_id;
  END IF;
END;
$$;

-- 4. Asignar (o desasignar con NULL) un voluntario a un líder ----------------------------
CREATE OR REPLACE FUNCTION public.asignar_voluntario_a_lider(p_voluntario_id UUID, p_lider_id UUID)
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
    RAISE EXCEPTION 'No tienes permiso para asignar voluntarios' USING ERRCODE = '42501';
  END IF;

  IF p_lider_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.perfiles WHERE id = p_lider_id AND es_lider
     ) THEN
    RAISE EXCEPTION 'El líder elegido no es válido' USING ERRCODE = '22023';
  END IF;

  UPDATE public.perfiles
     SET lider_id = p_lider_id
   WHERE id = p_voluntario_id AND rol = 'voluntario';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El voluntario no existe' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL     ON FUNCTION public.asignar_lider(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.asignar_lider(UUID, BOOLEAN) TO authenticated;
REVOKE ALL     ON FUNCTION public.asignar_voluntario_a_lider(UUID, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.asignar_voluntario_a_lider(UUID, UUID) TO authenticated;

-- 5. registrar_bitacora: el líder debe ser un `es_lider` ---------------------------------
-- Igual que en schema_v26.sql; solo cambia la condición del líder.
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

  -- Líder responsable: alguien designado como líder de grupo.
  SELECT COALESCE(NULLIF(btrim(nombre), ''), email, 'Sin nombre') INTO v_lider_nombre
    FROM public.perfiles
   WHERE id = p_lider_id AND es_lider;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selecciona un líder responsable válido' USING ERRCODE = '22023';
  END IF;

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

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (solo lectura)
-- ============================================================================
-- SELECT email, rol, es_coordinador, es_lider FROM public.perfiles ORDER BY es_lider DESC, rol;
-- SELECT proname FROM pg_proc WHERE proname IN ('asignar_lider', 'asignar_voluntario_a_lider');

-- ============================================================================
-- ROLLBACK (pierde las designaciones y asignaciones; registrar_bitacora debe
-- volver a la versión de schema_v26.sql, que valida el líder por rol):
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.asignar_voluntario_a_lider(UUID, UUID);
-- DROP FUNCTION IF EXISTS public.asignar_lider(UUID, BOOLEAN);
-- ALTER TABLE public.perfiles DROP COLUMN IF EXISTS lider_id, DROP COLUMN IF EXISTS es_lider;
-- COMMIT;
-- -- y volver a ejecutar la definición de registrar_bitacora de schema_v26.sql.
