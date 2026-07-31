-- ============================================================
-- Arupo MedTrack — Schema v17: Cierre de acceso anónimo y RLS por rol
--
-- ⚠️  NO EJECUTADO. Revisa antes de aplicar en el SQL Editor de Supabase.
-- ⚠️  La app está EN PRODUCCIÓN con datos reales.
--
-- Motivo (verificado el 2026-07-23 con sondas de solo lectura):
-- sin ninguna sesión, usando solo la anon key que viaja en el bundle
-- público, se leían:
--   beneficiarios 7 · perfiles 12 · lotes 589 · medicinas 593
--   movimientos 597 · categorias 86 · alertas_vencimiento 65
--   historial_beneficiarios 14
-- Denegaban correctamente: donantes, entregas, evaluaciones_salud,
-- historial_donantes.
--
-- El script va en DOS PARTES deliberadamente separadas.
-- Aplica la PARTE 1 primero: cierra la fuga y no cambia nada para los
-- usuarios que ya han iniciado sesión. La PARTE 2 introduce separación
-- por rol y SÍ puede romper pantallas — pruébala aparte.
-- ============================================================


-- ============================================================
-- PARTE 1 — URGENTE: cortar el acceso anónimo
--
-- Riesgo de rotura: BAJO. Mantiene el comportamiento actual para
-- cualquier usuario autenticado (USING true) y solo expulsa al rol
-- `anon`. Nadie que hoy pueda entrar perderá acceso.
-- ============================================================

-- 1.1 · Activar RLS en todas las tablas del esquema public.
-- Si RLS está desactivada, el GRANT por defecto de Supabase a `anon`
-- basta para leerlo todo: por eso hay tablas abiertas pese a que el
-- repo declara políticas. ENABLE es idempotente.

ALTER TABLE public.beneficiarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicinas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donantes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluaciones_salud ENABLE ROW LEVEL SECURITY;


-- 1.2 · Quitar a `anon` los permisos de tabla.
-- RLS filtra filas, pero el GRANT es la puerta anterior. Sin esto, una
-- política futura mal escrita volvería a abrir la puerta al público.
-- `authenticated` conserva todo: la app sigue funcionando igual.

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Que las tablas futuras no nazcan abiertas a anon:
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;


-- 1.3 · Las VISTAS son una puerta trasera aparte.
-- Por defecto una vista se ejecuta con los privilegios de su creador e
-- IGNORA la RLS de las tablas que consulta. Sin esto, cerrar
-- `beneficiarios` no cerraría `historial_beneficiarios`, que expone lo
-- mismo cruzado con lo que recibió cada persona.
-- security_invoker requiere PostgreSQL 15+ (Supabase actual lo cumple).

ALTER VIEW public.alertas_vencimiento     SET (security_invoker = on);
ALTER VIEW public.historial_beneficiarios SET (security_invoker = on);
ALTER VIEW public.historial_donantes      SET (security_invoker = on);

REVOKE ALL ON public.alertas_vencimiento     FROM anon;
REVOKE ALL ON public.historial_beneficiarios FROM anon;
REVOKE ALL ON public.historial_donantes      FROM anon;


-- 1.4 · Políticas base: acceso solo para autenticados.
-- Replica el comportamiento de hoy (cualquiera con sesión ve todo),
-- pero deja fuera a `anon`. La separación por rol llega en la PARTE 2.
-- Se eliminan primero las políticas permisivas conocidas del repo.

DROP POLICY IF EXISTS "lotes_authenticated"         ON public.lotes;
DROP POLICY IF EXISTS "donantes_authenticated"      ON public.donantes;
DROP POLICY IF EXISTS "beneficiarios_authenticated" ON public.beneficiarios;
DROP POLICY IF EXISTS "entregas_authenticated"      ON public.entregas;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'beneficiarios','lotes','medicinas','movimientos',
    'categorias','donantes','entregas'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING (true) WITH CHECK (true)', t || '_auth_all', t);
  END LOOP;
END $$;

-- `perfiles` mantiene su forma actual: lectura para autenticados
-- (AuthContext necesita leer el perfil propio al arrancar), escritura
-- reservada a super_admin. Se usa la función de 2.1 para no consultar
-- `perfiles` dentro de una política sobre `perfiles` (recursión).

-- `evaluaciones_salud` NO se toca: sus políticas ya son correctas
-- (super_admin ve todo, brigadista solo lo suyo, sin UPDATE ni DELETE).


-- ============================================================
-- VERIFICACIÓN DE LA PARTE 1
-- Ejecuta esto después de aplicar. Ninguna fila debe salir.
-- ============================================================

-- (a) Tablas sin RLS activa:
--   SELECT relname FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

-- (b) Políticas que alcanzan a anon o public
--     (ojo: en Postgres `public` significa TODOS los roles, no
--      "usuarios registrados" — es el error más habitual):
--   SELECT tablename, policyname, roles, cmd FROM pg_policies
--   WHERE schemaname = 'public'
--     AND (roles::text[] && ARRAY['anon','public']);

-- (c) Privilegios que le queden a anon:
--   SELECT table_name, privilege_type FROM information_schema.role_table_grants
--   WHERE grantee = 'anon' AND table_schema = 'public';

