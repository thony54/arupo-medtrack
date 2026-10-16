import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n/useI18n';
import { SelectorIdioma } from '../../i18n/SelectorIdioma';
import { Button } from '../ui/Button';
import { SECCIONES_TERMINOS, VERSION_TERMINOS } from '../../legal/terminos';

// Pantalla bloqueante de aceptación de términos. Layout la muestra en lugar de la
// app mientras la persona no haya aceptado la versión vigente. Al aceptar, el
// servidor registra usuario, fecha/hora, IP y versión (aceptar_terminos).
export const AceptarTerminos = () => {
  const { aceptarTerminos, signOut, profile } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const aceptar = async () => {
    setEnviando(true);
    setError('');
    const res = await aceptarTerminos();
    if (!res.ok) setError(t(`terminos.error_${res.codigo || 'error'}`));
    setEnviando(false);
  };

  const salir = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', background: 'var(--bg-base)' }}>
      <main className="card glass animate-blur-in" style={{ width: '100%', maxWidth: '680px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0 }}>{t('terminos.titulo')}</h1>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              {profile?.nombre ? `${profile.nombre} · ` : ''}{t('terminos.version', { version: VERSION_TERMINOS })}
            </p>
          </div>
          <SelectorIdioma />
        </header>

        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('terminos.intro')}</p>

        <div tabIndex={0} aria-label={t('terminos.aria_texto')} style={{ maxHeight: 'min(48vh, 380px)', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem 1.1rem', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {SECCIONES_TERMINOS.map(n => (
            <section key={n}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: '700', margin: '0 0 0.3rem' }}>{t(`terminos.s${n}_titulo`)}</h2>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.55, color: 'var(--text-secondary)' }}>{t(`terminos.s${n}_cuerpo`)}</p>
            </section>
          ))}
          <p style={{ margin: 0, fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>{t('terminos.nota_idioma')}</p>
        </div>

        {error && (
          <div role="alert" style={{ padding: '0.7rem 0.85rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button type="button" variant="ghost" onClick={salir} disabled={enviando}>{t('terminos.no_acepto')}</Button>
          <Button type="button" variant="primary" onClick={aceptar} disabled={enviando}
            style={{ fontWeight: '800', letterSpacing: '0.03em' }}>
            {enviando ? t('terminos.registrando') : t('terminos.aceptar')}
          </Button>
        </div>
      </main>
    </div>
  );
};
