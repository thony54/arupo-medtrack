import React from 'react';
import { reportError } from '../lib/errorReporter';

// Captura los errores que ocurren durante el render de React (que window.onerror
// NO ve) y los reporta a Discord. Muestra una pantalla de recuperación en vez
// de dejar la app en blanco.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportError(error, {
      source: 'react',
      level: 'fatal',
      stack: (error && error.stack) || info?.componentStack || '',
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            background: '#fff',
            padding: '2.5rem',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>😵</div>
          <h1
            style={{
              fontSize: '1.4rem',
              fontWeight: 700,
              color: '#1e293b',
              marginBottom: '0.75rem',
            }}
          >
            Algo salió mal
          </h1>
          <p
            style={{
              color: '#64748b',
              lineHeight: 1.5,
              fontSize: '0.95rem',
              marginBottom: '1.5rem',
            }}
          >
            Ocurrió un error inesperado. Ya se notificó al equipo técnico. Puedes
            recargar la página para continuar.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#10b981',
              color: '#fff',
              border: 'none',
              padding: '0.7rem 1.5rem',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
