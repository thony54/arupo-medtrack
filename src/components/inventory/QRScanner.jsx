import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, Zap } from 'lucide-react';

export const QRScanner = ({ onScan, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [detected, setDetected] = useState('');

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        startDetection();
      }
    } catch (err) {
      setError('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setScanning(false);
  };

  const startDetection = () => {
    // Use BarcodeDetector API if available (Chrome/Edge)
    if ('BarcodeDetector' in window) {
      const detector = new window.BarcodeDetector({
        formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'data_matrix']
      });

      const detect = async () => {
        if (!videoRef.current || !scanning) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const value = codes[0].rawValue;
            setDetected(value);
            stopCamera();
            onScan(value);
            return;
          }
        } catch { /* continue */ }
        requestAnimationFrame(detect);
      };
      requestAnimationFrame(detect);
    } else {
      // Fallback: manual input
      setError('Tu navegador no soporta detección automática. Ingresa el código manualmente abajo.');
    }
  };

  const handleManualInput = (e) => {
    if (e.key === 'Enter' && e.target.value) {
      setDetected(e.target.value);
      onScan(e.target.value);
      stopCamera();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Scanner Viewport */}
      <div style={{ position: 'relative', backgroundColor: '#000', borderRadius: 'var(--radius-lg)', overflow: 'hidden', aspectRatio: '4/3', maxHeight: '320px' }}>
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          muted
          playsInline
          aria-label="Vista de la cámara para escanear código"
        />
        {/* Crosshair overlay */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ width: '200px', height: '200px', border: '3px solid var(--primary-color)', borderRadius: 'var(--radius-lg)', boxShadow: '0 0 0 2000px rgba(0,0,0,0.4)' }} />
          <Zap size={20} color="var(--primary-color)" style={{ position: 'absolute' }} />
        </div>
        {scanning && (
          <div style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'var(--primary-color)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-pill)', fontSize: '0.75rem', fontWeight: '600' }}>
            Escaneando...
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '0.75rem', backgroundColor: 'var(--warning-bg)', color: 'var(--warning-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Manual fallback input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <label htmlFor="qr-manual" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
          O ingresa el código manualmente:
        </label>
        <input
          id="qr-manual"
          className="input-field"
          placeholder="Ej. LOT-20241215-001"
          onKeyDown={handleManualInput}
          style={{ marginBottom: 0 }}
          aria-label="Código de lote manual"
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Presiona Enter para confirmar</p>
      </div>

      {detected && (
        <div style={{ padding: '0.75rem', backgroundColor: 'var(--success-bg)', color: 'var(--success-color)', borderRadius: 'var(--radius-md)', fontWeight: '600', border: '1px solid rgba(16,185,129,0.2)' }}>
          ✅ Código detectado: {detected}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose} style={{ color: 'var(--danger-color)' }}>
          <X size={16} /> Cancelar escáner
        </button>
      </div>
    </div>
  );
};
