-- ============================================================================
-- schema_v21.sql — Blindaje de autorización (RLS por rol + registro seguro)
-- ============================================================================
--
-- ⚠️  NO APLICADO. Es una migración PREPARADA, no ejecutada. La app está en
--     producción con datos reales. Antes de correr esto:
--       1. Pruébalo en un proyecto de STAGING (o en una ventana de baja actividad).
--       2. Verifica CADA pantalla con un usuario de cada rol
--          (super_admin, brigadista, voluntario). Una política mal escrita deja
--          la pantalla en blanco SIN error (Supabase devuelve un array vacío).
--       3. Ten a mano la sección "ROLLBACK" del final por si algo se rompe.
--
-- Qué cierra (ver análisis local en SECURITY.local.md):
--   §2.1  El rol ya NO se acepta desde el cliente al registrarse.
--   §2.2  Las políticas RLS pasan a distinguir por rol, alineadas con la tabla
--         de rutas de CLAUDE.md.
--
-- Convención del repo: los schema_v*.sql se ejecutan A MANO en el SQL Editor de
-- Supabase, en orden. Este es el siguiente número; no reescribe ninguno previo.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Función auxiliar: rol del usuario actual, sin disparar RLS recursiva.
--    SECURITY DEFINER + search_path fijo. Se usa en todas las políticas para no
--    consultar `perfiles` recursivamente dentro de sus propias políticas.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rol_actual()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM public.perfiles WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.rol_actual() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rol_actual() TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. §2.1 — El registro NUNCA fija el rol desde el cliente.
--    El trigger deja de leer raw_user_meta_data->>'rol'. Todo usuario nuevo nace
--    con el rol de MENOR privilegio; un super_admin lo promueve luego desde
--    /usuarios (UPDATE sobre perfiles, restringido a super_admin más abajo).
--
--    NOTA: ajusta el nombre de las columnas si tu tabla `perfiles` difiere.
--    Confírmalo en el panel antes de aplicar (las tablas medicinas/categorias y
--    algunas columnas se crearon fuera de los schema_v*.sql versionados).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, email, nombre, rol)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    'voluntario'                       -- <- rol de menor privilegio, SIEMPRE.
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- (El trigger sobre auth.users que llama a handle_new_user ya existe; no se
--  recrea aquí. Si necesitas recrearlo, hazlo con el mismo nombre que tengas.)

-- ----------------------------------------------------------------------------
-- 3. §2.2 — Políticas RLS por rol.
--    Mapa (CLAUDE.md):
--      beneficiarios, donantes           -> super_admin, voluntario
--      lotes, entregas, medicinas, cat.  -> super_admin, brigadista
--      evaluaciones_salud                -> ya está bien (no se toca)
--    DELETE se reserva a super_admin en las tablas con datos personales.
-- ----------------------------------------------------------------------------

-- Asegura RLS activa en todas las tablas sensibles.
ALTER TABLE public.beneficiarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donantes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicinas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos   ENABLE ROW LEVEL SECURITY;

-- --- BENEFICIARIOS (datos personales) → super_admin, voluntario ---
DROP POLICY IF EXISTS "beneficiarios_authenticated" ON public.beneficiarios;
DROP POLICY IF EXISTS "beneficiarios_select" ON public.beneficiarios;
DROP POLICY IF EXISTS "beneficiarios_insert" ON public.beneficiarios;
DROP POLICY IF EXISTS "beneficiarios_update" ON public.beneficiarios;
DROP POLICY IF EXISTS "beneficiarios_delete" ON public.beneficiarios;
CREATE POLICY "beneficiarios_select" ON public.beneficiarios
  FOR SELECT TO authenticated
  USING (public.rol_actual() IN ('super_admin', 'voluntario'));
CREATE POLICY "beneficiarios_insert" ON public.beneficiarios
  FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() IN ('super_admin', 'voluntario'));
CREATE POLICY "beneficiarios_update" ON public.beneficiarios
  FOR UPDATE TO authenticated
  USING (public.rol_actual() IN ('super_admin', 'voluntario'));
CREATE POLICY "beneficiarios_delete" ON public.beneficiarios
  FOR DELETE TO authenticated
  USING (public.rol_actual() = 'super_admin');

-- --- DONANTES → super_admin, voluntario ---
DROP POLICY IF EXISTS "donantes_authenticated" ON public.donantes;
DROP POLICY IF EXISTS "donantes_select" ON public.donantes;
DROP POLICY IF EXISTS "donantes_insert" ON public.donantes;
DROP POLICY IF EXISTS "donantes_update" ON public.donantes;
DROP POLICY IF EXISTS "donantes_delete" ON public.donantes;
CREATE POLICY "donantes_select" ON public.donantes
  FOR SELECT TO authenticated
  USING (public.rol_actual() IN ('super_admin', 'voluntario'));
CREATE POLICY "donantes_insert" ON public.donantes
  FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() IN ('super_admin', 'voluntario'));
CREATE POLICY "donantes_update" ON public.donantes
  FOR UPDATE TO authenticated
  USING (public.rol_actual() IN ('super_admin', 'voluntario'));
CREATE POLICY "donantes_delete" ON public.donantes
  FOR DELETE TO authenticated
  USING (public.rol_actual() = 'super_admin');

-- --- LOTES → super_admin, brigadista ---
DROP POLICY IF EXISTS "lotes_authenticated" ON public.lotes;
DROP POLICY IF EXISTS "lotes_select" ON public.lotes;
DROP POLICY IF EXISTS "lotes_insert" ON public.lotes;
DROP POLICY IF EXISTS "lotes_update" ON public.lotes;
DROP POLICY IF EXISTS "lotes_delete" ON public.lotes;
CREATE POLICY "lotes_select" ON public.lotes
  FOR SELECT TO authenticated
  USING (public.rol_actual() IN ('super_admin', 'brigadista'));
