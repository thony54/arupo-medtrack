-- ============================================================
-- Arupo MedTrack — Schema v15: Ampliación de Perfiles por Rol
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS avatar TEXT,
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS especialidad TEXT,
  ADD COLUMN IF NOT EXISTS licencia_medica TEXT,
  ADD COLUMN IF NOT EXISTS institucion TEXT,
  ADD COLUMN IF NOT EXISTS area_apoyo TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS disponibilidad TEXT;
