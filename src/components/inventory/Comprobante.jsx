import React, { useRef } from 'react';
import { Printer, Heart } from 'lucide-react';
import { Button } from '../ui/Button';

export const Comprobante = ({ beneficiario, donaciones = [], onClose }) => {
  const printRef = useRef(null);
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  // Calculate total units across all donations
  const totalGeneral = donaciones.reduce((sum, d) => sum + (d.total_despachado || 0), 0);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML || '';
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Acta de Donación — Fundación Arupo</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 2rem; color: #111; max-width: 750px; margin: 0 auto; }
            .header-flex { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; border-bottom: 2px solid #059669; padding-bottom: 1.5rem; }
            .logo { max-width: 150px; max-height: 80px; object-fit: contain; }
            h1 { color: #059669; font-size: 1.6rem; margin: 0 0 0.25rem 0; }
            .subtitle { color: #6b7280; font-size: 0.9rem; margin: 0; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 2rem; }
            .info-box { background: #f0fdf4; padding: 1rem; border-radius: 8px; border: 1px solid #d1fae5; }
            .info-label { font-size: 0.75rem; font-weight: bold; color: #065f46; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
            .info-value { font-weight: bold; font-size: 1.05rem; color: #111; }
            
            .med-section { margin-bottom: 2rem; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
            .med-header { background: #f3f4f6; padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; font-weight: bold; display: flex; justify-content: space-between; }
            
            table { width: 100%; border-collapse: collapse; }
            th { background: #fff; color: #6b7280; padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; }
            td { padding: 0.75rem 1rem; border-bottom: 1px solid #f3f4f6; font-size: 0.9rem; }
            .total-row td { font-weight: bold; background: #f0fdf4; color: #065f46; border-top: 2px solid #d1fae5; border-bottom: none; }
            
            .grand-total { margin-top: 2rem; text-align: right; font-size: 1.25rem; font-weight: bold; padding: 1rem; background: #ecfdf5; border-radius: 8px; color: #065f46; border: 1px dashed #34d399; }
            .footer { margin-top: 3rem; font-size: 0.8rem; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 1.5rem; text-align: center; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; margin-top: 4rem; text-align: center; }
            .sig-line { border-top: 1px solid #111; padding-top: 0.5rem; font-weight: bold; font-size: 0.9rem; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'var(--success-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <Heart size={28} color="var(--success-color)" fill="var(--success-color)" />
        <div>
          <div style={{ fontWeight: '700', color: 'var(--success-color)' }}>¡Donación registrada con éxito!</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Se entregaron {totalGeneral} unidades en total a {beneficiario?.nombre_completo}.</div>
        </div>
      </div>

      <div ref={printRef} style={{ fontSize: '0.9rem', background: '#fff', color: '#111', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        
        {/* Header con Logo */}
        <div className="header-flex" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--primary-color)', paddingBottom: '1.5rem' }}>
          <img src="/logo.png" alt="Logo Fundación Arupo" className="logo" style={{ maxWidth: '120px', maxHeight: '80px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary-color)', margin: '0 0 0.25rem 0' }}>
              Acta de Donación de Medicamentos
            </h1>
            <p className="subtitle" style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>
              Fundación Arupo — Programa de Ayuda Humanitaria<br/>
              Fecha: {dateStr} a las {timeStr}
            </p>
          </div>
        </div>

        {/* Info Beneficiario */}
        <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          <div className="info-box" style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #d1fae5' }}>
            <div className="info-label" style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Entregado a</div>
            <div className="info-value" style={{ fontWeight: 'bold', fontSize: '1rem' }}>{beneficiario?.nombre_completo || '—'}</div>
            {beneficiario?.cedula && <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '0.2rem' }}>ID/CI: {beneficiario.cedula}</div>}
          </div>
          {beneficiario?.condicion_medica && (
            <div className="info-box" style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #d1fae5' }}>
              <div className="info-label" style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Condición Registrada</div>
              <div className="info-value" style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{beneficiario.condicion_medica}</div>
            </div>
          )}
        </div>

        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1rem', color: '#111' }}>Detalle de Medicamentos Entregados</div>
        
        {donaciones.map((donacion, index) => {
          const { producto, desglose_lotes, total_despachado } = donacion;
          return (
            <div key={index} className="med-section" style={{ marginBottom: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              <div className="med-header" style={{ background: '#f3f4f6', padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{producto?.nombre} {producto?.concentracion ? `(${producto.concentracion})` : ''}</span>
                <span style={{ color: '#4b5563', fontSize: '0.85rem' }}>Subtotal: {total_despachado}</span>
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ background: '#fff', color: '#6b7280', padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>N° Lote</th>
                    <th style={{ background: '#fff', color: '#6b7280', padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Vencimiento</th>
                    <th style={{ background: '#fff', color: '#6b7280', padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.7rem', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Cant. Lote</th>
                  </tr>
                </thead>
                <tbody>
                  {(desglose_lotes || []).map((l, i) => (
                    <tr key={i}>
                      <td style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.85rem' }}><strong>{l.numero_lote || 'S/N'}</strong></td>
                      <td style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.85rem' }}>{l.fecha_venc ? new Date(l.fecha_venc).toLocaleDateString('es-ES') : '—'}</td>
                      <td style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.85rem', textAlign: 'right', fontWeight: 'bold' }}>{l.cantidad}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan="2" style={{ padding: '0.5rem 1rem', fontWeight: 'bold', background: '#f0fdf4', color: '#065f46', borderTop: '2px solid #d1fae5', fontSize: '0.85rem' }}>TOTAL ENTREGADO</td>
                    <td style={{ padding: '0.5rem 1rem', fontWeight: 'bold', background: '#f0fdf4', color: '#065f46', borderTop: '2px solid #d1fae5', textAlign: 'right', fontSize: '0.9rem' }}>{total_despachado}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}

        <div className="grand-total" style={{ marginTop: '1.5rem', textAlign: 'right', fontSize: '1.1rem', fontWeight: 'bold', padding: '1rem', background: '#ecfdf5', borderRadius: '8px', color: '#065f46', border: '1px dashed #34d399' }}>
          TOTAL GENERAL: {totalGeneral} unidades entregadas
        </div>

        <div className="signatures" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginTop: '3.5rem', textAlign: 'center' }}>
          <div>
            <div className="sig-line" style={{ borderTop: '1px solid #111', paddingTop: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem' }}>
              Firma de Entrega (Fundación)
            </div>
          </div>
          <div>
            <div className="sig-line" style={{ borderTop: '1px solid #111', paddingTop: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem' }}>
              Firma de Recibido (Beneficiario)
            </div>
            <div style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '0.2rem' }}>C.I. ____________________</div>
          </div>
        </div>

        <p className="footer" style={{ marginTop: '2.5rem', fontSize: '0.75rem', color: '#9ca3af', borderTop: '1px solid #e5e7eb', paddingTop: '1rem', textAlign: 'center' }}>
          Documento generado automáticamente por Arupo MedTrack — Trazabilidad FEFO.<br />
          Conservar copia original para fines de auditoría.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
        <Button variant="outline" onClick={handlePrint} style={{ gap: '0.5rem' }}>
          <Printer size={16} /> Imprimir Acta
        </Button>
        <Button variant="primary" onClick={onClose}>✅ Finalizar</Button>
      </div>
    </div>
  );
};
