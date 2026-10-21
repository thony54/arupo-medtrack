import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Camera, Image as ImageIcon, X, AlertCircle, HeartHandshake, Clock, GraduationCap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useI18n } from '../../i18n/useI18n';
import { notificarBitacora } from '../../lib/bitacoras';
import { cargarLeccionesDesde } from '../../lib/curso';
import { leccionPorId, textoLocal } from '../../curso/contenido';
import {
  BUCKET_FOTOS, MAX_ACTIVIDADES, MIN_FOTOS, MAX_FOTOS, MAX_FORMACION, DIAS_LECCIONES_SUGERIDAS,
  nuevaActividad, validarActividades, comprimirImagen, armarFormacionContinua
} from '../../utils/bitacora';

const capitalizar = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const labelStyle = { fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' };
const campoStyle = { display: 'flex', flexDirection: 'column', gap: '0.4rem' };

// Contenido del modal de cierre de jornada. Solo se monta mientras está abierto,
// así cada apertura arranca con su propia hora de apertura y estado limpio.
const CierreJornadaModal = ({ onClose, onSuccess }) => {
  const { user, profile } = useAuth() || {};
  const { t, idioma, formatearFechaHora } = useI18n();

  // Borradores persistentes: si la señal falla o la app se minimiza, no se pierde lo escrito.
  const [actividades, setActividades] = usePersistentState('cierrejornada.actividades', [nuevaActividad()]);
  const [liderId, setLiderId] = usePersistentState('cierrejornada.liderId', '');
  const [formacion, setFormacion] = usePersistentState('cierrejornada.formacion', '');

  // Lecciones del curso trabajadas desde la última jornada, sugeridas como formación continua.
  const [recientes, setRecientes] = useState([]); // [{ id, unidadId, tituloEs, titulo }]
  const [elegidas, setElegidas] = useState([]); // ids marcados

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

  // Líderes que se pueden elegir: solo los que la coordinación designa en Equipos (es_lider).
  // Sin respaldo por rol: registrar_bitacora rechaza a quien no sea es_lider.
  useEffect(() => {
    if (!supabase) return;
    let cancelado = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('perfiles')
        .select('id, nombre, email')
        .eq('es_lider', true)
        .order('nombre');
      if (cancelado) return;
      if (err) console.error('No se pudo cargar la lista de líderes:', err.message);
      const lista = err ? [] : data || [];
      setLideres(lista);
      // Si la coordinación le asignó un líder y no hay borrador, se propone ese.
      if (profile?.lider_id && lista.some(l => l.id === profile.lider_id)) {
        setLiderId(actual => actual || profile.lider_id);
      }
    })();
    return () => { cancelado = true; };
    // profile?.lider_id solo se lee al abrir el modal; no debe relanzar la carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sugiere las lecciones del curso hechas desde la última jornada (con un tope de días),
  // ya marcadas. Es solo una ayuda: si falla o el curso no está activo, no se muestra nada.
  useEffect(() => {
    if (!supabase || !user?.id) return;
    let cancelado = false;
    (async () => {
      const { data } = await supabase
        .from('bitacoras')
        .select('created_at')
        .eq('voluntario_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const tope = Date.now() - DIAS_LECCIONES_SUGERIDAS * 24 * 60 * 60 * 1000;
      const ultima = data?.[0]?.created_at ? new Date(data[0].created_at).getTime() : 0;
      const ids = await cargarLeccionesDesde(user.id, new Date(Math.max(tope, ultima)).toISOString());
      if (cancelado) return;
      const lista = ids
        .map(id => {
          const l = leccionPorId(id);
          return l && { id, unidadId: l.unidadId, tituloEs: textoLocal(l.titulo, 'es'), titulo: textoLocal(l.titulo, idioma) };
        })
        .filter(Boolean);
      setRecientes(lista);
      setElegidas(lista.map(l => l.id));
    })().catch(err => console.warn('No se pudieron sugerir lecciones para la bitácora:', err));
    return () => { cancelado = true; };
    // Solo al abrir el modal; cambiar de idioma no debe volver a marcar lo que ya se desmarcó.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
    if (validos.length === 0) return setError(t('cierre.err_imagenes'));
    if (libres <= 0) return setError(t('cierre.err_max_fotos', { max: MAX_FOTOS }));

    setError(validos.length > libres ? t('cierre.err_max_fotos_agregadas', { max: MAX_FOTOS, n: libres }) : '');
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
      setError(t('cierre.err_foto_proceso'));
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
    setElegidas([]);
    fotosRef.current.forEach(f => URL.revokeObjectURL(f.url));
    setFotos([]);
    setError('');
  };

  const cerrar = () => {
    if (!saving) onClose();
  };

  const handleEnviar = async () => {
    setError('');
    const problema = validarActividades(actividades, t);
    if (problema) return setError(problema);
    if (!liderId) return setError(t('cierre.err_lider'));
    if (fotos.length < MIN_FOTOS) return setError(t('cierre.err_fotos_min', { min: MIN_FOTOS, max: MAX_FOTOS }));
    if (!supabase || !user) return setError(t('cierre.err_sin_conexion'));
    const formacionFinal = armarFormacionContinua(recientes.filter(l => elegidas.includes(l.id)).map(l => ({ titulo: l.tituloEs, unidadId: l.unidadId })), formacion);
    if (formacionFinal.length > MAX_FORMACION) return setError(t('cierre.err_formacion_larga', { max: MAX_FORMACION }));

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
        throw new Error(t('cierre.err_subida'));
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
        p_formacion: formacionFinal || null
      });

      if (rpcError) {
        console.error('Error al registrar la bitácora:', rpcError);
        if (rpcError.code === 'PGRST202') {
          throw new Error(t('cierre.err_modulo'));
        }
        if (rpcError.code === '42501') {
          throw new Error(t('cierre.err_solo_voluntarios'));
        }
        throw new Error(
          rpcError.code === '22023'
            ? t('cierre.err_datos')
            : t('cierre.err_registrar')
        );
      }

      const registro = Array.isArray(data) ? data[0] : data;
      // Aviso a Discord con las fotos: en segundo plano, nunca bloquea ni falla el cierre.
      if (registro?.bitacora_id) void notificarBitacora(registro.bitacora_id);
      reiniciar();
      setEnviado({ creadaEn: registro?.creada_en ? new Date(registro.creada_en) : new Date() });
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || t('cierre.err_registrar'));
    } finally {
      setSaving(false);
    }
  };

  const fechaApertura = capitalizar(formatearFechaHora(abiertaEn, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }));

  return (
    <Modal
      isOpen
      onClose={cerrar}
      title={enviado ? t('cierre.titulo_listo') : t('cierre.titulo')}
      footer={
        enviado ? (
          <Button type="button" variant="primary" onClick={cerrar}>{t('cierre.listo')}</Button>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={cerrar} disabled={saving}>{t('comun.cancelar')}</Button>
            <Button type="button" variant="primary" onClick={handleEnviar} disabled={saving}>
              {saving ? t('cierre.enviando') : t('cierre.enviar')}
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
            {t('cierre.mensaje')}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: 0 }}>
            {t('cierre.registrada', { fecha: formatearFechaHora(enviado.creadaEn, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) })}
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
                {t('cierre.fecha_auto')}
              </div>
            </div>
          </div>

          {/* 2. Actividades (1 a N) */}
          <div style={campoStyle}>
            <span style={labelStyle}>{t('cierre.actividades')} <span style={{ color: 'var(--danger-color)' }}>*</span></span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {actividades.map((a, i) => (
                <div key={a.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase' }}>{t('cierre.actividad_n', { n: i + 1 })}</span>
                    {actividades.length > 1 && (
                      <button type="button" onClick={() => quitarActividad(a.id)} disabled={saving} aria-label={t('cierre.quitar_actividad_n', { n: i + 1 })} title={t('cierre.quitar_actividad')}
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
                    placeholder={t('cierre.ph_actividad')}
                    maxLength={300}
                    disabled={saving}
                    aria-label={t('cierre.descripcion_n', { n: i + 1 })}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
                    <label style={{ ...campoStyle, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      {t('cierre.hora_inicio')}
                      <input type="time" className="input-field" style={{ marginBottom: 0 }} value={a.hora_inicio}
                        onChange={e => actualizarActividad(a.id, 'hora_inicio', e.target.value)} disabled={saving} />
                    </label>
                    <label style={{ ...campoStyle, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      {t('cierre.hora_fin')}
                      <input type="time" className="input-field" style={{ marginBottom: 0 }} value={a.hora_fin}
                        onChange={e => actualizarActividad(a.id, 'hora_fin', e.target.value)} disabled={saving} />
                    </label>
                  </div>
                  <input
                    className="input-field"
                    style={{ marginBottom: 0 }}
                    value={a.lugar}
                    onChange={e => actualizarActividad(a.id, 'lugar', e.target.value)}
                    placeholder={t('cierre.ph_lugar')}
                    maxLength={200}
                    disabled={saving}
                    aria-label={t('cierre.lugar_n', { n: i + 1 })}
                  />
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={() => setActividades(l => [...l, nuevaActividad()])}
              disabled={saving || actividades.length >= MAX_ACTIVIDADES}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={16} /> {t('cierre.agregar_actividad')}
            </Button>
          </div>

          {/* 3. Líder responsable */}
          <div style={campoStyle}>
            <label htmlFor="cj-lider" style={labelStyle}>{t('cierre.lider')} <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <select id="cj-lider" className="input-field" style={{ marginBottom: 0 }} value={liderId}
              onChange={e => setLiderId(e.target.value)} disabled={saving || lideres === null}>
              <option value="" disabled>{lideres === null ? t('comun.cargando') : t('cierre.lider_placeholder')}</option>
              {(lideres || []).map(l => (
                <option key={l.id} value={l.id}>
                  {l.nombre?.trim() || (l.email || '').split('@')[0]}
                </option>
              ))}
            </select>
            {lideres !== null && lideres.length === 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--danger-color)' }}>
                {t('cierre.sin_lideres')}
              </span>
            )}
          </div>

          {/* 4. Momento feliz: de 1 a 3 fotos */}
          <div style={campoStyle}>
            <span style={labelStyle}>
              {t('cierre.momento_feliz')} <span style={{ color: 'var(--danger-color)' }}>*</span>{' '}
              <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>({t('cierre.fotos_contador', { n: fotos.length, max: MAX_FOTOS })})</span>
            </span>
            {fotos.length > 0 && (
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                {fotos.map((f, i) => (
                  <div key={f.id} style={{ position: 'relative' }}>
                    <img src={f.url} alt={t('cierre.vista_previa_n', { n: i + 1 })}
                      style={{ width: '104px', height: '104px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'block' }} />
                    <button type="button" onClick={() => quitarFoto(f.id)} disabled={saving} aria-label={t('cierre.quitar_foto_n', { n: i + 1 })} title={t('cierre.quitar_foto')}
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
                  <Camera size={16} /> {t('cierre.tomar_foto')}
                </Button>
                <Button type="button" variant="outline" onClick={() => inputGaleria.current?.click()} disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ImageIcon size={16} /> {t('cierre.elegir_galeria')}
                </Button>
              </div>
            )}
            <input ref={inputCamara} type="file" accept="image/*" capture="environment" onChange={handleFotos} style={{ display: 'none' }} />
            <input ref={inputGaleria} type="file" accept="image/*" multiple onChange={handleFotos} style={{ display: 'none' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              {t('cierre.fotos_ayuda', { min: MIN_FOTOS, max: MAX_FOTOS })}
            </span>
          </div>

          {/* 5. Formación continua */}
          <div style={campoStyle}>
            <label htmlFor="cj-formacion" style={labelStyle}>{t('cierre.formacion')} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>({t('comun.opcional')})</span></label>
            {recientes.length > 0 && (
              <fieldset disabled={saving} style={{ margin: 0, padding: '0.75rem 0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <legend style={{ fontSize: '0.78rem', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', padding: '0 0.35rem' }}>
                  <GraduationCap size={13} style={{ verticalAlign: '-2px' }} /> {t('cierre.formacion_cursos')}
                </legend>
                {recientes.map(l => (
                  <label key={l.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', fontSize: '0.88rem', cursor: 'pointer' }}>
                    <input type="checkbox" style={{ marginTop: '3px' }} checked={elegidas.includes(l.id)}
                      onChange={e => setElegidas(prev => (e.target.checked ? [...prev, l.id] : prev.filter(id => id !== l.id)))} />
                    <span>
                      {l.titulo}
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{t('curso.unidad_n', { n: l.unidadId })} · {t(`curso.u${l.unidadId}`)}</span>
                    </span>
                  </label>
                ))}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{t('cierre.formacion_ayuda')}</span>
              </fieldset>
            )}
            <textarea id="cj-formacion" className="input-field" style={{ marginBottom: 0, resize: 'vertical' }} rows={3}
              value={formacion} onChange={e => setFormacion(e.target.value)} maxLength={MAX_FORMACION} disabled={saving}
              aria-label={recientes.length > 0 ? t('cierre.formacion_otra') : t('cierre.formacion')}
              placeholder={recientes.length > 0 ? t('cierre.ph_formacion_otra') : t('cierre.ph_formacion')} />
          </div>

          {/* 6. Mensaje de cierre */}
          <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
            {t('cierre.mensaje')}
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
