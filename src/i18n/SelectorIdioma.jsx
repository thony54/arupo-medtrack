import React from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from './useI18n';

// Selector de idioma. `oscuro` adapta los colores a fondos oscuros (pantalla de ingreso).
export const SelectorIdioma = ({ oscuro = false, style }) => {
  const { idioma, idiomas, selectorVisible, cambiarIdioma, t } = useI18n();
  // Solo el voluntario (o quien aún no inició sesión) elige idioma; el resto ve español.
  if (!selectorVisible) return null;
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: oscuro ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', fontSize: '0.8rem', ...style }}>
      <Languages size={16} aria-hidden="true" />
      <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{t('idioma.etiqueta')}</span>
      <select
        value={idioma}
        onChange={e => cambiarIdioma(e.target.value)}
        aria-label={t('idioma.etiqueta')}
        style={{
          background: oscuro ? 'rgba(255,255,255,0.08)' : 'var(--bg-surface)',
          color: oscuro ? '#fff' : 'var(--text-primary)',
          border: `1px solid ${oscuro ? 'rgba(255,255,255,0.18)' : 'var(--border-color)'}`,
          borderRadius: '8px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer'
        }}
      >
        {idiomas.map(i => (
          <option key={i.codigo} value={i.codigo} style={{ color: '#111' }}>{i.nombre}</option>
        ))}
      </select>
    </label>
  );
};