CREATE POLICY "lotes_insert" ON public.lotes
  FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() IN ('super_admin', 'brigadista'));
CREATE POLICY "lotes_update" ON public.lotes
  FOR UPDATE TO authenticated
  USING (public.rol_actual() IN ('super_admin', 'brigadista'));
CREATE POLICY "lotes_delete" ON public.lotes
  FOR DELETE TO authenticated
  USING (public.rol_actual() = 'super_admin');

-- --- ENTREGAS → super_admin, brigadista ---
DROP POLICY IF EXISTS "entregas_authenticated" ON public.entregas;
DROP POLICY IF EXISTS "entregas_select" ON public.entregas;
DROP POLICY IF EXISTS "entregas_insert" ON public.entregas;
DROP POLICY IF EXISTS "entregas_update" ON public.entregas;
DROP POLICY IF EXISTS "entregas_delete" ON public.entregas;
CREATE POLICY "entregas_select" ON public.entregas
  FOR SELECT TO authenticated
  USING (public.rol_actual() IN ('super_admin', 'brigadista', 'voluntario'));
-- ^ lectura amplia: el historial de donaciones se muestra en Beneficiarios
--   (voluntario). Ajusta si no quieres que voluntario vea entregas.
CREATE POLICY "entregas_insert" ON public.entregas
  FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() IN ('super_admin', 'brigadista'));
CREATE POLICY "entregas_update" ON public.entregas
  FOR UPDATE TO authenticated
  USING (public.rol_actual() = 'super_admin');
CREATE POLICY "entregas_delete" ON public.entregas
  FOR DELETE TO authenticated
  USING (public.rol_actual() = 'super_admin');

-- --- MEDICINAS y CATEGORIAS ---
-- El catálogo NO es dato personal. Lectura para cualquier autenticado (varias
-- pantallas lo necesitan); escritura solo para super_admin, brigadista.
DROP POLICY IF EXISTS "medicinas_authenticated" ON public.medicinas;
DROP POLICY IF EXISTS "medicinas_select" ON public.medicinas;
DROP POLICY IF EXISTS "medicinas_write"  ON public.medicinas;
CREATE POLICY "medicinas_select" ON public.medicinas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "medicinas_write" ON public.medicinas
  FOR ALL TO authenticated
  USING (public.rol_actual() IN ('super_admin', 'brigadista'))
  WITH CHECK (public.rol_actual() IN ('super_admin', 'brigadista'));

DROP POLICY IF EXISTS "categorias_authenticated" ON public.categorias;
DROP POLICY IF EXISTS "categorias_select" ON public.categorias;
DROP POLICY IF EXISTS "categorias_write"  ON public.categorias;
CREATE POLICY "categorias_select" ON public.categorias
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "categorias_write" ON public.categorias
  FOR ALL TO authenticated
  USING (public.rol_actual() IN ('super_admin', 'brigadista'))
  WITH CHECK (public.rol_actual() IN ('super_admin', 'brigadista'));

-- --- MOVIMIENTOS (trazabilidad) → super_admin, brigadista ---
DROP POLICY IF EXISTS "movimientos_authenticated" ON public.movimientos;
DROP POLICY IF EXISTS "movimientos_select" ON public.movimientos;
DROP POLICY IF EXISTS "movimientos_write"  ON public.movimientos;
CREATE POLICY "movimientos_select" ON public.movimientos
  FOR SELECT TO authenticated
  USING (public.rol_actual() IN ('super_admin', 'brigadista', 'voluntario'));
CREATE POLICY "movimientos_write" ON public.movimientos
  FOR ALL TO authenticated
  USING (public.rol_actual() IN ('super_admin', 'brigadista'))
  WITH CHECK (public.rol_actual() IN ('super_admin', 'brigadista'));

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (correr después, sin modificar datos)
-- ============================================================================
-- -- ¿RLS activa en todas?
-- SELECT relname, relrowsecurity FROM pg_class
-- WHERE relname IN ('beneficiarios','donantes','lotes','entregas',
--                   'medicinas','categorias','movimientos','perfiles');
--
-- -- ¿Alguna política sigue alcanzando a anon/public? (no debería haber ninguna)
-- SELECT tablename, policyname, roles, cmd FROM pg_policies
-- WHERE schemaname='public' AND (roles::text LIKE '%anon%' OR roles::text LIKE '%public%');

-- ============================================================================
-- ROLLBACK de emergencia (SOLO si la app queda inutilizable y no hay tiempo de
-- depurar). Revierte a "cualquier autenticado puede todo" — NO es seguro, es un
-- salvavidas temporal mientras se corrige la política:
-- ============================================================================
-- BEGIN;
-- DO $$ DECLARE t text; BEGIN
--   FOREACH t IN ARRAY ARRAY['beneficiarios','donantes','lotes','entregas',
--                            'medicinas','categorias','movimientos'] LOOP
--     EXECUTE format('DROP POLICY IF EXISTS "%1$s_select" ON public.%1$s', t);
--     EXECUTE format('DROP POLICY IF EXISTS "%1$s_insert" ON public.%1$s', t);
--     EXECUTE format('DROP POLICY IF EXISTS "%1$s_update" ON public.%1$s', t);
--     EXECUTE format('DROP POLICY IF EXISTS "%1$s_delete" ON public.%1$s', t);
--     EXECUTE format('DROP POLICY IF EXISTS "%1$s_write"  ON public.%1$s', t);
--     EXECUTE format('CREATE POLICY "%1$s_authenticated" ON public.%1$s FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
--   END LOOP;
-- END $$;
-- COMMIT;
