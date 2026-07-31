-- ============================================================
-- Arupo MedTrack — Schema v18: Reconciliar el repo con la base real
--
-- ⚠️  NO EJECUTADO. Léelo entero antes de aplicarlo.
-- ⚠️  La app está EN PRODUCCIÓN con datos reales.
--
-- MOTIVO
-- Varias columnas y tablas que el código usa a diario NO están declaradas
-- en ningún `supabase/schema_v*.sql`: se crearon a mano en el panel de
-- Supabase. El repo dejó de describir la base. Consecuencias prácticas:
--   · Nadie puede recrear el entorno desde cero (ni staging, ni un clon).
--   · Una restauración desde estos scripts produciría una base incompleta
--     y la app fallaría en runtime, no al desplegar.
--   · Al revisar código no hay forma de saber qué columnas existen.
--
-- ESTE SCRIPT SE ESCRIBIÓ LEYENDO EL CÓDIGO, NO LA BASE.
-- Los tipos son los que el frontend da por supuestos; no se han podido
-- verificar contra producción. Por eso todo es `ADD COLUMN IF NOT EXISTS`:
-- si la columna ya existe, la instrucción no hace absolutamente nada, sea
-- cual sea su tipo. No hay ningún DROP de columnas ni de tablas.
--
-- ORDEN CORRECTO DE USO:
--   1. Ejecuta la PARTE 0 (solo lectura) y compara con lo que sigue.
--   2. Aplica la PARTE 1 solo si la PARTE 0 confirma que falta algo.
--   3. La PARTE 2 y la PARTE 3 requieren decisión tuya. Léelas.
-- ============================================================


-- ============================================================
-- PARTE 0 — Radiografía de la base real (SOLO LECTURA)
--
-- No modifica nada. Ejecútalo primero en el SQL Editor y guarda el
-- resultado: es la fuente de verdad que a este repo le falta.
-- ============================================================

-- 0.1 · Todas las columnas reales de las tablas del dominio
SELECT table_name, ordinal_position, column_name, data_type,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('beneficiarios','donantes','medicinas','categorias',
                     'lotes','movimientos','entregas','perfiles',
                     'evaluaciones_salud')
ORDER BY table_name, ordinal_position;

-- 0.2 · Restricciones (CHECK, UNIQUE, FK) que la app podría estar violando
SELECT conrelid::regclass AS tabla, conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, conname;

-- 0.3 · Triggers (aquí debe estar lo que genera BEN-XXXX y DON-XXXX)
SELECT event_object_table AS tabla, trigger_name, action_timing,
       event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 0.4 · Volcado listo para versionar de una tabla concreta.
--       Repítelo para `medicinas` y `categorias`: su definición NO existe
--       en ningún script de este repo (ver PARTE 3).
--       Alternativa desde tu terminal, mucho más fiel:
--         pg_dump --schema-only --no-owner --no-privileges \
--           -t public.medicinas -t public.categorias "<CONNECTION_STRING>"


-- ============================================================
-- PARTE 1 — Columnas que el código usa y ningún script declara
--
-- Riesgo: BAJO. `ADD COLUMN IF NOT EXISTS` sin NOT NULL y sin DEFAULT
-- que reescriba filas. Si ya existen (lo esperado, porque la app las
-- lleva usando meses), no ocurre nada.
--
-- El objetivo aquí NO es cambiar la base: es que el repo deje constancia
-- de lo que la base ya tiene.
-- ============================================================

-- 1.1 · beneficiarios
-- Declarado en schema_v3.sql: nombre_completo, cedula, telefono, direccion,
--   condicion_medica, estado, notas, fecha_registro.
-- Usado por src/pages/Beneficiarios.jsx y no declarado:
ALTER TABLE public.beneficiarios
  ADD COLUMN IF NOT EXISTS nombre                    TEXT,
  ADD COLUMN IF NOT EXISTS codigo                    TEXT,
  ADD COLUMN IF NOT EXISTS tipo                      TEXT,
  ADD COLUMN IF NOT EXISTS contacto_responsable      TEXT,
  ADD COLUMN IF NOT EXISTS email                     TEXT,
  ADD COLUMN IF NOT EXISTS discapacidad_tipo         TEXT,
  ADD COLUMN IF NOT EXISTS tiene_carnet_discapacidad BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at                TIMESTAMPTZ DEFAULT NOW();

-- 1.2 · donantes
-- Declarado en schema_v3.sql: nombre, tipo, contacto_nombre, telefono,
--   email, direccion, estado, notas, created_at, updated_at.
-- Usado por src/pages/Donantes.jsx y no declarado:
ALTER TABLE public.donantes
  ADD COLUMN IF NOT EXISTS codigo                    TEXT,
  ADD COLUMN IF NOT EXISTS contacto_responsable      TEXT,
  ADD COLUMN IF NOT EXISTS cedula                    TEXT,
  ADD COLUMN IF NOT EXISTS condicion_medica          TEXT,
  ADD COLUMN IF NOT EXISTS discapacidad_tipo         TEXT,
  ADD COLUMN IF NOT EXISTS tiene_carnet_discapacidad BOOLEAN DEFAULT FALSE;

-- 1.3 · Índices de búsqueda.
-- Opcionales, pero el listado ordena por `created_at` y se busca por
-- código y cédula. CONCURRENTLY no puede ir dentro de un bloque de
-- transacción: ejecuta estas líneas UNA A UNA, no con el resto del script.
--
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_beneficiarios_codigo
--     ON public.beneficiarios (codigo);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donantes_codigo
--     ON public.donantes (codigo);