-- (d) Prueba externa, desde tu terminal. Debe devolver `*/0` en todas.
--     Sustituye <URL> y <ANON_KEY> por los de tu proyecto:
--   curl -s -o /dev/null -D - -H "apikey: <ANON_KEY>" \
--     -H "Prefer: count=exact" -H "Range: 0-0" \
--     "<URL>/rest/v1/beneficiarios?select=id" | grep -i content-range


-- ============================================================
-- PARTE 2 — Separación por rol
--
-- ⚠️  Riesgo de rotura: MEDIO. Pruébala con un usuario de CADA rol
--     antes de darla por buena. Una política mal ajustada no lanza
--     error: PostgREST devuelve [] y la pantalla sale vacía.
--
-- Decisión de diseño importante: se restringe la ESCRITURA por rol,
-- pero la LECTURA se mantiene abierta a cualquier autenticado. Motivo:
-- el Dashboard es accesible a los tres roles y consulta beneficiarios,
-- donantes, medicinas, categorias, movimientos y alertas_vencimiento.
-- Restringir la lectura según la tabla de rutas de App.jsx dejaría el
-- Dashboard del brigadista en blanco. Cerrar también la lectura exige
-- antes mover esos conteos a una función agregada — ver nota final.
-- ============================================================

-- 2.1 · Rol del usuario actual, sin recursión de RLS.
-- SECURITY DEFINER evita que consultar `perfiles` dispare las políticas
-- de `perfiles`. search_path fijo para que no se pueda secuestrar la
-- resolución de nombres.

CREATE OR REPLACE FUNCTION public.rol_actual()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT rol FROM public.perfiles WHERE id = auth.uid() $$;

REVOKE ALL     ON FUNCTION public.rol_actual() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rol_actual() TO authenticated;


-- 2.2 · Escritura por dominio, alineada con App.jsx.
--   Inventario  (medicinas, categorias, lotes, movimientos, entregas)
--               → super_admin, brigadista
--   Comunidad   (beneficiarios, donantes)
--               → super_admin, voluntario
--   DELETE      → super_admin en todos los casos.
--
-- Lectura: cualquier autenticado (ver nota de diseño arriba).

DO $$
DECLARE
  t TEXT;
  escritores TEXT[];
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'beneficiarios','lotes','medicinas','movimientos',
    'categorias','donantes','entregas'
  ] LOOP
    escritores := CASE
      WHEN t IN ('beneficiarios','donantes')
        THEN ARRAY['super_admin','voluntario']
      ELSE ARRAY['super_admin','brigadista']
    END;

    -- Retirar la política amplia de la PARTE 1
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_all', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_sel', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated '
      'WITH CHECK (public.rol_actual() = ANY (%L))',
      t || '_ins', t, escritores);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated '
      'USING (public.rol_actual() = ANY (%L)) '
      'WITH CHECK (public.rol_actual() = ANY (%L))',
      t || '_upd', t, escritores, escritores);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated '
      'USING (public.rol_actual() = ''super_admin'')',
      t || '_del', t);
  END LOOP;
END $$;


-- 2.3 · perfiles: lectura para autenticados, escritura solo super_admin.
-- Sustituye la política del repo, que consultaba `perfiles` dentro de su
-- propio USING y podía provocar "infinite recursion detected in policy".

DROP POLICY IF EXISTS "Lectura de perfiles autenticados" ON public.perfiles;
DROP POLICY IF EXISTS "Super admins editan perfiles"     ON public.perfiles;

CREATE POLICY "perfiles_sel" ON public.perfiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "perfiles_ins" ON public.perfiles
  FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() = 'super_admin');

CREATE POLICY "perfiles_upd" ON public.perfiles
  FOR UPDATE TO authenticated
  USING      (public.rol_actual() = 'super_admin')
  WITH CHECK (public.rol_actual() = 'super_admin');

CREATE POLICY "perfiles_del" ON public.perfiles
  FOR DELETE TO authenticated
  USING (public.rol_actual() = 'super_admin');

-- Nota: el trigger handle_new_user inserta en `perfiles` durante el
-- signUp, cuando aún no hay perfil y rol_actual() devuelve NULL. Sigue
-- funcionando porque es SECURITY DEFINER y no está sujeto a RLS.


-- ============================================================
-- PENDIENTE, fuera del alcance de este script
--
-- 1. El rol se sigue eligiendo desde el cliente. handle_new_user hace
--    COALESCE(NEW.raw_user_meta_data->>'rol', 'brigadista') y esa
--    metadata la controla quien llama. Con el registro público abierto
--    (disable_signup=false, mailer_autoconfirm=true, verificado) eso
--    permite auto-registrarse como super_admin. Cerrarlo requiere
--    tocar el trigger, y desactivar el alta pública en
--    Authentication → Providers → Email. Ningún SQL de aquí lo arregla.
--
-- 2. crear_usuario_completo (schema_v4.sql) tiene un bypass: si la
--    tabla perfiles quedara vacía, cualquiera podría crear el primer
--    super_admin. La UI ya no la usa → conviene DROP FUNCTION.
--
-- 3. Lectura de beneficiarios: sigue abierta a los tres roles porque el
--    Dashboard la necesita. Para cerrarla, mover los conteos del
--    Dashboard a una función agregada (SECURITY DEFINER que devuelva
--    solo totales) y luego restringir el SELECT a super_admin y
--    voluntario.
-- ============================================================
