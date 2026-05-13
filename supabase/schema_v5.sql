-- ============================================================
-- Arupo MedTrack — Schema v5: Estandarización de CRM
-- Ejecuta este script en el SQL Editor de Supabase
-- Añade campos unificados para Donantes y Beneficiarios
-- y generación automática de Códigos Únicos.
-- ============================================================

-- ==========================================
-- 1. SECUENCIAS PARA CÓDIGOS AUTOMÁTICOS
-- ==========================================
CREATE SEQUENCE IF NOT EXISTS beneficiario_seq START 1;
CREATE SEQUENCE IF NOT EXISTS donante_seq START 1;

-- ==========================================
-- 2. ACTUALIZACIÓN DE TABLA BENEFICIARIOS
-- ==========================================
-- Renombrar columna para estandarizar
ALTER TABLE public.beneficiarios RENAME COLUMN nombre_completo TO nombre;

-- Añadir nuevas columnas
ALTER TABLE public.beneficiarios
  ADD COLUMN IF NOT EXISTS codigo TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'Particular',
  ADD COLUMN IF NOT EXISTS contacto_responsable TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS discapacidad_tipo TEXT,
  ADD COLUMN IF NOT EXISTS tiene_carnet_discapacidad BOOLEAN DEFAULT false;

-- ==========================================
-- 3. ACTUALIZACIÓN DE TABLA DONANTES
-- ==========================================
-- Renombrar columna para estandarizar
ALTER TABLE public.donantes RENAME COLUMN contacto_nombre TO contacto_responsable;

-- Añadir nuevas columnas
ALTER TABLE public.donantes
  ADD COLUMN IF NOT EXISTS codigo TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS cedula TEXT,
  ADD COLUMN IF NOT EXISTS condicion_medica TEXT,
  ADD COLUMN IF NOT EXISTS discapacidad_tipo TEXT,
  ADD COLUMN IF NOT EXISTS tiene_carnet_discapacidad BOOLEAN DEFAULT false;


-- ==========================================
-- 4. FUNCIONES TRIGGER PARA GENERAR CÓDIGOS
-- ==========================================
-- Generador para Beneficiarios
CREATE OR REPLACE FUNCTION public.generar_codigo_beneficiario()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := 'BEN-' || LPAD(nextval('beneficiario_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para Beneficiarios
DROP TRIGGER IF EXISTS trigger_generar_codigo_ben ON public.beneficiarios;
CREATE TRIGGER trigger_generar_codigo_ben
BEFORE INSERT ON public.beneficiarios
FOR EACH ROW
EXECUTE FUNCTION public.generar_codigo_beneficiario();


-- Generador para Donantes
CREATE OR REPLACE FUNCTION public.generar_codigo_donante()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := 'DON-' || LPAD(nextval('donante_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para Donantes
DROP TRIGGER IF EXISTS trigger_generar_codigo_don ON public.donantes;
CREATE TRIGGER trigger_generar_codigo_don
BEFORE INSERT ON public.donantes
FOR EACH ROW
EXECUTE FUNCTION public.generar_codigo_donante();


-- ==========================================
-- 5. ACTUALIZAR FILAS EXISTENTES (Opcional pero recomendado)
-- ==========================================
-- Dar código a beneficiarios existentes si no tienen
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.beneficiarios WHERE codigo IS NULL LOOP
        UPDATE public.beneficiarios SET codigo = 'BEN-' || LPAD(nextval('beneficiario_seq')::text, 4, '0') WHERE id = r.id;
    END LOOP;
END $$;

-- Dar código a donantes existentes si no tienen
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.donantes WHERE codigo IS NULL LOOP
        UPDATE public.donantes SET codigo = 'DON-' || LPAD(nextval('donante_seq')::text, 4, '0') WHERE id = r.id;
    END LOOP;
END $$;
