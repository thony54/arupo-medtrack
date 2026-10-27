-- ============================================================================
-- schema_v33.sql — Rol adicional "Coordinador de Brigadas Médicas" y brigadistas
--                  con Actividades, Tareas y Curso
-- ============================================================================
--
-- ⚠️  NO APLICADO. Se ejecuta A MANO en el SQL Editor de Supabase, DESPUÉS de
--     schema_v32.sql. No toca datos: las bitácoras, tareas y progreso que ya existen
--     conservan su contenido. No se pudo probar contra Postgres (no hay una base
--     local): léelo entero antes de ejecutarlo.
--
-- Qué hace:
--   1. `perfiles.es_coordinador_brigadas`: segundo rol ADICIONAL de coordinación (igual que
--      `es_coordinador`, no es un valor de `rol`). Monitorea y lidera al personal que entra
--      con el rol `brigadista`. SOLO lo puede otorgar el super admin principal: el trigger
--      de `perfiles` lo hace valer en la base (no basta con ocultar el botón en la app).
--   2. Los brigadistas pasan a poder cerrar jornada (`registrar_bitacora`), recibir tareas
--      y seguir el curso, igual que los voluntarios. Conservan todo lo que ya tenían.
--   3. Alcance por equipo. Hasta ahora quien coordinaba veía a TODOS. Ahora cada coordinación
--      ve a su gente:
--        · super_admin               → voluntarios y brigadistas
--        · es_coordinador            → solo voluntarios
--        · es_coordinador_brigadas   → solo brigadistas
--      Se aplica a bitácoras (y sus fotos), tareas, avance del curso, aprobar/rechazar,
--      asignar/retirar tareas y asignar líder. Lo hace `puede_gestionar_usuario(id)`.
--
-- `puede_revisar_bitacoras()` sigue existiendo y ahora significa "tiene algún rol de
-- coordinación" (super_admin, coordinador o coordinador de brigadas). Ya NO basta por sí sola
-- para ver datos de una persona: las políticas usan `puede_gestionar_usuario`.
--
-- Todo va en una transacción: si algo falla, se revierte completo.
-- ============================================================================

BEGIN;

-- 0. Comprobación previa ----------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.rol_actual()') IS NULL THEN
    RAISE EXCEPTION 'Falta public.rol_actual(): aplica schema_v21.sql antes que este script.';
  END IF;
  IF to_regclass('public.tareas_voluntario') IS NULL
     OR to_regclass('public.curso_progreso') IS NULL
     OR to_regprocedure('public.rechazar_bitacora(uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Faltan objetos de schema_v29, v30 o v32: aplícalos antes que este script.';
  END IF;
  -- Sin el trigger de v31 la columna nueva quedaría editable por cualquiera; sin v27 no hay líderes.
  IF to_regprocedure('public.perfiles_proteger_campos()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'perfiles_proteger_campos' AND NOT tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'perfiles' AND column_name = 'es_lider') THEN
    RAISE EXCEPTION 'Faltan schema_v27 o schema_v31 (trigger de perfiles): aplícalos antes que este script.';
  END IF;
END $$;

-- 1. Columna -----------------------------------------------------------------------
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS es_coordinador_brigadas BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.perfiles.es_coordinador_brigadas IS
  'Rol adicional: Coordinador de Brigadas Médicas. Monitorea y lidera a los brigadistas. Solo lo otorga el super admin principal.';

-- 2. Quién es el super admin principal ---------------------------------------------
-- Un solo lugar para el correo. Se lee del JWT de la petición, no de la tabla `perfiles`.
CREATE OR REPLACE FUNCTION public.es_super_admin_principal()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lower(COALESCE(auth.jwt() ->> 'email', '')) = 'thony.karter@gmail.com'
$$;

REVOKE ALL     ON FUNCTION public.es_super_admin_principal() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.es_super_admin_principal() TO authenticated;

-- 3. El trigger de `perfiles` protege también la columna nueva ----------------------
-- Igual que en schema_v31.sql + dos cambios:
--   · el nuevo rol solo lo cambia el super admin principal (antes de la excepción de super_admin);
--   · la lista de campos de poder incluye la columna nueva.
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

  IF NEW.es_coordinador_brigadas IS DISTINCT FROM OLD.es_coordinador_brigadas
     AND NOT public.es_super_admin_principal() THEN
    RAISE EXCEPTION 'Solo el super admin principal puede otorgar o quitar el rol de Coordinador de Brigadas Médicas'
      USING ERRCODE = '42501';
  END IF;

  IF public.rol_actual() = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.rol                   IS DISTINCT FROM OLD.rol
     OR NEW.email              IS DISTINCT FROM OLD.email
     OR NEW.es_coordinador     IS DISTINCT FROM OLD.es_coordinador
     OR NEW.es_lider           IS DISTINCT FROM OLD.es_lider
     OR NEW.lider_id           IS DISTINCT FROM OLD.lider_id
     OR NEW.tiempo_estancia_meses  IS DISTINCT FROM OLD.tiempo_estancia_meses
     OR NEW.fecha_inicio_estancia  IS DISTINCT FROM OLD.fecha_inicio_estancia
  THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar ese dato del perfil'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

-- 4. Alcance de cada coordinación --------------------------------------------------
-- ¿Tiene algún rol de coordinación? (puerta de entrada de las funciones de gestión)
CREATE OR REPLACE FUNCTION public.puede_revisar_bitacoras()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (rol = 'super_admin' OR es_coordinador OR es_coordinador_brigadas)
       FROM public.perfiles WHERE id = auth.uid()),
    FALSE
  )
