-- ==============================================================================
-- Arupo MedTrack - Supabase Database Schema
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLAS

-- Categorías
CREATE TABLE IF NOT EXISTS public.categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medicinas
CREATE TABLE IF NOT EXISTS public.medicinas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
    presentacion VARCHAR(100),
    concentracion VARCHAR(100),
    stock_actual INTEGER DEFAULT 0 CHECK (stock_actual >= 0),
    estado_stock BOOLEAN GENERATED ALWAYS AS (stock_actual > 0) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medicinas_nombre ON public.medicinas (nombre);

-- Movimientos
CREATE TYPE public.tipo_movimiento AS ENUM ('Entrada', 'Salida');

CREATE TABLE IF NOT EXISTS public.movimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicina_id UUID NOT NULL REFERENCES public.medicinas(id) ON DELETE RESTRICT,
    tipo public.tipo_movimiento NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    origen_destino VARCHAR(255),
    usuario_id UUID, -- Relación futura con auth.users
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TRIGGERS Y FUNCIONES

-- Función para actualizar updated_at en Medicinas
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_medicinas_updated_at
BEFORE UPDATE ON public.medicinas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Función transaccional para calcular Stock
CREATE OR REPLACE FUNCTION public.calcular_stock_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo = 'Entrada' THEN
        UPDATE public.medicinas 
        SET stock_actual = stock_actual + NEW.cantidad
        WHERE id = NEW.medicina_id;
    ELSIF NEW.tipo = 'Salida' THEN
        -- El CHECK (stock_actual >= 0) en medicinas previene inventario negativo
        UPDATE public.medicinas 
        SET stock_actual = stock_actual - NEW.cantidad
        WHERE id = NEW.medicina_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_movimientos_stock
AFTER INSERT ON public.movimientos
FOR EACH ROW
EXECUTE FUNCTION public.calcular_stock_trigger();

-- Políticas de Seguridad RLS (Row Level Security) básicas
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;

-- Permitir lectura/escritura pública temporalmente (Para MVP - Cambiar en producción)
CREATE POLICY "Permitir acceso total a categorias" ON public.categorias FOR ALL USING (true);
CREATE POLICY "Permitir acceso total a medicinas" ON public.medicinas FOR ALL USING (true);
CREATE POLICY "Permitir acceso total a movimientos" ON public.movimientos FOR ALL USING (true);

-- Insertar Datos Semilla (Mock inicial para pruebas)
INSERT INTO public.categorias (nombre, descripcion) VALUES
('Analgésicos', 'Medicamentos para aliviar el dolor'),
('Antibióticos', 'Tratamiento de infecciones bacterianas'),
('Antihipertensivos', 'Control de la presión arterial')
ON CONFLICT (nombre) DO NOTHING;
