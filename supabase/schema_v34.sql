-- ============================================================================
-- schema_v34.sql — Diagnóstico escrito en las Evaluaciones de Salud
-- ============================================================================
--
-- ⚠️  NO APLICADO. Ejecútalo a mano en el SQL Editor de Supabase.
--
-- Qué hace:
--   Añade dos columnas de texto libre a `evaluaciones_salud`, donde el médico o
--   brigadista escribe su diagnóstico al terminar cada examen:
--     · diagnostico_fisico → paso "Medidas Físicas" (peso, talla, IMC)
--     · diagnostico_medico → paso "Examen Médico" (glucosa, presión arterial)
--   Salen en el PDF de la evaluación, bajo el título "Diagnóstico".
--
-- Es seguro con datos reales: solo AÑADE columnas (nulas), no toca filas ni políticas,
-- y se puede ejecutar más de una vez.
--
-- Orden de despliegue: da igual. Mientras las columnas no existan, la app guarda el
-- diagnóstico dentro de `notas` (no se pierde); una vez creadas, va a su columna.

ALTER TABLE public.evaluaciones_salud
  ADD COLUMN IF NOT EXISTS diagnostico_fisico TEXT,
  ADD COLUMN IF NOT EXISTS diagnostico_medico TEXT;
