-- ============================================================================
-- schema_v24.sql — Bitácora de cierre de jornada del voluntario
-- ============================================================================
--
-- ⚠️  NO APLICADO. Se ejecuta A MANO en el SQL Editor de Supabase, después de
--     schema_v22.sql (columna es_coordinador) y de probar la rama
--     feat/coordinador-voluntariado. Solo CREA objetos nuevos (tabla, funciones,
--     bucket de fotos y sus políticas); no modifica datos ni tablas existentes
--     más allá de asegurar la columna es_coordinador.
--
-- Qué crea:
--   1. Tabla `bitacoras`: una fila por jornada cerrada. Las actividades (1 a 20)
--      van en un JSONB: [{descripcion, hora_inicio, hora_fin, lugar}].
--   2. Función `registrar_bitacora(...)`: ÚNICA vía de escritura. Valida todo en
--      el servidor y fija la fecha/hora con el reloj de la base, para que el
--      registro sea inmutable: nadie puede falsear la hora ni el estado.
--   3. Función `puede_revisar_bitacoras()`: super_admin o coordinador.
--   4. Bucket PRIVADO `momentos-felices` para la foto del día, con políticas.
--
-- Quién ve qué:
--   · El voluntario ve SUS bitácoras y sus fotos.
--   · super_admin y coordinadores ven todas (la aprobación llega en la Parte 4).
--   · Nadie puede insertar, editar ni borrar por la API: no hay políticas de
--     escritura y además se revocan los permisos. Si hay que corregir un dato,
--     se hace desde el SQL Editor (service role).
--
-- Fotos: pueden mostrar a beneficiarios (incluso menores), por eso el bucket es
-- privado y se sirven con URL firmada temporal, nunca públicas.
-- ============================================================================

BEGIN;

-- 0. Garantiza la columna usada por las políticas (idempotente: ya la crea v22).
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS es_coordinador BOOLEAN NOT NULL DEFAULT FALSE;

-- 1. Tabla --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bitacoras (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  voluntario_id      UUID        NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  -- Reloj del dispositivo al abrir el formulario (informativo, no confiable).
  abierta_en         TIMESTAMPTZ,
  -- Reloj de la base al enviar: es el timestamp oficial e inmutable.
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actividades        JSONB       NOT NULL,
  lider_id           UUID        REFERENCES public.perfiles(id) ON DELETE SET NULL,
  -- Copia del nombre: el historial no cambia si luego se renombra o elimina al líder.
  lider_nombre       TEXT        NOT NULL,
  foto_path          TEXT,
  formacion_continua TEXT,
  estado             TEXT        NOT NULL DEFAULT 'pendiente'
                                 CHECK (estado IN ('pendiente', 'aprobada')),
  CONSTRAINT bitacoras_actividades_check
    CHECK (jsonb_typeof(actividades) = 'array' AND jsonb_array_length(actividades) BETWEEN 1 AND 20)
);

CREATE INDEX IF NOT EXISTS bitacoras_voluntario_fecha_idx ON public.bitacoras (voluntario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bitacoras_fecha_idx            ON public.bitacoras (created_at DESC);

-- 2. Quién puede revisar (super_admin o coordinador) -------------------------
CREATE OR REPLACE FUNCTION public.puede_revisar_bitacoras()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (rol = 'super_admin' OR es_coordinador) FROM public.perfiles WHERE id = auth.uid()),
    FALSE
  )
$$;

REVOKE ALL     ON FUNCTION public.puede_revisar_bitacoras() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.puede_revisar_bitacoras() TO authenticated;

-- 3. RLS: solo lectura por la API ------------------------------------------------
ALTER TABLE public.bitacoras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bitacoras_sel ON public.bitacoras;
CREATE POLICY bitacoras_sel ON public.bitacoras
  FOR SELECT TO authenticated
  USING (voluntario_id = auth.uid() OR public.puede_revisar_bitacoras());

REVOKE ALL ON public.bitacoras FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.bitacoras FROM authenticated;
GRANT  SELECT ON public.bitacoras TO authenticated;

