import React, { useRef } from 'react';
import { Printer, PackageCheck } from 'lucide-react';
import { Button } from '../ui/Button';

export const ActaIngreso = ({ donante, items = [], onClose }) => {
  const printRef = useRef(null);
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  // Calculate total units across all items
  const totalGeneral = items.reduce((sum, item) => sum + (item.cantidad || 0), 0);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML || '';
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>Acta de Ingreso — Fundación Arupo</title>
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
            
            table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
            th { background: #f3f4f6; color: #4b5563; padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; text-transform: uppercase; border: 1px solid #e5e7eb; }
            td { padding: 0.75rem 1rem; border: 1px solid #e5e7eb; font-size: 0.9rem; }
            .total-row td { font-weight: bold; background: #f0fdf4; color: #065f46; }
            
            .grand-total { margin-top: 2rem; text-align: right; font-size: 1.25rem; font-weight: bold; padding: 1rem; background: #ecfdf5; border-radius: 8px; color: #065f46; border: 1px dashed #34d399; }
            .footer { margin-top: 3rem; font-size: 0.8rem; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 1.5rem; text-align: center; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; margin-top: 4rem; text-align: center; }
            .sig-line { border-top: 1px solid #111; padding-top: 0.5rem; font-weight: bold; font-size: 0.9rem; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 250);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'var(--success-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <PackageCheck size={28} color="var(--success-color)" />
        <div>
          <div style={{ fontWeight: '700', color: 'var(--success-color)' }}>¡Ingreso registrado con éxito!</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Se registraron {totalGeneral} unidades en total de {donante?.nombre || 'Origen desconocido'}.</div>
        </div>
      </div>

      <div ref={printRef} style={{ fontSize: '0.9rem', background: '#fff', color: '#111', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        
        {/* Header con Logo */}
        <div className="header-flex" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #059669', paddingBottom: '1.5rem' }}>
          <img src="/logo.png" alt="Logo Fundación Arupo" className="logo" style={{ maxWidth: '120px', maxHeight: '80px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#059669', margin: '0 0 0.25rem 0' }}>
              Acta de Ingreso de Medicamentos
            </h1>
            <p className="subtitle" style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>
              Fundación Arupo — Banco de Medicamentos<br/>
              Fecha: {dateStr} a las {timeStr}
            </p>
          </div>
        </div>

        {/* Info Donante */}
        <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          <div className="info-box" style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #d1fae5' }}>
            <div className="info-label" style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Donante / Proveedor</div>
            <div className="info-value" style={{ fontWeight: 'bold', fontSize: '1rem' }}>{donante?.nombre || '—'}</div>
            {donante?.tipo && <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '0.2rem' }}>Tipo: {donante.tipo}</div>}
          </div>
          <div className="info-box" style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #d1fae5' }}>
            <div className="info-label" style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Responsable</div>
            <div className="info-value" style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{donante?.contacto_nombre || '—'}</div>
          </div>
        </div>

        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1rem', color: '#111' }}>Detalle de Medicamentos Ingresados</div>
        
        <table>
          <thead>
            <tr>
              <th>Medicamento</th>
              <th>Lote</th>
              <th>Vencimiento</th>
              <th style={{ textAlign: 'right' }}>Cant.</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td style={{ fontWeight: '600' }}>{item.medNameDisplay}</td>
                <td>{item.numeroLote || 'S/N'}</td>
                <td>{item.fechaVencimiento ? new Date(item.fechaVencimiento).toLocaleDateString('es-ES') : '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{item.cantidad}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan="3" style={{ padding: '0.75rem 1rem', fontWeight: 'bold', background: '#f0fdf4', color: '#065f46', borderTop: '2px solid #d1fae5' }}>TOTAL INGRESADO</td>
              <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', background: '#f0fdf4', color: '#065f46', borderTop: '2px solid #d1fae5', textAlign: 'right' }}>{totalGeneral}</td>
            </tr>
          </tbody>
        </table>

        <div className="grand-total" style={{ marginTop: '1.5rem', textAlign: 'right', fontSize: '1.1rem', fontWeight: 'bold', padding: '1rem', background: '#ecfdf5', borderRadius: '8px', color: '#065f46', border: '1px dashed #34d399' }}>
          TOTAL RECIBIDO: {totalGeneral} unidades
        </div>

        <div className="signatures" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginTop: '3.5rem', textAlign: 'center' }}>
          <div>
            <div className="sig-line" style={{ borderTop: '1px solid #111', paddingTop: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem' }}>
              Firma de Entrega (Donante)
            </div>
          </div>
          <div>
            <div className="sig-line" style={{ borderTop: '1px solid #111', paddingTop: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem' }}>
              Firma de Recibido (Fundación)
            </div>
          </div>
        </div>

        <p className="footer" style={{ marginTop: '2.5rem', fontSize: '0.75rem', color: '#9ca3af', borderTop: '1px solid #e5e7eb', paddingTop: '1rem', textAlign: 'center' }}>
          Documento generado automáticamente por Arupo MedTrack — Sistema de Trazabilidad.<br />
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
