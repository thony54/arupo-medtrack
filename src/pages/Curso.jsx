import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Check, Lock, Play, Award, Download, AlertCircle, CalendarDays } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n/useI18n';
import { Button } from '../components/ui/Button';
import { LeccionPlayer } from '../components/curso/LeccionPlayer';
import { BLOQUES } from '../curso/plan';
import { calcularCalendario, estadoUnidad, contarAtrasadas, certificadoDisponible, cursoCompleto } from '../curso/calendario';
import { leccionesDe } from '../curso/contenido';
import { generarCertificado } from '../curso/certificado';
import { cargarProgreso, guardarLeccion } from '../lib/curso';
import { estanciaDisponible, formatEstancia } from '../utils/estancia';
import { tEs } from '../i18n/tEs';
import './pages.css';

const DESPLAZAMIENTOS = [0, 34, 56, 34]; // zigzag del camino de lecciones (px)

const ESTILO_ESTADO = {
  completada: { color: 'var(--success-color)', bg: 'var(--success-bg)' },
  en_curso: { color: '#7c3aed', bg: '#ede9fe' },
  atrasada: { color: 'var(--warning-color)', bg: 'var(--warning-bg)' },
  proxima: { color: 'var(--text-tertiary)', bg: 'var(--bg-surface-hover)' },
  sin_contenido: { color: 'var(--text-tertiary)', bg: 'var(--bg-surface-hover)' }
};

