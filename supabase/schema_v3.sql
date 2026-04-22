-- ============================================================
-- Arupo MedTrack — Schema v3: CRM de Donaciones Médicas
-- Ejecuta este script NUEVO en el SQL Editor de Supabase
-- Es INCREMENTAL: no elimina tablas existentes
-- ============================================================

-- ============================================================
-- 1. TABLA DONANTES — Organizaciones o personas que donan
-- ============================================================
CREATE TABLE IF NOT EXISTS public.donantes (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT        NOT NULL,
  tipo        TEXT        NOT NULL DEFAULT 'Particular'
                          CHECK (tipo IN ('Hospital', 'Farmacia', 'ONG', 'Gobierno', 'Empresa', 'Particular')),
  contacto_nombre  TEXT,
  telefono    TEXT,
  email       TEXT,
  direccion   TEXT,
  estado      TEXT        NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo')),
  notas       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.donantes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "donantes_authenticated" ON public.donantes;
CREATE POLICY "donantes_authenticated" ON public.donantes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. TABLA BENEFICIARIOS — Personas/familias que reciben
-- ============================================================
CREATE TABLE IF NOT EXISTS public.beneficiarios (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_completo   TEXT        NOT NULL,
  cedula            TEXT        UNIQUE,
  telefono          TEXT,
  direccion         TEXT,
  condicion_medica  TEXT,
  estado            TEXT        NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo')),
  notas             TEXT,
  fecha_registro    DATE        DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.beneficiarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "beneficiarios_authenticated" ON public.beneficiarios;
CREATE POLICY "beneficiarios_authenticated" ON public.beneficiarios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3. VINCULAR LOTES → DONANTE (columna opcional)
-- ============================================================
ALTER TABLE public.lotes
  ADD COLUMN IF NOT EXISTS donante_id UUID REFERENCES public.donantes(id) ON DELETE SET NULL;

-- ============================================================
-- 4. VINCULAR MOVIMIENTOS → BENEFICIARIO (para trazabilidad)
-- ============================================================
ALTER TABLE public.movimientos
  ADD COLUMN IF NOT EXISTS beneficiario_id UUID REFERENCES public.beneficiarios(id) ON DELETE SET NULL;

-- ============================================================
-- 5. ACTUALIZAR función FEFO para aceptar beneficiario_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.registrar_salida_fefo(
  p_producto_id    UUID,
  p_cantidad       INTEGER,
  p_destino        TEXT    DEFAULT NULL,
  p_beneficiario_id UUID   DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_restante    INTEGER := p_cantidad;
  v_lote        RECORD;
  v_descontado  INTEGER;
  v_desglose    JSONB  := '[]'::JSONB;
  v_movimiento  UUID;
BEGIN
  -- Validar stock suficiente
  IF (SELECT COALESCE(SUM(cantidad_actual), 0) FROM public.lotes
      WHERE producto_id = p_producto_id AND estado = 'Disponible') < p_cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente para el producto indicado.';
  END IF;

  -- Iterar lotes FEFO
  FOR v_lote IN
    SELECT id, cantidad_actual, fecha_vencimiento, numero_lote, ubicacion_estante
    FROM   public.lotes
    WHERE  producto_id = p_producto_id
      AND  estado = 'Disponible'
      AND  cantidad_actual > 0
    ORDER BY fecha_vencimiento ASC
  LOOP
    EXIT WHEN v_restante <= 0;
    v_descontado := LEAST(v_lote.cantidad_actual, v_restante);

    UPDATE public.lotes
    SET    cantidad_actual = cantidad_actual - v_descontado,
           updated_at = NOW()
    WHERE  id = v_lote.id;

    INSERT INTO public.movimientos (medicina_id, tipo, cantidad, origen_destino, beneficiario_id)
    VALUES (p_producto_id, 'Salida', v_descontado, p_destino, p_beneficiario_id)
    RETURNING id INTO v_movimiento;

    v_desglose := v_desglose || jsonb_build_object(
      'lote_id',       v_lote.id,
      'numero_lote',   v_lote.numero_lote,
      'fecha_venc',    v_lote.fecha_vencimiento,
      'ubicacion',     v_lote.ubicacion_estante,
      'cantidad',      v_descontado,
      'movimiento_id', v_movimiento
    );

    v_restante := v_restante - v_descontado;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'desglose', v_desglose,
    'total_despachado', p_cantidad,
    'beneficiario_id', p_beneficiario_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. VISTA: Historial de donaciones por beneficiario
-- ============================================================
CREATE OR REPLACE VIEW public.historial_beneficiarios AS
SELECT
  b.id            AS beneficiario_id,
  b.nombre_completo,
  b.cedula,
  m.id            AS movimiento_id,
  med.nombre      AS medicamento,
  m.cantidad,
  m.timestamp     AS fecha_donacion,
  m.origen_destino
FROM public.beneficiarios b
LEFT JOIN public.movimientos m   ON m.beneficiario_id = b.id AND m.tipo = 'Salida'
LEFT JOIN public.medicinas med   ON med.id = m.medicina_id
ORDER BY b.nombre_completo, m.timestamp DESC;

-- ============================================================
-- 7. VISTA: Historial de aportes por donante
-- ============================================================
CREATE OR REPLACE VIEW public.historial_donantes AS
SELECT
  d.id            AS donante_id,
  d.nombre,
  d.tipo,
  l.id            AS lote_id,
  med.nombre      AS medicamento,
  l.cantidad_actual,
  l.fecha_vencimiento,
  l.created_at    AS fecha_recepcion
FROM public.donantes d
LEFT JOIN public.lotes l         ON l.donante_id = d.id
LEFT JOIN public.medicinas med   ON med.id = l.producto_id
ORDER BY d.nombre, l.created_at DESC;

-- ============================================================
-- 8. ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_movimientos_beneficiario ON public.movimientos (beneficiario_id);
CREATE INDEX IF NOT EXISTS idx_lotes_donante            ON public.lotes (donante_id);
