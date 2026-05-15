-- Crear tabla de evaluaciones de salud
CREATE TABLE IF NOT EXISTS evaluaciones_salud (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiario_id UUID REFERENCES beneficiarios(id) ON DELETE SET NULL,
    brigadista_id UUID REFERENCES perfiles(id) ON DELETE SET NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_atencion TIME NOT NULL DEFAULT CURRENT_TIME,
    lugar_atencion TEXT NOT NULL,
    
    -- Datos del Paciente (capturados en el momento)
    paciente_ci TEXT NOT NULL,
    paciente_nombre TEXT NOT NULL,
    paciente_direccion TEXT NOT NULL,
    paciente_telefono TEXT,
    paciente_email TEXT,
    
    -- Acompañante
    acompanante_nombre TEXT,
    acompanante_telefono TEXT,
    
    -- Examen Médico
    talla NUMERIC(5,2) NOT NULL, -- en cm o m (usaremos m para IMC)
    peso NUMERIC(5,2) NOT NULL,  -- en kg
    imc NUMERIC(5,2) NOT NULL,
    glucosa NUMERIC(5,2) NOT NULL,
    presion_sistolica INTEGER NOT NULL,
    presion_diastolica INTEGER NOT NULL,
    
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE evaluaciones_salud ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Super Admins pueden ver todas las evaluaciones" 
ON evaluaciones_salud FOR SELECT 
USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'super_admin'));

CREATE POLICY "Brigadistas pueden ver sus propias evaluaciones" 
ON evaluaciones_salud FOR SELECT 
USING (brigadista_id = auth.uid());

CREATE POLICY "Brigadistas pueden insertar evaluaciones" 
ON evaluaciones_salud FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'brigadista') OR EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'super_admin'));

-- Logs de auditoría (opcional, si existe el sistema de auditoría)
-- ...