$$;

-- ¿Puede quien llama gestionar a ESTA persona? super_admin: a todos. Coordinador: a los
-- voluntarios. Coordinador de brigadas: a los brigadistas. El rol que cuenta es el actual
-- de la persona.
CREATE OR REPLACE FUNCTION public.puede_gestionar_usuario(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT CASE
              WHEN me.rol = 'super_admin' THEN TRUE
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

-- 5. Políticas de lectura con alcance -----------------------------------------------
DROP POLICY IF EXISTS bitacoras_sel ON public.bitacoras;
CREATE POLICY bitacoras_sel ON public.bitacoras
  FOR SELECT TO authenticated
  USING (voluntario_id = auth.uid() OR public.puede_gestionar_usuario(voluntario_id));

DROP POLICY IF EXISTS tareas_voluntario_sel ON public.tareas_voluntario;
CREATE POLICY tareas_voluntario_sel ON public.tareas_voluntario
  FOR SELECT TO authenticated
  USING (voluntario_id = auth.uid() OR public.puede_gestionar_usuario(voluntario_id));

DROP POLICY IF EXISTS curso_progreso_sel ON public.curso_progreso;
CREATE POLICY curso_progreso_sel ON public.curso_progreso
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.puede_gestionar_usuario(user_id));

-- Fotos del bucket privado: la carpeta es el id de quien las subió. El CASE evita convertir
-- a UUID un nombre de carpeta que no lo es (eso lanzaría un error en vez de negar el acceso).
DROP POLICY IF EXISTS momentos_felices_sel ON storage.objects;
CREATE POLICY momentos_felices_sel ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'momentos-felices'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR public.puede_gestionar_usuario(
           CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (storage.foldername(name))[1]::UUID
           END
         )
    )
  );

-- 6. Cerrar jornada: también los brigadistas ----------------------------------------
-- Igual que en schema_v27.sql; solo cambia quién puede registrar.
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
  IF v_rol IS NULL OR v_rol NOT IN ('voluntario', 'brigadista') THEN
    RAISE EXCEPTION 'Solo los voluntarios y brigadistas pueden registrar una bitácora' USING ERRCODE = '42501';
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

-- 7. Aprobar y rechazar: solo a quien gestiona al autor ------------------------------
-- Igual que schema_v25.sql / schema_v32.sql; el UPDATE añade `puede_gestionar_usuario`.
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
     AND public.puede_gestionar_usuario(b.voluntario_id)
  RETURNING b.revisado_en INTO v_en;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La bitácora no existe, ya fue revisada, es tuya o no es de tu equipo' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY SELECT v_en, v_nombre;
END;
$$;

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
     AND public.puede_gestionar_usuario(b.voluntario_id)
  RETURNING b.revisado_en INTO v_en;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La bitácora no existe, ya fue revisada, es tuya o no es de tu equipo' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY SELECT v_en, v_nombre;
END;
$$;

