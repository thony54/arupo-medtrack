-- ============================================================
-- Arupo MedTrack — Schema v2: Trazabilidad Unitaria (FEFO)
-- Ejecuta este script en el SQL Editor de Supabase
-- Es INCREMENTAL: no elimina tablas existentes
-- ============================================================

-- ============================================================
-- 1. TABLA LOTES (Stock Individual)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lotes (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id      UUID        NOT NULL REFERENCES public.medicinas(id) ON DELETE CASCADE,
  numero_lote      TEXT,
  cantidad_actual  INTEGER     NOT NULL DEFAULT 0 CHECK (cantidad_actual >= 0),
  fecha_vencimiento DATE       NOT NULL,
  ubicacion_estante TEXT,
  estado           TEXT        NOT NULL DEFAULT 'Disponible'
                               CHECK (estado IN ('Disponible', 'Reservado', 'Vencido')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lotes_producto_id   ON public.lotes (producto_id);
CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento   ON public.lotes (fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_lotes_estado        ON public.lotes (estado);

-- ============================================================
-- 2. FUNCIÓN: actualizar stock_actual desde lotes (Contabilidad Espejo)
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_stock_desde_lotes()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcula el stock del producto afectado sumando lotes disponibles/reservados
  UPDATE public.medicinas
  SET    stock_actual = COALESCE((
           SELECT SUM(cantidad_actual)
           FROM   public.lotes
           WHERE  producto_id = COALESCE(NEW.producto_id, OLD.producto_id)
             AND  estado IN ('Disponible', 'Reservado')
         ), 0),
         updated_at = NOW()
  WHERE  id = COALESCE(NEW.producto_id, OLD.producto_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disparar tras INSERT, UPDATE o DELETE en lotes
DROP TRIGGER IF EXISTS trg_sync_stock ON public.lotes;
CREATE TRIGGER trg_sync_stock
  AFTER INSERT OR UPDATE OR DELETE ON public.lotes
  FOR EACH ROW EXECUTE FUNCTION public.sync_stock_desde_lotes();

-- ============================================================
-- 3. FUNCIÓN FEFO: registrar_salida_fefo
-- Descuenta del lote que vence antes. Retorna JSON con desglose.
-- ============================================================
CREATE OR REPLACE FUNCTION public.registrar_salida_fefo(
  p_producto_id  UUID,
  p_cantidad     INTEGER,
  p_destino      TEXT DEFAULT NULL
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

  -- Iterar lotes ordenados por fecha_vencimiento ASC (FEFO)
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

    -- Actualizar lote
    UPDATE public.lotes
    SET    cantidad_actual = cantidad_actual - v_descontado,
           estado = CASE WHEN cantidad_actual - v_descontado = 0 THEN 'Disponible' ELSE estado END,
           updated_at = NOW()
    WHERE  id = v_lote.id;

    -- Registrar movimiento individual por lote
    INSERT INTO public.movimientos (medicina_id, tipo, cantidad, origen_destino)
    VALUES (p_producto_id, 'Salida', v_descontado, p_destino)
    RETURNING id INTO v_movimiento;

    -- Acumular desglose para el comprobante
    v_desglose := v_desglose || jsonb_build_object(
      'lote_id',         v_lote.id,
      'numero_lote',     v_lote.numero_lote,
      'fecha_venc',      v_lote.fecha_vencimiento,
      'ubicacion',       v_lote.ubicacion_estante,
      'cantidad',        v_descontado,
      'movimiento_id',   v_movimiento
    );

    v_restante := v_restante - v_descontado;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'desglose', v_desglose, 'total_despachado', p_cantidad);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. FUNCIÓN: marcar lotes vencidos
-- Llamar manualmente o via pg_cron si está disponible
-- ============================================================
CREATE OR REPLACE FUNCTION public.marcar_lotes_vencidos()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.lotes
  SET    estado = 'Vencido', updated_at = NOW()
  WHERE  fecha_vencimiento < CURRENT_DATE
    AND  estado = 'Disponible';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. FUNCIÓN: lotes próximos a vencer (< 30 días)
-- Retorna vista usada por el dashboard de alertas
-- ============================================================
CREATE OR REPLACE VIEW public.alertas_vencimiento AS
SELECT
  l.id,
  l.producto_id,
  m.nombre           AS producto_nombre,
  l.numero_lote,
  l.cantidad_actual,
  l.fecha_vencimiento,
  l.ubicacion_estante,
  (l.fecha_vencimiento - CURRENT_DATE) AS dias_restantes
FROM public.lotes l
JOIN public.medicinas m ON m.id = l.producto_id
WHERE l.estado = 'Disponible'
  AND l.fecha_vencimiento <= (CURRENT_DATE + INTERVAL '30 days')
  AND l.cantidad_actual > 0
ORDER BY l.fecha_vencimiento ASC;

-- ============================================================
-- 6. Habilitar Row Level Security (RLS) en lotes
-- ============================================================
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lotes_authenticated" ON public.lotes;
CREATE POLICY "lotes_authenticated"
  ON public.lotes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 7. NOTA: Ejecutar marcar_lotes_vencidos() manualmente o con pg_cron:
-- SELECT cron.schedule('0 0 * * *', $$SELECT public.marcar_lotes_vencidos()$$);
-- ============================================================
