import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Camera, Image as ImageIcon, X, AlertCircle, HeartHandshake, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { usePersistentState } from '../../hooks/usePersistentState';
import { getRolLabel } from '../../utils/roles';
import { notificarBitacora } from '../../lib/bitacoras';
import {
  BUCKET_FOTOS, MAX_ACTIVIDADES, MIN_FOTOS, MAX_FOTOS, MENSAJE_CIERRE,
  nuevaActividad, validarActividades, comprimirImagen
} from '../../utils/bitacora';

const capitalizar = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const labelStyle = { fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' };
const campoStyle = { display: 'flex', flexDirection: 'column', gap: '0.4rem' };

// Contenido del modal de cierre de jornada. Solo se monta mientras está abierto,
// así cada apertura arranca con su propia hora de apertura y estado limpio.
const CierreJornadaModal = ({ onClose, onSuccess }) => {
  const { user } = useAuth() || {};

  // Borradores persistentes: si la señal falla o la app se minimiza, no se pierde lo escrito.
  const [actividades, setActividades] = usePersistentState('cierrejornada.actividades', [nuevaActividad()]);
  const [liderId, setLiderId] = usePersistentState('cierrejornada.liderId', '');
  const [formacion, setFormacion] = usePersistentState('cierrejornada.formacion', '');

  const [lideres, setLideres] = useState(null); // null = cargando
  const [fotos, setFotos] = useState([]); // [{ id, blob, url, path? }] (de 1 a 3)
  const fotosRef = useRef([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(null); // { creadaEn } tras registrar
  // Hora del dispositivo al abrir (informativa; la oficial es la del servidor).
  const [abiertaEn] = useState(() => new Date());
  const inputCamara = useRef(null);
  const inputGaleria = useRef(null);

  // Superiores que pueden figurar como líder: super_admin, brigadista y coordinadores.
  useEffect(() => {
    if (!supabase) return;
    let cancelado = false;
    (async () => {
      let { data, error: err } = await supabase
        .from('perfiles')
        .select('id, nombre, email, rol, es_coordinador')
        .or('rol.in.(super_admin,brigadista),es_coordinador.eq.true')
        .order('nombre');
      if (err) {
        // Aún no existe es_coordinador (falta schema_v22): se filtra solo por rol.
        ({ data, error: err } = await supabase
          .from('perfiles')
          .select('id, nombre, email, rol')
          .in('rol', ['super_admin', 'brigadista'])
          .order('nombre'));
      }
      if (cancelado) return;
      if (err) console.error('No se pudo cargar la lista de líderes:', err.message);
      setLideres(err ? [] : data || []);
    })();
    return () => { cancelado = true; };
  }, []);

  // Libera las vistas previas al cerrar el modal.
  useEffect(() => { fotosRef.current = fotos; }, [fotos]);
  useEffect(() => () => { fotosRef.current.forEach(f => URL.revokeObjectURL(f.url)); }, []);

  const actualizarActividad = (id, campo, valor) =>
    setActividades(lista => lista.map(a => (a.id === id ? { ...a, [campo]: valor } : a)));

  const quitarActividad = (id) =>
    setActividades(lista => (lista.length > 1 ? lista.filter(a => a.id !== id) : lista));

  const handleFotos = async (e) => {
    const archivos = Array.from(e.target.files || []);
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (archivos.length === 0) return;

    const libres = MAX_FOTOS - fotos.length;
    const validos = archivos.filter(a => a.type.startsWith('image/'));
    if (validos.length === 0) return setError('Selecciona archivos de imagen.');
    if (libres <= 0) return setError(`Máximo ${MAX_FOTOS} fotos. Quita una para agregar otra.`);

    setError(validos.length > libres ? `Máximo ${MAX_FOTOS} fotos: solo se agregaron ${libres}.` : '');
    try {
      const comprimidas = await Promise.all(validos.slice(0, libres).map(a => comprimirImagen(a)));
      setFotos(prev => [
        ...prev,
        ...comprimidas.slice(0, MAX_FOTOS - prev.length).map(blob => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          blob,
          url: URL.createObjectURL(blob)
        }))
      ]);
    } catch (err) {
      console.error('Error al procesar la foto:', err);
      setError('No se pudo procesar una de las fotos. Prueba con otra.');
    }
  };

  const quitarFoto = (id) => {
    const quitada = fotosRef.current.find(f => f.id === id);
    if (quitada) URL.revokeObjectURL(quitada.url);
    setFotos(prev => prev.filter(f => f.id !== id));
  };

  const reiniciar = () => {
    setActividades([nuevaActividad()]);
    setLiderId('');
    setFormacion('');
    fotosRef.current.forEach(f => URL.revokeObjectURL(f.url));
    setFotos([]);
    setError('');
  };

  const cerrar = () => {
    if (!saving) onClose();
  };

  const handleEnviar = async () => {
    setError('');
    const problema = validarActividades(actividades);
    if (problema) return setError(problema);
    if (!liderId) return setError('Selecciona el líder responsable del grupo.');
    if (fotos.length < MIN_FOTOS) return setError(`Agrega al menos ${MIN_FOTOS} foto (máximo ${MAX_FOTOS}).`);
    if (!supabase || !user) return setError('No hay conexión con la base de datos.');

    setSaving(true);
    try {
      // Cada foto se sube una sola vez: si el envío falla y se reintenta, se reutilizan
      // las rutas de las que ya subieron.
      const subidas = await Promise.all(fotos.map(async (f) => {
        if (f.path) return { foto: f };
        const path = `${user.id}/${f.id}.jpg`;
        const { error: upError } = await supabase.storage
          .from(BUCKET_FOTOS)
          .upload(path, f.blob, { contentType: 'image/jpeg', upsert: false });
        return upError ? { foto: f, upError } : { foto: { ...f, path } };
      }));
      setFotos(subidas.map(r => r.foto));
      const fallida = subidas.find(r => r.upError);
      if (fallida) {
        console.error('Error al subir una foto:', fallida.upError);
        throw new Error('No se pudieron subir todas las fotos. Revisa tu conexión e inténtalo de nuevo.');
      }

      const { data, error: rpcError } = await supabase.rpc('registrar_bitacora', {
        p_abierta_en: abiertaEn.toISOString(),
        p_actividades: actividades.map(a => ({
          descripcion: a.descripcion.trim(),
          hora_inicio: a.hora_inicio,
          hora_fin: a.hora_fin,
          lugar: a.lugar.trim()
        })),
        p_lider_id: liderId,
        p_fotos: subidas.map(r => r.foto.path),
        p_formacion: formacion.trim() || null
      });

      if (rpcError) {
        console.error('Error al registrar la bitácora:', rpcError);
        if (rpcError.code === 'PGRST202') {
          throw new Error('El registro de jornadas necesita una actualización de la base de datos (schema_v26.sql). Avisa al administrador.');
        }
        if (rpcError.code === '42501') {
          throw new Error('Solo los voluntarios pueden registrar una bitácora.');
        }
        throw new Error(
          rpcError.code === '22023'
            ? 'Revisa los datos: alguna actividad, el líder o las fotos no son válidos.'
            : 'No se pudo registrar la bitácora. Inténtalo de nuevo.'
        );
      }

      const registro = Array.isArray(data) ? data[0] : data;
      // Aviso a Discord con las fotos: en segundo plano, nunca bloquea ni falla el cierre.
      if (registro?.bitacora_id) void notificarBitacora(registro.bitacora_id);
      reiniciar();
      setEnviado({ creadaEn: registro?.creada_en ? new Date(registro.creada_en) : new Date() });
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || 'No se pudo registrar la bitácora.');
    } finally {
      setSaving(false);
    }
  };

  const fechaApertura = capitalizar(abiertaEn.toLocaleString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }));

  return (
    <Modal
      isOpen
      onClose={cerrar}
      title={enviado ? 'Jornada registrada' : 'Cierre de Jornada'}
      footer={
        enviado ? (
          <Button type="button" variant="primary" onClick={cerrar}>Listo</Button>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={cerrar} disabled={saving}>Cancelar</Button>
            <Button type="button" variant="primary" onClick={handleEnviar} disabled={saving}>
              {saving ? 'Enviando...' : 'Enviar bitácora'}
            </Button>
          </>
        )
      }
    >
      {enviado ? (
        <div style={{ textAlign: 'center', padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HeartHandshake size={30} />
          </div>
          <p style={{ fontSize: '1.05rem', fontWeight: '700', lineHeight: 1.5, color: 'var(--text-primary)', margin: 0 }}>
            {MENSAJE_CIERRE}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: 0 }}>
            Registrada el {enviado.creadaEn.toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.
            Tu coordinador la revisará.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {error && (
            <div role="alert" style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Registro automático de fecha y hora */}
          <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <Clock size={18} style={{ color: '#7c3aed', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{fechaApertura}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
                Fecha y hora automáticas. Al enviar queda el registro oficial y no se puede modificar.
              </div>
            </div>
          </div>

          {/* 2. Actividades (1 a N) */}
          <div style={campoStyle}>
            <span style={labelStyle}>Actividades de la jornada <span style={{ color: 'var(--danger-color)' }}>*</span></span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {actividades.map((a, i) => (
                <div key={a.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase' }}>Actividad {i + 1}</span>
                    {actividades.length > 1 && (
                      <button type="button" onClick={() => quitarActividad(a.id)} disabled={saving} aria-label={`Quitar actividad ${i + 1}`} title="Quitar actividad"
                        style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '2px', display: 'flex' }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <input
                    className="input-field"
                    style={{ marginBottom: 0 }}
                    value={a.descripcion}
                    onChange={e => actualizarActividad(a.id, 'descripcion', e.target.value)}
                    placeholder="Ej. Capacitación Unidad Educativa"
                    maxLength={300}
                    disabled={saving}
                    aria-label={`Descripción de la actividad ${i + 1}`}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
                    <label style={{ ...campoStyle, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      Hora de inicio
                      <input type="time" className="input-field" style={{ marginBottom: 0 }} value={a.hora_inicio}
                        onChange={e => actualizarActividad(a.id, 'hora_inicio', e.target.value)} disabled={saving} />
                    </label>
                    <label style={{ ...campoStyle, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      Hora de fin
                      <input type="time" className="input-field" style={{ marginBottom: 0 }} value={a.hora_fin}
                        onChange={e => actualizarActividad(a.id, 'hora_fin', e.target.value)} disabled={saving} />
                    </label>
                  </div>
                  <input
                    className="input-field"
                    style={{ marginBottom: 0 }}
                    value={a.lugar}
                    onChange={e => actualizarActividad(a.id, 'lugar', e.target.value)}
                    placeholder="Lugar. Ej. Alpachaca/Ecuador"
                    maxLength={200}
                    disabled={saving}
                    aria-label={`Lugar de la actividad ${i + 1}`}
                  />
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={() => setActividades(l => [...l, nuevaActividad()])}
              disabled={saving || actividades.length >= MAX_ACTIVIDADES}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={16} /> Agregar actividad
            </Button>
          </div>

          {/* 3. Líder responsable */}
          <div style={campoStyle}>
            <label htmlFor="cj-lider" style={labelStyle}>Líder responsable del grupo <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <select id="cj-lider" className="input-field" style={{ marginBottom: 0 }} value={liderId}
              onChange={e => setLiderId(e.target.value)} disabled={saving || lideres === null}>
              <option value="" disabled>{lideres === null ? 'Cargando...' : 'Selecciona a tu superior a cargo'}</option>
              {(lideres || []).map(l => (
                <option key={l.id} value={l.id}>
                  {l.nombre || l.email} · {l.es_coordinador ? 'Coordinador' : getRolLabel(l.rol)}
                </option>
              ))}
            </select>
            {lideres !== null && lideres.length === 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--danger-color)' }}>
                No se encontraron líderes disponibles. Avisa al administrador.
              </span>
            )}
          </div>

          {/* 4. Momento feliz: de 1 a 3 fotos */}
          <div style={campoStyle}>
            <span style={labelStyle}>
              Momento feliz del día <span style={{ color: 'var(--danger-color)' }}>*</span>{' '}
              <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>({fotos.length} de {MAX_FOTOS} fotos)</span>
            </span>
            {fotos.length > 0 && (
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                {fotos.map((f, i) => (
                  <div key={f.id} style={{ position: 'relative' }}>
                    <img src={f.url} alt={`Vista previa de la foto ${i + 1}`}
                      style={{ width: '104px', height: '104px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'block' }} />
                    <button type="button" onClick={() => quitarFoto(f.id)} disabled={saving} aria-label={`Quitar foto ${i + 1}`} title="Quitar foto"
                      style={{ position: 'absolute', top: '4px', right: '4px', width: '26px', height: '26px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {fotos.length < MAX_FOTOS && (
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                <Button type="button" variant="outline" onClick={() => inputCamara.current?.click()} disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Camera size={16} /> Tomar foto
                </Button>
                <Button type="button" variant="outline" onClick={() => inputGaleria.current?.click()} disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ImageIcon size={16} /> Elegir de la galería
                </Button>
              </div>
            )}
            <input ref={inputCamara} type="file" accept="image/*" capture="environment" onChange={handleFotos} style={{ display: 'none' }} />
            <input ref={inputGaleria} type="file" accept="image/*" multiple onChange={handleFotos} style={{ display: 'none' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Sube entre {MIN_FOTOS} y {MAX_FOTOS} fotos. Cuida la privacidad: evita fotos donde se vean documentos o datos de beneficiarios.
              La coordinación las recibe en su canal de Discord.
            </span>
          </div>

          {/* 5. Formación continua */}
          <div style={campoStyle}>
            <label htmlFor="cj-formacion" style={labelStyle}>Formación continua <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(opcional)</span></label>
            <textarea id="cj-formacion" className="input-field" style={{ marginBottom: 0, resize: 'vertical' }} rows={3}
              value={formacion} onChange={e => setFormacion(e.target.value)} maxLength={1000} disabled={saving}
              placeholder="¿Qué aprendiste hoy? Cuéntanos las lecciones o cápsulas de aprendizaje que completaste." />
          </div>

          {/* 6. Mensaje de cierre */}
          <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
            {MENSAJE_CIERRE}
          </p>
        </div>
      )}
    </Modal>
  );
};

// Modal de cierre de jornada del voluntario. Registra una bitácora con sus
// actividades (1 a N), líder responsable, foto opcional y formación continua.
// El timestamp oficial lo fija la base de datos al enviar (registrar_bitacora).
export const CierreJornada = ({ isOpen, ...props }) =>
  isOpen ? <CierreJornadaModal {...props} /> : null;
