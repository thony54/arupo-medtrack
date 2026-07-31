-- ============================================================
-- Arupo MedTrack — Schema v19: el rol deja de venir del cliente
--
-- ⚠️  NO EJECUTADO. Léelo entero antes de aplicarlo.
-- ⚠️  La app está EN PRODUCCIÓN con datos reales.
--
-- MOTIVO — es el hallazgo §2.1 de SECURITY.md, el único explotable
-- sin tener credenciales:
--
--   handle_new_user() (schema_v4.sql:37-51) asigna el rol así:
--       COALESCE(NEW.raw_user_meta_data->>'rol', 'brigadista')
--
--   `raw_user_meta_data` lo escribe íntegramente quien hace la llamada
--   a signUp. Y el proyecto tiene, verificado el 2026-07-23:
--       disable_signup: false      → cualquiera puede registrarse
--       mailer_autoconfirm: true   → sin verificar el email
--
--   Cadena completa: una petición HTTP desde cualquier navegador del
--   mundo crea una cuenta `super_admin` activa al instante. Sin
--   invitación, sin aprobación y sin acceso a ningún buzón.
--
-- ESTE SCRIPT NO BASTA POR SÍ SOLO. Ver la PARTE 3.
-- ============================================================


-- ============================================================
-- PARTE 1 — El trigger ignora el rol que mande el cliente
--
-- Riesgo de rotura: BAJO para los usuarios existentes (no toca ni una
-- fila de `perfiles`). Sí cambia el alta desde /usuarios: ver PARTE 2.
--
-- `nombre` se sigue leyendo de la metadata a propósito: es un dato
-- cosmético que el propio usuario aporta, no una decisión de permisos.
-- El rol pasa a ser SIEMPRE el de menor privilegio.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, email, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    NEW.email,
    -- Rol fijo. NUNCA se lee de raw_user_meta_data: lo controla el cliente.
    -- La promoción a brigadista o super_admin la hace después un
    -- super_admin desde /usuarios (UPDATE sobre perfiles, ya restringido).
    'voluntario'
  );
  RETURN NEW;
END;
$$;

-- El trigger en sí no cambia; se deja el CREATE por si no existiera.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- PARTE 2 — Consecuencia en la pantalla /usuarios. LÉELO.
--
-- Hoy `src/pages/Usuarios.jsx` crea personal con signUp() y le pasa el
-- rol elegido en el formulario. Tras aplicar la PARTE 1, ese rol se
-- IGNORA: toda cuenta nueva nace como `voluntario`.
--
-- Es el comportamiento correcto, pero cambia el flujo de trabajo:
-- después de crear a alguien hay que promoverlo a mano desde la misma
-- pantalla. Avisa a quien gestione usuarios antes de aplicarlo, o la
-- primera reacción será "se rompió: creé un brigadista y salió
-- voluntario".
--
-- La solución definitiva es una Edge Function con la service_role key
-- que valide que quien llama es super_admin y cree la cuenta con el rol
-- pedido. Eso no cabe en un script SQL: requiere desplegar una función
-- en Supabase. Hasta entonces, promover a mano es el camino seguro.
-- ============================================================


-- ============================================================
-- PARTE 3 — Lo que este script NO puede arreglar (panel de Supabase)
--
-- Sin estos dos interruptores, la PARTE 1 reduce el daño pero deja
-- abierto el registro público. Son dos casillas, efecto inmediato:
--
--   Authentication → Providers → Email
--     [ ] Allow new users to sign up      ← DESACTIVAR
--     [x] Confirm email                   ← ACTIVAR
--
-- Ojo: al desactivar el alta pública, /usuarios deja de poder crear
-- cuentas con signUp(). Es justo el motivo por el que hace falta la
-- Edge Function de la PARTE 2. Decide el orden:
--   a) Aplicar PARTE 1 ahora y cerrar el alta pública cuando exista la
--      Edge Function → sigue habiendo registro público, pero ya nadie
--      puede auto-asignarse super_admin. Es el paso más urgente.
--   b) Cerrar el alta pública ya y crear usuarios desde el panel de
--      Supabase mientras tanto → más seguro, menos cómodo.
-- ============================================================


-- ============================================================
-- PARTE 4 — Eliminar el camino latente `crear_usuario_completo`
--
-- schema_v4.sql:61 define una función SECURITY DEFINER que la UI ya no
-- usa. Valida que quien llama sea super_admin, PERO con este bypass:
--     IF EXISTS (SELECT 1 FROM public.perfiles) AND …
-- Si `perfiles` quedara vacía, cualquiera podría crear el primer
-- super_admin. Hoy está mitigado porque hay 12 perfiles cargados; es
-- una mitigación por casualidad, no por diseño.
--
-- Comprueba primero que de verdad nadie la llama:
--   SELECT * FROM pg_stat_user_functions WHERE funcname = 'crear_usuario_completo';
-- y busca 'crear_usuario_completo' en el código (a fecha de hoy, 0 usos
-- fuera de los scripts SQL).
--
-- DROP FUNCTION IF EXISTS public.crear_usuario_completo(TEXT, TEXT, TEXT, TEXT);


-- ============================================================
-- VERIFICACIÓN DESPUÉS DE APLICAR LA PARTE 1
--
-- 1. La definición ya no debe mencionar raw_user_meta_data->>'rol':
--      SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
--
-- 2. Prueba de humo, en un proyecto de staging o asumiendo que dejarás
--    una cuenta de prueba que habrá que borrar después:
--      - Registra un usuario pasando rol='super_admin' en la metadata.
--      - Comprueba el resultado:
--          SELECT email, rol FROM public.perfiles
--          WHERE email = '<el de prueba>';
--        Debe salir 'voluntario'. Si sale 'super_admin', el trigger no
--        se reemplazó: revisa que no haya otro trigger sobre auth.users.
--      - Borra la cuenta de prueba.
--
-- 3. Los perfiles existentes NO cambian. Confírmalo:
--      SELECT rol, COUNT(*) FROM public.perfiles GROUP BY rol;
--    Debe seguir dando el mismo reparto que antes de ejecutar el script.
-- ============================================================
