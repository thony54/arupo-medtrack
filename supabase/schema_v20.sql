-- ============================================================
-- Arupo MedTrack — Schema v20: eliminar la columna nombre_generico
-- Ejecuta este script en el SQL Editor de Supabase.
--
-- ⚠️  NO EJECUTADO automáticamente. Léelo entero antes de aplicarlo.
-- ⚠️  La app está EN PRODUCCIÓN con datos reales.
--
-- MOTIVO
-- El concepto "nombre genérico" se retira de toda la app: ahora hay un
-- único campo "Nombre". La columna `medicinas.nombre_generico` (añadida
-- en schema_v14.sql) queda sin uso en el código.
--
-- POR QUÉ NO SE PIERDE INFORMACIÓN
-- El nombre siempre se guardó también en la columna maestra `nombre`,
-- con el formato "Nombre (Comercial)" para medicinas. El frontend ya
-- deriva el nombre a partir de `nombre` (quita el "(Comercial)") en todas
-- las vistas, y el comercial vive aparte en `nombre_comercial`. Por eso
-- `nombre_generico` es redundante y puede eliminarse sin migrar datos.
-- ============================================================


-- ============================================================
-- ORDEN DE DESPLIEGUE — IMPORTANTE
--
-- 1. Despliega PRIMERO el frontend actualizado (esta rama), que ya NO
--    escribe ni lee `nombre_generico`.
-- 2. DESPUÉS ejecuta este DROP.
--
-- Si ejecutas el DROP mientras sigue viva la versión anterior del
-- frontend, sus INSERT/UPDATE sobre `medicinas` incluirán la columna
-- `nombre_generico` y fallarán. Manteniendo este orden no hay ventana de
-- error: con la columna aún presente, el frontend nuevo simplemente la
-- deja de poblar; al soltarla después, ya nadie la referencia.
-- ============================================================


-- Comprobación opcional previa: ninguna medicina con nombre `nombre`
-- vacío que solo tuviera el dato en `nombre_generico` (no debería haber
-- ninguna; el nombre maestro siempre se pobló). Si esto devuelve filas,
-- revísalas ANTES de soltar la columna:
--
--   SELECT id, nombre, nombre_generico, nombre_comercial
--   FROM public.medicinas
--   WHERE COALESCE(TRIM(nombre), '') = ''
--     AND COALESCE(TRIM(nombre_generico), '') <> '';


ALTER TABLE public.medicinas
  DROP COLUMN IF EXISTS nombre_generico;


-- ============================================================
-- VERIFICACIÓN DESPUÉS DE APLICAR
--
-- 1. La columna ya no existe:
--      SELECT column_name FROM information_schema.columns
--      WHERE table_schema = 'public' AND table_name = 'medicinas'
--      ORDER BY column_name;
--    No debe aparecer `nombre_generico`.
--
-- 2. Prueba de humo en la app:
--      - Crea una medicina desde el Catálogo (con y sin "Nombre comercial").
--      - Edítala desde Inventario.
--      - Importa un Excel de medicinas.
--    Todo debe guardar sin error y el nombre mostrarse correctamente.
-- ============================================================
