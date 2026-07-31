import React, { useRef } from 'react';
import { Printer, PackageCheck, ShoppingBag } from 'lucide-react';
import { Button } from '../ui/Button';
import { formatFechaVenc } from '../../utils/itemUtils';
// Logo oficial de los documentos (actas, comprobantes, PDFs).
import logoArupo from '../../assets/logo.png';

/**
 * ActaIngreso — soporte dual:
 * - modoGeneral=false (default): Acta de Ingreso de Medicamentos (con lote + vencimiento)
 * - modoGeneral=true:            Acta de Ingreso de Ítems Generales (sin columna de vencimiento,
 *                                lote autogenerado se muestra simplificado)
 */
export const ActaIngreso = ({ donante, items = [], onClose, modoGeneral = false }) => {
  const printRef = useRef(null);
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const totalGeneral = items.reduce((sum, item) => sum + (item.cantidad || 0), 0);

  // Textos según el modo
  const tituloDoc = modoGeneral ? 'Acta de Ingreso de Ítems Generales' : 'Acta de Ingreso de Medicamentos';
  const subtituloDoc = modoGeneral ? 'Fundación Arupo — Gestión de Insumos Generales' : 'Fundación Arupo — Banco de Medicamentos';
  const detalleLabel = modoGeneral ? 'Detalle de Ítems Recibidos' : 'Detalle de Medicamentos Ingresados';
  const footerText = modoGeneral
    ? 'Documento generado por Arupo Med-Track — Gestión de Insumos Generales.'
    : 'Documento generado automáticamente por Arupo Med-Track — Sistema de Trazabilidad.';

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
          <title>${tituloDoc} — Fundación Arupo</title>
          <style>
            :root {
              --primary-color: #059669;
              --primary-hover: #047857;
              --primary-light: #ecfdf5;
              --success-color: #10b981;
              --success-bg: #d1fae5;
              --warning-color: #f59e0b;
              --warning-bg: #fef3c7;
              --danger-color: #ef4444;
              --danger-bg: #fee2e2;
              --text-primary: #111827;
              --text-secondary: #4b5563;
              --text-tertiary: #9ca3af;
              --bg-color: #f9fafb;
              --bg-surface: #ffffff;
              --bg-surface-hover: #f3f4f6;
              --border-color: #e5e7eb;
              --radius-sm: 0.25rem;
              --radius-md: 0.375rem;
              --radius-lg: 0.5rem;
              --radius-xl: 0.75rem;
              --radius-pill: 9999px;
            }
            body { font-family: Arial, sans-serif; padding: 2rem; color: #111; width: 750px; margin: 0 auto; }
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: modoGeneral ? '#f5f3ff' : 'var(--success-bg)', borderRadius: 'var(--radius-lg)', border: `1px solid ${modoGeneral ? 'rgba(124,58,237,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
        {modoGeneral
          ? <ShoppingBag size={28} color="#7c3aed" />
          : <PackageCheck size={28} color="var(--success-color)" />
        }
        <div>
          <div style={{ fontWeight: '700', color: modoGeneral ? '#7c3aed' : 'var(--success-color)' }}>
            {modoGeneral ? 'Ingreso general registrado con éxito' : 'Ingreso registrado con éxito'}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Se registraron {totalGeneral} {modoGeneral ? 'ítems' : 'unidades'} en total de {donante?.nombre || 'Origen desconocido'}.
          </div>
        </div>
      </div>

      <div ref={printRef} style={{ fontSize: '0.9rem', background: '#fff', color: '#111', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>

        {/* Header con Logo */}
        <div className="header-flex" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #059669', paddingBottom: '1.5rem' }}>
          <img src={logoArupo} alt="Logo Fundación Arupo" className="logo" style={{ maxWidth: '120px', maxHeight: '80px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#059669', margin: '0 0 0.25rem 0' }}>
              {tituloDoc}
            </h1>
            <p className="subtitle" style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>
              {subtituloDoc}<br/>
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

        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1rem', color: '#111' }}>{detalleLabel}</div>

        <table>
          <thead>
            <tr>
              <th>{modoGeneral ? 'Ítem' : 'Medicamento'}</th>
              {/* Columna Lote: siempre visible, pero para generales muestra "Auto" */}
              <th>Lote</th>
              {/* Columna Vencimiento: solo para médicos */}
              {!modoGeneral && <th>Vencimiento</th>}
              <th style={{ textAlign: 'right' }}>Cant.</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td style={{ fontWeight: '600' }}>{item.medNameDisplay}</td>
                <td style={{ fontSize: '0.85rem', color: modoGeneral ? '#6b7280' : 'inherit' }}>
                  {modoGeneral
                    ? /* Simplificar el lote autogenerado: mostrar solo el año */
                      (item.numeroLote?.startsWith('LOTE-GENERAL') ? 'Autogenerado' : (item.numeroLote || '—'))
                    : (item.numeroLote || 'S/N')
                  }
                </td>
                {!modoGeneral && (
                  <td>{item.fechaVencimiento ? formatFechaVenc(item.fechaVencimiento) : '—'}</td>
                )}
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{item.cantidad}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan={modoGeneral ? 2 : 3} style={{ padding: '0.75rem 1rem', fontWeight: 'bold', background: '#f0fdf4', color: '#065f46', borderTop: '2px solid #d1fae5' }}>
                TOTAL {modoGeneral ? 'RECIBIDO' : 'INGRESADO'}
              </td>
              <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', background: '#f0fdf4', color: '#065f46', borderTop: '2px solid #d1fae5', textAlign: 'right' }}>{totalGeneral}</td>
            </tr>
          </tbody>
        </table>

        <div className="grand-total" style={{ marginTop: '1.5rem', textAlign: 'right', fontSize: '1.1rem', fontWeight: 'bold', padding: '1rem', background: '#ecfdf5', borderRadius: '8px', color: '#065f46', border: '1px dashed #34d399' }}>
          TOTAL RECIBIDO: {totalGeneral} {modoGeneral ? 'ítems' : 'unidades'}
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
          {footerText}<br />
          Conservar copia original para fines de auditoría.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
        <Button variant="outline" onClick={handlePrint} style={{ gap: '0.5rem' }}>
          <Printer size={16} /> Imprimir Acta
        </Button>
        <Button variant="primary" onClick={onClose}>Finalizar</Button>
      </div>
    </div>
  );
};