// Curso de español opcional del voluntario: línea de tiempo con las 12 unidades, ajustada
// a la duración de su estancia, y certificado al terminar el voluntariado.
export const Curso = () => {
  const { user, profile } = useAuth();
  const { t, idioma, local, formatearFecha } = useI18n();
  const navigate = useNavigate();
  const userId = user?.id;

  const [progreso, setProgreso] = useState(null); // null = cargando
  const [fallo, setFallo] = useState(false);
  const [abierta, setAbierta] = useState(null); // lección abierta en el reproductor
  const [descargando, setDescargando] = useState(false);
  const [errorCertificado, setErrorCertificado] = useState(false);
  const [ahora] = useState(() => new Date());

  useEffect(() => {
    if (!userId) return;
    let cancelado = false;
    cargarProgreso(userId)
      .then((p) => { if (!cancelado) setProgreso(p); })
      .catch((err) => {
        console.error('Error al cargar el progreso del curso:', err);
        if (!cancelado) setFallo(true);
      });
    return () => { cancelado = true; };
  }, [userId]);

  const inicioEstancia = profile?.fecha_inicio_estancia;
  const mesesEstancia = profile?.tiempo_estancia_meses;
  const tieneEstancia = estanciaDisponible(profile) && mesesEstancia != null && !!inicioEstancia;
  const calendario = useMemo(
    () => (tieneEstancia ? calcularCalendario(inicioEstancia, mesesEstancia) : null),
    [tieneEstancia, inicioEstancia, mesesEstancia]
  );

  const completadas = progreso?.completadas;
  const vista = useMemo(() => {
    if (!calendario || !completadas) return null;
    const unidades = calendario.unidades.map((u) => {
      const lecciones = leccionesDe(u.id);
      return { ...u, lecciones, estado: estadoUnidad({ unidad: u, lecciones, completadas, ahora }) };
    });
    const planas = unidades.flatMap((u) => u.lecciones.map((l) => l.id));
    const primeraPendiente = planas.findIndex((id) => !completadas.has(id));
    const estados = unidades.map((u) => u.estado);
    return {
      unidades,
      estados,
      totalLecciones: planas.length,
      hechas: planas.filter((id) => completadas.has(id)).length,
      accesible: (id) => primeraPendiente === -1 || planas.indexOf(id) <= primeraPendiente,
      atrasadas: contarAtrasadas(estados),
      completo: cursoCompleto(estados),
      certificadoOk: certificadoDisponible({ estados, fin: calendario.fin, ahora })
    };
  }, [calendario, completadas, ahora]);

  const terminarLeccion = async (puntaje) => {
    const res = await guardarLeccion(abierta.id, puntaje);
    if (res.ok) {
      setProgreso((p) => ({
        ...p,
        completadas: new Set(p.completadas).add(abierta.id),
        puntajes: new Map(p.puntajes).set(abierta.id, Math.max(p.puntajes.get(abierta.id) || 0, puntaje))
      }));
    }
    return res;
  };

  const descargarCertificado = async () => {
    setDescargando(true);
    setErrorCertificado(false);
    try {
      await generarCertificado({
        nombre: profile?.nombre,
        userId,
        inicio: calendario.inicio,
        fin: calendario.fin,
        duracionEs: formatEstancia(profile.tiempo_estancia_meses, tEs),
        duracionLocal: formatEstancia(profile.tiempo_estancia_meses, t),
        t, idioma, local
      });
    } catch (err) {
      console.error('Error al generar el certificado:', err);
      setErrorCertificado(true);
    } finally {
      setDescargando(false);
    }
  };

  const ventana = (desde, hasta) => t('curso.ventana', {
    inicio: formatearFecha(desde, { day: 'numeric', month: 'short' }),
    fin: formatearFecha(hasta, { day: 'numeric', month: 'short', year: 'numeric' })
  });

  const porcentaje = vista && vista.totalLecciones > 0 ? Math.round((vista.hechas / vista.totalLecciones) * 100) : 0;

  return (
    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '820px', margin: '0 auto', paddingBottom: '3rem' }}>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
              <GraduationCap size={28} style={{ color: '#7c3aed' }} /> {t('curso.titulo')}
            </h1>
            {/* Fuera del h1: el título usa texto con degradado y la insignia heredaría el relleno transparente */}
            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px', background: '#ede9fe', color: '#7c3aed', textTransform: 'uppercase' }}>{t('curso.opcional')}</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{t('curso.subtitulo')}</p>
        </div>
      </div>

      {fallo ? (
        <div role="alert" className="card" style={{ padding: '1rem', color: 'var(--danger-color)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <AlertCircle size={16} /> {t('curso.err_cargar')}
        </div>
      ) : !tieneEstancia ? (
        <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', alignItems: 'flex-start' }}>
          <CalendarDays size={32} style={{ color: '#7c3aed' }} />
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{t('curso.sin_estancia_titulo')}</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem' }}>{t('curso.sin_estancia_texto')}</p>
          <Button type="button" variant="primary" onClick={() => navigate('/perfil', { state: { tab: 'editar' } })}>{t('curso.sin_estancia_boton')}</Button>
        </div>
      ) : progreso === null ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('comun.cargando')}</div>
      ) : !progreso.activo ? (
        <div className="card" style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>{t('curso.inactivo')}</div>
      ) : vista && (
        <>
          {/* Resumen de tu ruta */}
          <section className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('curso.tu_ruta')}</div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                {t('curso.ruta_detalle', {
                  duracion: formatEstancia(profile.tiempo_estancia_meses, t),
                  inicio: formatearFecha(calendario.inicio, { day: 'numeric', month: 'long', year: 'numeric' }),
                  fin: formatearFecha(calendario.fin, { day: 'numeric', month: 'long', year: 'numeric' })
                })}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                <span>{t('curso.progreso', { hechas: vista.hechas, total: vista.totalLecciones })}</span>
                <span>{porcentaje}%</span>
              </div>
              <div style={{ height: '10px', background: 'var(--border-color)', borderRadius: '999px', overflow: 'hidden' }} role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
                <div style={{ width: `${porcentaje}%`, height: '100%', background: 'linear-gradient(90deg,#7c3aed,#a855f7)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <span style={{ color: vista.atrasadas > 0 ? 'var(--warning-color)' : 'var(--success-color)', fontWeight: 700 }}>
                {vista.atrasadas === 0 ? t('curso.ritmo_al_dia') : t(`curso.ritmo_atrasado_${vista.atrasadas === 1 ? 'uno' : 'otros'}`, { n: vista.atrasadas })}
              </span>
              {vista.estados.includes('sin_contenido') && (
                <span style={{ color: 'var(--text-tertiary)' }}>{t('curso.contenido_pendiente')}</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '0.9rem' }}>
              <Award size={22} style={{ color: '#d97706', flexShrink: 0 }} />
              <div style={{ flex: '1 1 220px', fontSize: '0.88rem' }}>
                <strong>{t('curso.cert_titulo')}</strong>
                <div style={{ color: 'var(--text-secondary)' }}>
                  {vista.certificadoOk
                    ? t('curso.cert_listo')
                    : vista.completo
                      ? t('curso.cert_fecha', { fecha: formatearFecha(calendario.fin, { day: 'numeric', month: 'long', year: 'numeric' }) })
                      : t('curso.cert_pendiente', { fecha: formatearFecha(calendario.fin, { day: 'numeric', month: 'long', year: 'numeric' }) })}
                </div>
              </div>
              {vista.certificadoOk && (
                <Button type="button" variant="primary" onClick={descargarCertificado} disabled={descargando}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Download size={16} /> {descargando ? t('curso.cert_generando') : t('curso.cert_descargar')}
                </Button>
              )}
            </div>
            {errorCertificado && <span role="alert" style={{ color: 'var(--danger-color)', fontSize: '0.82rem' }}>{t('curso.cert_error')}</span>}
          </section>

          {/* Línea de tiempo por bloques */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {BLOQUES.map((bloque) => {
              const uns = vista.unidades.filter((u) => u.bloque === bloque.id);
              return (
                <section key={bloque.id}>
                  <div style={{ marginBottom: '0.9rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{t(`curso.bloque_${bloque.id}`)}</h2>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                      {t(`curso.bloque_${bloque.id}_sub`)} · {ventana(uns[0].desde, uns[uns.length - 1].hasta)}
                    </div>
                  </div>

                  <ol style={{ listStyle: 'none', margin: 0, padding: '0 0 0 1.1rem', borderLeft: '3px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                    {uns.map((u) => {
                      const est = ESTILO_ESTADO[u.estado];
                      return (
                        <li key={u.id} style={{ position: 'relative' }}>
                          <span aria-hidden="true" style={{ position: 'absolute', left: 'calc(-1.1rem - 8px)', top: '0.9rem', width: '13px', height: '13px', borderRadius: '50%', background: est.color, border: '2px solid var(--bg-surface)' }} />
                          <div className="card" style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                              <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>{t('curso.unidad_n', { n: u.id })}</div>
                                <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>{t(`curso.u${u.id}`)}</div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>{ventana(u.desde, u.hasta)}</div>
                              </div>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: est.bg, color: est.color, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                {t(`curso.estado_${u.estado}`)}
                              </span>
                            </div>

                            {u.lecciones.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', padding: '0.25rem 0' }}>
                                {u.lecciones.map((l, i) => {
                                  const hecha = completadas.has(l.id);
                                  const abierto = vista.accesible(l.id);
                                  const puntaje = progreso.puntajes.get(l.id);
                                  return (
                                    <button key={l.id} type="button" disabled={!abierto} onClick={() => setAbierta(l)}
                                      aria-label={`${l.titulo}${hecha ? ` · ${t('curso.estado_completada')}` : abierto ? '' : ` · ${t('curso.bloqueada')}`}`}
                                      style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginLeft: `${DESPLAZAMIENTOS[i % DESPLAZAMIENTOS.length]}px`, background: 'none', border: 'none', padding: 0, cursor: abierto ? 'pointer' : 'not-allowed', textAlign: 'left', opacity: abierto ? 1 : 0.55 }}>
                                      <span style={{ width: '54px', height: '54px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: hecha ? 'var(--success-color)' : abierto ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : '#94a3b8', boxShadow: abierto && !hecha ? '0 0 0 5px rgba(124,58,237,0.18)' : 'none', borderBottom: `4px solid ${hecha ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.2)'}` }}>
                                        {hecha ? <Check size={24} strokeWidth={3} /> : abierto ? <Play size={22} fill="#fff" /> : <Lock size={20} />}
                                      </span>
                                      <span>
                                        <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--text-primary)' }}>{l.titulo}</strong>
                                        <span style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                                          {hecha ? `${t('curso.repasar')} · ${t('curso.puntaje', { n: puntaje ?? 0 })}` : abierto ? t('curso.empezar') : t('curso.bloqueada')}
                                        </span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              );
            })}
          </div>
        </>
      )}

      {abierta && (
        <LeccionPlayer leccion={abierta} onTerminar={terminarLeccion} onSalir={() => setAbierta(null)} />
      )}
    </div>
  );
};