-- 4. Registro de una bitácora (única vía de escritura) ---------------------------
CREATE OR REPLACE FUNCTION public.registrar_bitacora(
  p_abierta_en  TIMESTAMPTZ,
  p_actividades JSONB,
  p_lider_id    UUID,
  p_foto_path   TEXT,
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

  -- Solo los voluntarios cierran jornada.
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

  -- Se guarda solo lo conocido y recortado (descarta claves inesperadas).
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

  -- Foto (opcional): debe estar en la carpeta del propio usuario y existir.
  v_foto := NULLIF(btrim(COALESCE(p_foto_path, '')), '');
  IF v_foto IS NOT NULL THEN
    IF v_foto NOT LIKE v_uid::TEXT || '/%'
       OR v_foto LIKE '%..%'
       OR char_length(v_foto) > 200
       OR NOT EXISTS (
            SELECT 1 FROM storage.objects
             WHERE bucket_id = 'momentos-felices' AND name = v_foto
          ) THEN
      RAISE EXCEPTION 'La foto no es válida' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_formacion := NULLIF(btrim(COALESCE(p_formacion, '')), '');
  IF v_formacion IS NOT NULL AND char_length(v_formacion) > 1000 THEN
    RAISE EXCEPTION 'La formación continua admite hasta 1000 caracteres' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.bitacoras
    (voluntario_id, abierta_en, actividades, lider_id, lider_nombre, foto_path, formacion_continua)
  VALUES
    (v_uid, CASE WHEN p_abierta_en IS NULL THEN NULL ELSE LEAST(p_abierta_en, NOW()) END, v_actividades, p_lider_id, v_lider_nombre, v_foto, v_formacion)
  RETURNING id, created_at INTO v_id, v_creada;

  RETURN QUERY SELECT v_id, v_creada;
END;
$$;

REVOKE ALL     ON FUNCTION public.registrar_bitacora(TIMESTAMPTZ, JSONB, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registrar_bitacora(TIMESTAMPTZ, JSONB, UUID, TEXT, TEXT) TO authenticated;

-- 5. Bucket privado para el "Momento Feliz" -----------------------------------------
-- Máx. 5 MB por imagen. La app comprime a ~1280 px antes de subir.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('momentos-felices', 'momentos-felices', FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Subir: solo a la carpeta propia (<uid>/archivo). Sin UPDATE ni DELETE: una foto
-- ya enviada no se puede reemplazar ni borrar desde la app.
DROP POLICY IF EXISTS momentos_felices_ins ON storage.objects;
CREATE POLICY momentos_felices_ins ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'momentos-felices'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Ver: el dueño, o quien revisa bitácoras.
DROP POLICY IF EXISTS momentos_felices_sel ON storage.objects;
CREATE POLICY momentos_felices_sel ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'momentos-felices'
    AND ((storage.foldername(name))[1] = auth.uid()::TEXT OR public.puede_revisar_bitacoras())
  );

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (solo lectura)
-- ============================================================================
-- SELECT to_regclass('public.bitacoras');
-- SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'momentos-felices';
-- SELECT policyname, cmd FROM pg_policies
--  WHERE (schemaname = 'public' AND tablename = 'bitacoras')
--     OR (schemaname = 'storage' AND policyname LIKE 'momentos_felices%');

-- ============================================================================
-- ROLLBACK (borra TODAS las bitácoras ya registradas; las fotos del bucket hay
-- que vaciarlas aparte desde Storage antes de poder borrar el bucket):
-- ============================================================================
-- BEGIN;
-- DROP POLICY IF EXISTS momentos_felices_ins ON storage.objects;
-- DROP POLICY IF EXISTS momentos_felices_sel ON storage.objects;
-- DROP FUNCTION IF EXISTS public.registrar_bitacora(TIMESTAMPTZ, JSONB, UUID, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS public.puede_revisar_bitacoras();
-- DROP TABLE IF EXISTS public.bitacoras;
-- COMMIT;
