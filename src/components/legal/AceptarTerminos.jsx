import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { TERMINOS, TITULO_TERMINOS, VERSION_TERMINOS } from '../../legal/terminos';

// Pantalla bloqueante de aceptación de términos. Layout la muestra en lugar de la
// app mientras la persona no haya aceptado la versión vigente. Al aceptar, el
// servidor registra usuario, fecha/hora, IP y versión (aceptar_terminos).
export const AceptarTerminos = () => {
  const { aceptarTerminos, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const aceptar = async () => {
    setEnviando(true);
    setError('');
    const res = await aceptarTerminos();
    if (!res.ok) setError(res.mensaje);
    setEnviando(false);
  };

  const salir = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', background: 'var(--bg-main, #f8fafc)' }}>
      <main className="card glass animate-blur-in" style={{ width: '100%', maxWidth: '680px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0 }}>{TITULO_TERMINOS}</h1>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              {profile?.nombre ? `${profile.nombre} · ` : ''}Versión {VERSION_TERMINOS}
            </p>
          </div>
        </header>

        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Antes de continuar, lee y acepta estos términos. Es obligatorio la primera vez que ingresas
          y cada vez que cambien.
        </p>

        <div tabIndex={0} aria-label="Texto de los términos" style={{ maxHeight: 'min(48vh, 380px)', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem 1.1rem', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {TERMINOS.map(t => (
            <section key={t.titulo}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: '700', margin: '0 0 0.3rem' }}>{t.titulo}</h2>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.55, color: 'var(--text-secondary)' }}>{t.cuerpo}</p>
            </section>
          ))}
        </div>

        {error && (
          <div role="alert" style={{ padding: '0.7rem 0.85rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button type="button" variant="ghost" onClick={salir} disabled={enviando}>No acepto, cerrar sesión</Button>
          <Button type="button" variant="primary" onClick={aceptar} disabled={enviando}
            style={{ fontWeight: '800', letterSpacing: '0.03em' }}>
            {enviando ? 'Registrando...' : 'ESTOY DE ACUERDO'}
          </Button>
        </div>
      </main>
    </div>
  );
};