-- ============================================================
-- PARTE 2 — Discrepancias que NO se corrigen solas. Decisión tuya.
--
-- No ejecutes nada de esta parte sin haber mirado antes el resultado
-- de la PARTE 0. Cada punto explica qué comprobar.
-- ============================================================

-- 2.1 · `beneficiarios`: ¿nombre o nombre_completo?
-- schema_v3.sql declara `nombre_completo TEXT NOT NULL`, pero todo el
-- código (INSERT y lectura) usa `nombre`. La vista historial_beneficiarios
-- de schema_v3.sql:135 también lee `nombre_completo`.
-- Si en la base real conviven ambas y `nombre_completo` sigue siendo
-- NOT NULL, cada alta desde la app debería fallar — como no falla, lo más
-- probable es que la columna se renombrara o se relajara a mano.
-- COMPRUÉBALO con la PARTE 0 y anota el resultado. NO renombres nada:
-- un rename rompería la vista historial_beneficiarios en el acto.

-- 2.2 · `donantes`: ¿contacto_nombre o contacto_responsable?
-- Mismo caso. El script declara `contacto_nombre`; el código escribe
-- `contacto_responsable`. Si existen las dos, hay datos partidos en dos
-- columnas y conviene decidir cuál es la buena antes de tocar nada.

-- 2.3 · `donantes.tipo`: el CHECK del repo prohíbe valores que la UI ofrece.
-- schema_v3.sql:14 restringe a:
--   'Hospital','Farmacia','ONG','Gobierno','Empresa','Particular'
-- pero src/pages/Donantes.jsx:9 ofrece además:
--   'Centro de Salud','Fundación','Comunidad'
-- Si el CHECK sigue vigente en producción, guardar un donante de tipo
-- "Fundación" falla con un error de Postgres crudo. Si nunca ha fallado,
-- es que el CHECK ya no existe: confírmalo en 0.2 antes de ejecutar esto.
--
--   ALTER TABLE public.donantes DROP CONSTRAINT IF EXISTS donantes_tipo_check;
--   ALTER TABLE public.donantes ADD CONSTRAINT donantes_tipo_check
--     CHECK (tipo IN ('Hospital','Farmacia','ONG','Gobierno','Empresa',
--                     'Particular','Centro de Salud','Fundación','Comunidad'));
--
-- Ojo: el ADD falla si alguna fila ya tiene un valor fuera de la lista.
-- Compruébalo antes:
--   SELECT DISTINCT tipo FROM public.donantes;

-- 2.4 · `codigo` (BEN-XXXX / DON-XXXX) se genera solo, pero nada en este
-- repo dice cómo. Tiene que haber un trigger o un DEFAULT en la base.
-- Localízalo con 0.3 y pégalo aquí abajo para dejarlo versionado:
--
--   -- (pendiente: copiar aquí la definición real del generador de código)


-- ============================================================
-- PARTE 3 — Lo que falta por completo: `medicinas` y `categorias`
--
-- Son las dos tablas centrales de la app (593 y 86 filas según la
-- verificación del 2026-07-23) y NINGÚN script las crea. schema_v3.sql
-- solo les añade columnas sueltas, dando por hecho que ya existen.
--
-- Columnas de `medicinas` que el código usa hoy — src/pages/Catalog.jsx,
-- src/pages/Inventory.jsx, src/components/inventory/*:
--   id, nombre, categoria_id (FK → categorias.id), presentacion,
--   concentracion, laboratorio, cantidad_por_presentacion, observaciones,
--   stock_actual, nombre_generico, nombre_comercial, via_administracion
--   (las tres últimas las añade schema_v14.sql;
--    cantidad_por_presentacion y laboratorio, schema_v3.sql:175)
--
-- Columnas de `categorias`: id, nombre, descripcion.
--
-- NO se escribe aquí un CREATE TABLE inventado: acertar el tipo de cada
-- columna a ojo y equivocarse en una sola sería peor que no tenerlo.
-- Genera la definición real con 0.4 (o pg_dump) y guárdala como
-- `supabase/schema_v0_base.sql`, marcado como "ya aplicado, solo
-- documental". Ese archivo es el que hoy falta para poder recrear la base.
-- ============================================================


-- ============================================================
-- VERIFICACIÓN DESPUÉS DE APLICAR LA PARTE 1
--
-- No debe devolver ninguna fila: todas las columnas que el código usa
-- deben existir.
--
--   SELECT c.tabla, c.col
--   FROM (VALUES
--       ('beneficiarios','nombre'), ('beneficiarios','codigo'),
--       ('beneficiarios','tipo'),   ('beneficiarios','contacto_responsable'),
--       ('beneficiarios','email'),  ('beneficiarios','discapacidad_tipo'),
--       ('beneficiarios','tiene_carnet_discapacidad'),
--       ('donantes','codigo'),      ('donantes','contacto_responsable'),
--       ('donantes','cedula'),      ('donantes','condicion_medica'),
--       ('donantes','discapacidad_tipo'),
--       ('donantes','tiene_carnet_discapacidad')
--     ) AS c(tabla, col)
--   WHERE NOT EXISTS (
--     SELECT 1 FROM information_schema.columns i
--     WHERE i.table_schema = 'public'
--       AND i.table_name = c.tabla
--       AND i.column_name = c.col);
-- ============================================================
