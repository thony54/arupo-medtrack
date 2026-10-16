-- ============================================================================
-- schema_v28.sql — Registro permanente de aceptación de términos (audit trail)
-- ============================================================================
--
-- ⚠️  NO APLICADO. Se ejecuta A MANO en el SQL Editor de Supabase. No depende de
--     las migraciones anteriores. No toca datos existentes.
--
-- Qué guarda (una fila por usuario y versión de los términos):
--   user_id, fecha/hora (reloj de la base), IP, versión legal, navegador y una copia
--   del correo y el nombre del momento. Es respaldo institucional: por eso
--     · NO hay clave foránea al usuario: el registro sobrevive aunque se elimine
--       la cuenta;
--     · NO se puede editar ni borrar por la API (no hay políticas de escritura y se
--       revocan los permisos). Solo se inserta con la función aceptar_terminos().
--
-- La IP la toma el SERVIDOR de los encabezados de la petición que PostgREST expone
-- en `request.headers`; el navegador no puede falsearla. Se prefiere
-- `cf-connecting-ip` (la fija Cloudflare, que va delante de Supabase) y, si no
-- está, `x-real-ip` o el primer valor de `x-forwarded-for`.
--
-- Quién lo ve: cada usuario ve SU fila; el super_admin ve todas.
-- ============================================================================

BEGIN;

-- 1. Tabla ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.aceptaciones_terminos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL,
  email        TEXT,
  nombre       TEXT,
  version      TEXT        NOT NULL,
  aceptado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip           TEXT,
  user_agent   TEXT,
  CONSTRAINT aceptaciones_terminos_usuario_version_key UNIQUE (user_id, version)
);

CREATE INDEX IF NOT EXISTS aceptaciones_terminos_fecha_idx ON public.aceptaciones_terminos (aceptado_en DESC);

-- 2. ¿Es super_admin? (sin depender de otras migraciones) -----------------------------
CREATE OR REPLACE FUNCTION public.es_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT rol = 'super_admin' FROM public.perfiles WHERE id = auth.uid()), FALSE)
$$;

REVOKE ALL     ON FUNCTION public.es_super_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.es_super_admin() TO authenticated;

-- 3. RLS: solo lectura por la API ------------------------------------------------------
ALTER TABLE public.aceptaciones_terminos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aceptaciones_terminos_sel ON public.aceptaciones_terminos;
CREATE POLICY aceptaciones_terminos_sel ON public.aceptaciones_terminos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.es_super_admin());

REVOKE ALL ON public.aceptaciones_terminos FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.aceptaciones_terminos FROM authenticated;
GRANT  SELECT ON public.aceptaciones_terminos TO authenticated;

-- 4. Aceptar (única vía de escritura) ----------------------------------------------------
-- Idempotente: si ya aceptó esa versión, conserva la fila original y devuelve su fecha.
CREATE OR REPLACE FUNCTION public.aceptar_terminos(p_version TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_headers JSON;
  v_ip      TEXT;
  v_ua      TEXT;
  v_email   TEXT;
  v_nombre  TEXT;
  v_en      TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  IF p_version IS NULL OR p_version !~ '^[0-9A-Za-z._-]{1,40}$' THEN
    RAISE EXCEPTION 'Versión inválida' USING ERRCODE = '22023';
  END IF;

  -- Encabezados de la petición (NULL si no viene de PostgREST).
  BEGIN
    v_headers := current_setting('request.headers', TRUE)::JSON;
  EXCEPTION WHEN OTHERS THEN
    v_headers := NULL;
  END;

  v_ip := NULLIF(btrim(COALESCE(
            v_headers->>'cf-connecting-ip',
            v_headers->>'x-real-ip',
            split_part(COALESCE(v_headers->>'x-forwarded-for', ''), ',', 1)
          )), '');
  v_ua := LEFT(v_headers->>'user-agent', 300);

  SELECT email, COALESCE(NULLIF(btrim(nombre), ''), email) INTO v_email, v_nombre
    FROM public.perfiles WHERE id = v_uid;

  INSERT INTO public.aceptaciones_terminos (user_id, email, nombre, version, ip, user_agent)
  VALUES (v_uid, v_email, v_nombre, p_version, v_ip, v_ua)
  ON CONFLICT (user_id, version) DO NOTHING;

  SELECT aceptado_en INTO v_en
    FROM public.aceptaciones_terminos
   WHERE user_id = v_uid AND version = p_version;

  RETURN v_en;
END;
$$;

REVOKE ALL     ON FUNCTION public.aceptar_terminos(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.aceptar_terminos(TEXT) TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (solo lectura)
-- ============================================================================
-- SELECT to_regclass('public.aceptaciones_terminos');
-- SELECT proname FROM pg_proc WHERE proname IN ('aceptar_terminos', 'es_super_admin');
--
-- Después de que alguien acepte, comprueba qué IP quedó registrada:
-- SELECT email, version, aceptado_en, ip FROM public.aceptaciones_terminos ORDER BY aceptado_en DESC;
-- Si `ip` sale vacía, avísame: depende de los encabezados que Supabase reenvía.

-- ============================================================================
-- ROLLBACK (borra TODO el registro de aceptaciones):
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.aceptar_terminos(TEXT);
-- DROP FUNCTION IF EXISTS public.es_super_admin();
-- DROP TABLE IF EXISTS public.aceptaciones_terminos;
-- COMMIT;
