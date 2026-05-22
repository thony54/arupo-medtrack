-- ============================================================
-- Arupo MedTrack — Schema v14: Nuevos Campos de Medicina
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================

ALTER TABLE public.medicinas
  ADD COLUMN IF NOT EXISTS nombre_generico TEXT,
  ADD COLUMN IF NOT EXISTS nombre_comercial TEXT,
  ADD COLUMN IF NOT EXISTS via_administracion TEXT;
