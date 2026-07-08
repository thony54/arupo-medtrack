-- ============================================================
-- Arupo MedTrack — Schema v16: Actas de Entrega guardadas
-- Ejecuta este script en el SQL Editor de Supabase.
-- Es INCREMENTAL y NO destructivo: no elimina ni modifica
-- ninguna tabla ni dato existente (medicinas, lotes, etc.).
-- ============================================================

-- ============================================================
-- TABLA ENTREGAS — Guarda el acta/factura completa de cada
-- donación entregada, para poder descargarla despues tal cual
-- se genera al momento de "Imprimir Acta".
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entregas (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  beneficiario_id  UUID        REFERENCES public.beneficiarios(id) ON DELETE SET NULL,
  destino          TEXT,
  -- Payload completo que necesita el componente Comprobante:
  -- { beneficiario: {...}, donaciones: [{ producto, desglose_lotes, total_despachado }] }
  acta             JSONB       NOT NULL,
  total_unidades   INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entregas_beneficiario ON public.entregas (beneficiario_id);
CREATE INDEX IF NOT EXISTS idx_entregas_created_at   ON public.entregas (created_at DESC);

ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "entregas_authenticated" ON public.entregas;
CREATE POLICY "entregas_authenticated" ON public.entregas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