-- 8. Tareas: se asignan a voluntarios y brigadistas, cada coordinación a los suyos ---------
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

  IF NOT EXISTS (
       SELECT 1 FROM public.perfiles WHERE id = p_voluntario_id AND rol IN ('voluntario', 'brigadista')
     ) THEN
    RAISE EXCEPTION 'La persona no existe' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.puede_gestionar_usuario(p_voluntario_id) THEN
    RAISE EXCEPTION 'Esa persona no es de tu equipo' USING ERRCODE = '42501';
  END IF;
  IF (SELECT COUNT(*) FROM public.tareas_voluntario
       WHERE voluntario_id = p_voluntario_id AND estado = 'pendiente') >= 50 THEN
    RAISE EXCEPTION 'Esta persona ya tiene 50 tareas pendientes' USING ERRCODE = '54000';
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
     AND (voluntario_id = v_uid OR public.puede_gestionar_usuario(voluntario_id));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La tarea no existe o no tienes permiso' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

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

  DELETE FROM public.tareas_voluntario
   WHERE id = p_id AND public.puede_gestionar_usuario(voluntario_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La tarea no existe o no es de tu equipo' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- 9. Avance del curso: solo el de tu equipo -----------------------------------------------
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
  SELECT g.uid, g.n
    FROM (
      SELECT cp.user_id AS uid, COUNT(*)::INTEGER AS n
        FROM public.curso_progreso cp
       GROUP BY cp.user_id
    ) g
   WHERE public.puede_gestionar_usuario(g.uid);
END;
$$;

-- 10. Líderes: designar a cualquiera; asignar y quitar solo dentro de tu equipo ----------
-- La lista de líderes (`es_lider`) es una sola y la comparten ambos equipos: un líder puede
-- tener gente de los dos. Por eso una coordinación NO puede quitar a un líder que tiene
-- asignadas personas de otro equipo (les dejaría el líder en blanco sin que su coordinación
-- se entere): debe hacerlo el super_admin o pedirlo a la otra coordinación.
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

  IF NOT p_es_lider AND public.rol_actual() <> 'super_admin' AND EXISTS (
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
    RAISE EXCEPTION 'No tienes permiso para asignar personas a un líder' USING ERRCODE = '42501';
  END IF;

  IF p_lider_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.perfiles WHERE id = p_lider_id AND es_lider
     ) THEN
    RAISE EXCEPTION 'El líder elegido no es válido' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
       SELECT 1 FROM public.perfiles WHERE id = p_voluntario_id AND rol IN ('voluntario', 'brigadista')
     ) THEN
    RAISE EXCEPTION 'La persona no existe' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.puede_gestionar_usuario(p_voluntario_id) THEN
    RAISE EXCEPTION 'Esa persona no es de tu equipo' USING ERRCODE = '42501';
  END IF;

  UPDATE public.perfiles SET lider_id = p_lider_id WHERE id = p_voluntario_id;
END;
$$;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (solo lectura). Después de aplicar:
-- ============================================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'perfiles' AND column_name = 'es_coordinador_brigadas';
--
-- SELECT proname FROM pg_proc WHERE proname IN
--   ('es_super_admin_principal', 'puede_gestionar_usuario', 'puede_revisar_bitacoras');
--
-- -- Las 4 políticas con alcance deben mencionar puede_gestionar_usuario:
-- SELECT tablename, policyname, qual FROM pg_policies
--  WHERE policyname IN ('bitacoras_sel', 'tareas_voluntario_sel', 'curso_progreso_sel', 'momentos_felices_sel');
--
-- Pruebas con sesión, una por rol (tras aplicar):
--   · super_admin principal: /usuarios → "Gestionar roles" → marcar Coordinador de Brigadas Médicas.
--   · otro super_admin (p. ej. Milton): intentar lo mismo debe fallar ("Solo el super admin principal...").
--   · brigadista: menú con Mis Actividades, Tareas y Curso; cierra una jornada de prueba.
--   · coordinador de brigadas: /bitacoras, /equipos y /asignar-tareas muestran SOLO brigadistas;
--     un voluntario no aparece ni sus bitácoras se leen.
--   · coordinador de voluntariado: sigue viendo solo voluntarios (no las bitácoras de brigadistas).

-- ============================================================================
-- ROLLBACK (quita el rol nuevo y devuelve las funciones a su versión anterior; las
-- bitácoras y tareas de brigadistas ya creadas se conservan pero quedan solo a la vista
-- de super_admin y de su dueño). Hay que volver a ejecutar, en este orden, las definiciones de
-- schema_v24.sql (puede_revisar_bitacoras, bitacoras_sel, momentos_felices_sel),
-- schema_v27.sql (registrar_bitacora, asignar_lider, asignar_voluntario_a_lider),
-- schema_v25.sql (aprobar_bitacora), schema_v32.sql (rechazar_bitacora),
-- schema_v30.sql (tareas_voluntario_sel, asignar_tarea, completar_tarea, retirar_tarea),
-- schema_v29.sql (curso_progreso_sel, curso_resumen) y schema_v31.sql (perfiles_proteger_campos).
-- Después:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.puede_gestionar_usuario(UUID);
-- DROP FUNCTION IF EXISTS public.es_super_admin_principal();
-- ALTER TABLE public.perfiles DROP COLUMN IF EXISTS es_coordinador_brigadas;
-- COMMIT;
