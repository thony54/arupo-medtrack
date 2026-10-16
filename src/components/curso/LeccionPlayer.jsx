import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Volume2, Check, XCircle, PartyPopper, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { Button } from '../ui/Button';
import { textoLocal } from '../../curso/contenido';

// ─────────────────────────────────────────────────────────────────────────────
// Reproductor de una lección: una secuencia de ejercicios al estilo Duolingo
// (sin gemas ni vidas). Lo que se falla se repite al final; la lección termina cuando
// todo queda bien y el puntaje es el % respondido bien al primer intento.
// ─────────────────────────────────────────────────────────────────────────────

const barajar = (lista) => {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

// Lee un texto en voz alta con la voz en español del dispositivo (si existe).
const hablar = (texto) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  try {
    window.speechSynthesis.cancel();
    const voces = window.speechSynthesis.getVoices();
    const voz = voces.find(v => v.lang.toLowerCase().startsWith('es-ec')) || voces.find(v => v.lang.toLowerCase().startsWith('es'));
    const u = new SpeechSynthesisUtterance(texto);
    if (voz) u.voice = voz;
    u.lang = voz?.lang || 'es-ES';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
};

const estiloOpcion = (estado) => ({
  display: 'block', width: '100%', textAlign: 'left', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.98rem', fontWeight: 600, cursor: estado === 'bloqueada' ? 'default' : 'pointer',
  border: `2px solid ${estado === 'correcta' ? 'var(--success-color)' : estado === 'incorrecta' ? 'var(--danger-color)' : estado === 'elegida' ? '#7c3aed' : 'var(--border-color)'}`,
  background: estado === 'correcta' ? 'var(--success-bg)' : estado === 'incorrecta' ? 'var(--danger-bg)' : estado === 'elegida' ? '#ede9fe' : 'var(--bg-surface)',
  color: 'var(--text-primary)', transition: 'all 0.15s ease'
});

// Ejercicio de opción única: opcion, escuchar y completar. Se monta de nuevo por ejercicio
// (key), así el orden barajado de las opciones cambia cada vez.
const EjercicioOpciones = ({ ej, idioma, fase, onResponder }) => {
  const { t } = useI18n();
  const [elegida, setElegida] = useState(null);
  const orden = useMemo(() => barajar(ej.opciones.map((_, i) => i)), [ej]);
  const [sinAudio, setSinAudio] = useState(false);
  const respondido = fase === 'feedback';

  const correcta = ej.correcta;
  const comprobar = () => onResponder(elegida === correcta);

  const titulo = ej.tipo === 'escuchar' ? t('curso.t_escuchar') : ej.tipo === 'completar' ? t('curso.t_completar') : t('curso.t_opcion');
  const partes = ej.tipo === 'completar' ? String(ej.frase).split('___') : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>{titulo}</h2>

      {ej.tipo === 'escuchar' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Button type="button" variant="primary" onClick={() => setSinAudio(!hablar(ej.audio))}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.9rem 1.2rem' }}>
            <Volume2 size={22} /> {t('curso.escuchar')}
          </Button>
          {sinAudio && <span style={{ fontSize: '0.8rem', color: 'var(--danger-color)' }}>{t('curso.sin_audio')}</span>}
        </div>
      ) : ej.tipo === 'completar' ? (
        <p style={{ fontSize: '1.15rem', margin: 0, lineHeight: 1.7 }}>
          {partes[0]}
          <span style={{ display: 'inline-block', minWidth: '5rem', borderBottom: '2px solid #7c3aed', textAlign: 'center', fontWeight: 800, color: '#7c3aed' }}>
            {elegida !== null ? textoLocal(ej.opciones[elegida], idioma) : ' '}
          </span>
          {partes[1]}
        </p>
      ) : (
        <p style={{ fontSize: '1.1rem', margin: 0 }}>{textoLocal(ej.pregunta, idioma)}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {orden.map(i => {
          let estado = elegida === i ? 'elegida' : 'normal';
          if (respondido) {
            if (i === correcta) estado = 'correcta';
            else if (i === elegida) estado = 'incorrecta';
            else estado = 'bloqueada';
          }
          return (
            <button key={i} type="button" disabled={respondido} onClick={() => setElegida(i)} style={estiloOpcion(estado)}>
              {textoLocal(ej.opciones[i], idioma)}
            </button>
          );
        })}
      </div>

      {!respondido && (
        <Button type="button" variant="primary" onClick={comprobar} disabled={elegida === null}
          style={{ alignSelf: 'stretch', padding: '0.85rem', fontWeight: 800 }}>
          {t('curso.comprobar')}
        </Button>
      )}
    </div>
  );
};

// Emparejar: se elige un elemento de cada columna; un par correcto se bloquea. Si hay
// algún fallo, el ejercicio cuenta como fallado (se repite al final).
const EjercicioEmparejar = ({ ej, idioma, onResponder }) => {
  const { t } = useI18n();
  const izquierda = useMemo(() => barajar(ej.pares.map((p, i) => ({ i, texto: textoLocal(p[0], idioma) }))), [ej, idioma]);
  const derecha = useMemo(() => barajar(ej.pares.map((p, i) => ({ i, texto: textoLocal(p[1], idioma) }))), [ej, idioma]);
  const [elegidaIzq, setElegidaIzq] = useState(null);
  const [resueltos, setResueltos] = useState(() => new Set());
  const [error, setError] = useState(false);
  const huboFallo = useRef(false);
  const avisado = useRef(false);
  // Siempre la última versión del callback, sin reiniciar el temporizador cuando el padre se vuelve a renderizar.
  const avisar = useRef(onResponder);
  useEffect(() => { avisar.current = onResponder; });

  // Cuando se resuelven todos los pares se avisa UNA vez, tras un instante para ver el último acierto.
  const totalPares = ej.pares.length;
  useEffect(() => {
    if (resueltos.size === totalPares && !avisado.current) {
      avisado.current = true;
      const id = setTimeout(() => avisar.current(!huboFallo.current), 450);
      return () => clearTimeout(id);
    }
  }, [resueltos, totalPares]);

  const elegirDer = (par) => {
    if (elegidaIzq === null || resueltos.has(par.i)) return;
    if (par.i === elegidaIzq) {
      setResueltos(prev => new Set(prev).add(par.i));
      setElegidaIzq(null);
    } else {
      huboFallo.current = true;
      setError(true);
      setTimeout(() => setError(false), 450);
      setElegidaIzq(null);
    }
  };

  const columna = (items, esIzq) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
      {items.map(it => {
        const hecho = resueltos.has(it.i);
        const activo = esIzq && elegidaIzq === it.i;
        return (
          <button key={`${esIzq}-${it.i}`} type="button" disabled={hecho} onClick={() => (esIzq ? setElegidaIzq(it.i) : elegirDer(it))}
            style={{ ...estiloOpcion(hecho ? 'correcta' : activo ? 'elegida' : error && !esIzq ? 'incorrecta' : 'normal'), opacity: hecho ? 0.55 : 1, textAlign: 'center', padding: '0.8rem 0.6rem', fontSize: '0.9rem' }}>
            {it.texto}
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>{t('curso.t_emparejar')}</h2>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {columna(izquierda, true)}
        {columna(derecha, false)}
      </div>
    </div>
  );
};

// onTerminar(puntaje) devuelve una promesa { ok }. `onSalir` cierra el reproductor.
export const LeccionPlayer = ({ leccion, onTerminar, onSalir }) => {
  const { t, idioma } = useI18n();
  const ejercicios = leccion.ejercicios;
  const total = ejercicios.length;

  const [cola, setCola] = useState(() => ejercicios.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [fase, setFase] = useState('responder'); // 'responder' | 'feedback' | 'fin'
  const [acierto, setAcierto] = useState(null);
  const [fallados, setFallados] = useState(() => new Set());
  const [correctos, setCorrectos] = useState(() => new Set());
  const [guardado, setGuardado] = useState('pendiente'); // 'pendiente' | 'guardando' | 'ok' | 'error'
  const [puntaje, setPuntaje] = useState(0);

  const idx = cola[pos];
  const ej = ejercicios[idx];

  const responder = (correcto) => {
    setAcierto(correcto);
    setFase('feedback');
    if (correcto) {
      setCorrectos(prev => new Set(prev).add(idx));
    } else {
      setFallados(prev => new Set(prev).add(idx));
      setCola(prev => [...prev, idx]); // se repite al final
    }
  };

  const guardar = async (valor) => {
    setGuardado('guardando');
    const res = await onTerminar(valor);
    setGuardado(res?.ok ? 'ok' : 'error');
  };

  const continuar = () => {
    if (pos + 1 < cola.length) {
      setPos(pos + 1);
      setFase('responder');
      setAcierto(null);
      return;
    }
    const final = Math.round((100 * (total - fallados.size)) / total);
    setPuntaje(final);
    setFase('fin');
    void guardar(final);
  };

  const progreso = Math.round((correctos.size / total) * 100);

  // Texto de la respuesta correcta para el aviso de error
  const respuestaCorrecta = (() => {
    if (!ej || ej.tipo === 'emparejar') return '';
    return textoLocal(ej.opciones[ej.correcta], idioma);
  })();

  return (
    <div role="dialog" aria-modal="true" aria-label={leccion.titulo}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
        <button type="button" onClick={onSalir} aria-label={t('curso.salir')} title={t('curso.salir')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
          <X size={24} />
        </button>
        <div style={{ flex: 1, height: '12px', background: 'var(--border-color)', borderRadius: '999px', overflow: 'hidden' }} aria-label={t('curso.progreso_leccion')} role="progressbar" aria-valuenow={progreso} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${progreso}%`, height: '100%', background: 'linear-gradient(90deg,#7c3aed,#a855f7)', transition: 'width 0.3s ease' }} />
        </div>
        <strong style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leccion.titulo}</strong>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '1.5rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: '560px' }}>
          {fase === 'fin' ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', paddingTop: '2rem' }}>
              <PartyPopper size={56} style={{ color: '#7c3aed' }} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{t('curso.leccion_lista')}</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{t('curso.resultado', { n: puntaje })}</p>

              {guardado === 'guardando' && (
                <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                  <Loader2 size={16} className="spin-once" /> {t('curso.guardando')}
                </p>
              )}
              {guardado === 'error' && (
                <>
                  <p role="alert" style={{ margin: 0, color: 'var(--danger-color)', fontSize: '0.9rem' }}>{t('curso.err_guardar')}</p>
                  <Button type="button" variant="outline" onClick={() => guardar(puntaje)}>{t('curso.reintentar')}</Button>
                </>
              )}
              {guardado === 'ok' && (
                <Button type="button" variant="primary" onClick={onSalir} style={{ padding: '0.85rem 2rem', fontWeight: 800 }}>{t('curso.volver')}</Button>
              )}
            </div>
          ) : ej.tipo === 'emparejar' ? (
            <EjercicioEmparejar key={pos} ej={ej} idioma={idioma} onResponder={responder} />
          ) : (
            <EjercicioOpciones key={pos} ej={ej} idioma={idioma} fase={fase} onResponder={responder} />
          )}
        </div>
      </main>

      {fase === 'feedback' && (
        <footer style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', background: acierto ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
          <div style={{ maxWidth: '560px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', color: acierto ? 'var(--success-color)' : 'var(--danger-color)', flex: '1 1 240px' }}>
              {acierto ? <Check size={26} /> : <XCircle size={26} />}
              <div>
                <strong style={{ display: 'block', fontSize: '1.05rem' }}>{acierto ? t('curso.correcto') : t('curso.incorrecto')}</strong>
                {!acierto && respuestaCorrecta && (
                  <span style={{ fontSize: '0.88rem' }}>{t('curso.respuesta_correcta', { respuesta: respuestaCorrecta })}</span>
                )}
                {ej.explicacion && <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{textoLocal(ej.explicacion, idioma)}</span>}
                {!acierto && <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>{t('curso.repetira')}</span>}
              </div>
            </div>
            <Button type="button" variant="primary" onClick={continuar} style={{ padding: '0.85rem 2rem', fontWeight: 800 }}>{t('curso.continuar')}</Button>
          </div>
        </footer>
      )}
    </div>
  );
};
