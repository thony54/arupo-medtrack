/**
 * SalidaGeneral.jsx
 * Formulario de entrega/salida para ítems GENERALES (ropa, higiene, etc.)
 *
 * DIFERENCIAS CON SalidaFEFO.jsx (modo médico):
 * - NO aplica FEFO (vencimiento más cercano)
 * - Aplica FIFO: el sistema llama a una función de descontar del lote MÁS ANTIGUO
 *   o, si no existe RPC FIFO, aplica descuento directo del stock_actual del producto
 * - Muestra solo ítems de categoría general (sin fecha real de vencimiento)
 * - No bloquea por lotes próximos a "vencer" (la fecha es 2099)
 *
 * La tabla `movimientos` es la misma. Compatible con el flujo de auditoría.
 */
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ListChecks, ShoppingBag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CATEGORIAS_GENERALES, FECHA_NO_VENCE, formatFechaVenc } from '../../utils/itemUtils';

export const SalidaGeneral = ({ isOpen, onClose, onSuccess }) => {
  const [productos, setProductos] = useState([]);
  const [beneficiarios, setBeneficiarios] = useState([]);

  // Carrito
  const [cart, setCart] = useState([]);

  // Form global
  const [beneficiarioId, setBeneficiarioId] = useState('');
  const [destinoLibre, setDestinoLibre] = useState('');

  // Form ítem actual
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actaData, setActaData] = useState(null);

  useEffect(() => {
    if (isOpen) { fetchProductos(); fetchBeneficiarios(); }
  }, [isOpen]);

  const fetchProductos = async () => {
    if (!supabase) return;

    // Solo categorías generales
    const { data: cats } = await supabase
      .from('categorias')
      .select('id, nombre')
      .in('nombre', CATEGORIAS_GENERALES);

    const catIds = (cats || []).map(c => c.id);
    if (catIds.length === 0) { setProductos([]); return; }

    const { data } = await supabase
      .from('medicinas')
      .select('id, nombre, presentacion, stock_actual, categorias(nombre)')
      .in('categoria_id', catIds)
      .gt('stock_actual', 0)
      .order('nombre');
    setProductos(data || []);
  };

  const fetchBeneficiarios = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('beneficiarios')
      .select('id, nombre_completo, cedula')
      .eq('estado', 'Activo')
      .order('nombre_completo');
    setBeneficiarios(data || []);
  };

  const resetCurrentItem = () => {
    setProductoId(''); setCantidad(''); setError('');
  };

  const resetAll = () => {
    resetCurrentItem();
    setBeneficiarioId(''); setDestinoLibre('');
    setCart([]); setActaData(null);
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    setError('');

    if (!productoId) { setError('Selecciona un ítem.'); return; }
    if (!cantidad || Number(cantidad) <= 0) { setError('La cantidad debe ser mayor a 0.'); return; }

    const prod = productos.find(p => p.id === productoId);
    if (!prod) return;

    if (Number(cantidad) > prod.stock_actual) {
      setError(`Solo hay ${prod.stock_actual} unidades disponibles de este ítem.`);
      return;
    }

    const existingQty = cart
      .filter(c => c.productoId === productoId)
      .reduce((sum, item) => sum + item.cantidad, 0);
    if (existingQty + Number(cantidad) > prod.stock_actual) {
      setError(`Stock insuficiente. Ya tienes ${existingQty} en la lista y solo hay ${prod.stock_actual}.`);
      return;
    }

    setCart([...cart, {
      id: Date.now().toString(),
      productoId,
      medNameDisplay: `${prod.nombre}${prod.presentacion ? ` — ${prod.presentacion}` : ''} [${prod.categorias?.nombre || 'General'}]`,
      cantidad: Number(cantidad),
    }]);
    resetCurrentItem();
  };

  const removeFromCart = (id) => setCart(cart.filter(i => i.id !== id));

  const handleSubmitAll = async () => {
    if (cart.length === 0) return;
    setError('');

    if (!beneficiarioId && !destinoLibre.trim()) {
      setError('Debes indicar el receptor antes de procesar.');
      return;
    }

    const destino = beneficiarioId
      ? beneficiarios.find(b => b.id === beneficiarioId)?.nombre_completo
      : destinoLibre.trim();

    try {
      setLoading(true);
      const donacionesProcesadas = [];

      for (const item of cart) {
        // Intentar usar la RPC FEFO — para ítems generales funciona igual
        // porque la función descuenta FIFO por fecha_ingreso si los vencimientos son iguales (2099).
        // Fallback: descuento directo del lote más antiguo disponible.
        let desgloseLotes = [];
        let totalDespachado = item.cantidad;

        try {
          // Intentar con la función FEFO existente (compatible con ítems generales)
          const { data, error: fnErr } = await supabase.rpc('registrar_salida_fefo', {
            p_producto_id: item.productoId,
            p_cantidad: item.cantidad,
            p_destino: destino,
            p_beneficiario_id: beneficiarioId || null,
          });
          if (fnErr) throw fnErr;
          desgloseLotes = data.desglose || [];
          totalDespachado = data.total_despachado || item.cantidad;
        } catch {
          // Fallback manual: descontar del lote más antiguo disponible (FIFO por fecha de ingreso)
          const { data: lotes } = await supabase
            .from('lotes')
            .select('id, numero_lote, cantidad_actual, fecha_vencimiento, created_at')
            .eq('producto_id', item.productoId)
            .eq('estado', 'Disponible')
            .gt('cantidad_actual', 0)
            .order('created_at', { ascending: true }); // FIFO: más antiguo primero

          let restante = item.cantidad;
          for (const lote of (lotes || [])) {
            if (restante <= 0) break;
            const usar = Math.min(restante, lote.cantidad_actual);
            const nuevaCant = lote.cantidad_actual - usar;

            await supabase.from('lotes').update({
              cantidad_actual: nuevaCant,
              estado: nuevaCant === 0 ? 'Agotado' : 'Disponible',
            }).eq('id', lote.id);

            desgloseLotes.push({
              numero_lote: lote.numero_lote,
              fecha_venc: formatFechaVenc(lote.fecha_vencimiento) === 'N/A' ? null : lote.fecha_vencimiento,
              cantidad: usar,
            });
            restante -= usar;
          }

          // Registrar movimiento
          await supabase.from('movimientos').insert({
            medicina_id: item.productoId,
            tipo: 'Salida',
            cantidad: totalDespachado,
            origen_destino: destino,
            beneficiario_id: beneficiarioId || null,
          });
        }

        const prod = productos.find(p => p.id === item.productoId);
        donacionesProcesadas.push({
          producto: prod,
          desglose_lotes: desgloseLotes,
          total_despachado: totalDespachado,
          esGeneral: true,
        });
      }

      setActaData({
        beneficiario: beneficiarioId
          ? beneficiarios.find(b => b.id === beneficiarioId)
          : { nombre_completo: destinoLibre },
        donaciones: donacionesProcesadas,
        esGeneral: true,
      });

      onSuccess();
    } catch (err) {
      setError(err.message || 'Error al procesar la entrega. Revisa el stock.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); resetAll(); }}
      title={actaData ? 'Acta de Entrega General' : 'Entregar Ítems Generales'}
      footer={!actaData && (
        <>
          <Button type="button" variant="ghost" onClick={() => { onClose(); resetAll(); }}>Cancelar</Button>
          <Button
            type="button"
            onClick={handleSubmitAll}
            disabled={loading || cart.length === 0}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {loading ? 'Procesando...' : `Entregar (${cart.length})`}
          </Button>
        </>
      )}
    >
      {actaData ? (
        /* Acta de entrega general — reutilizamos la estructura de Comprobante pero adaptada */
        <ActaGeneral
          actaData={actaData}
          onClose={() => { onClose(); resetAll(); }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Banner informativo */}
          <div style={{ padding: '0.875rem 1rem', background: '#f5f3ff', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#6d28d9', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <ShoppingBag size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>Modo <strong>Entrega General</strong>: se aplica <strong>FIFO</strong> — se descuenta del stock ingresado más antiguamente. Sin bloqueos por caducidad.</span>
          </div>

          {error && <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>{error}</div>}

          {/* 1. Receptor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>1. Receptor / Destino</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="sg-ben" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Beneficiario registrado</label>
              <select
                id="sg-ben"
                className="input-field"
                style={{ marginBottom: 0, cursor: 'pointer' }}
                value={beneficiarioId}
                onChange={e => { setBeneficiarioId(e.target.value); if (e.target.value) setDestinoLibre(''); }}
              >
                <option value="">— Seleccionar del CRM (opcional) —</option>
                {beneficiarios.map(b => (
                  <option key={b.id} value={b.id}>{b.nombre_completo}{b.cedula ? ` — ${b.cedula}` : ''}</option>
                ))}
              </select>
            </div>

            {!beneficiarioId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="sg-dest" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  O escribe el destinatario <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <input
                  id="sg-dest"
                  className="input-field"
                  style={{ marginBottom: 0 }}
                  value={destinoLibre}
                  onChange={e => setDestinoLibre(e.target.value)}
                  placeholder="Ej. Comunidad Norte / Familia García"
                />
              </div>
            )}
          </div>

          {/* 2. Añadir ítem */}
          <form onSubmit={handleAddToCart} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={16} color="#7c3aed" /> 2. Añadir Ítem a la Lista
            </div>

            <div className="grid-responsive" style={{ gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="sg-prod" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Ítem <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <select
                  id="sg-prod"
                  className="input-field"
                  style={{ marginBottom: 0, cursor: 'pointer' }}
                  value={productoId}
                  onChange={e => setProductoId(e.target.value)}
                  required
                >
                  <option value="">— Selecciona un ítem —</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} [{p.categorias?.nombre}] — Disp: {p.stock_actual}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="sg-cant" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Cantidad <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <input
                  id="sg-cant"
                  className="input-field"
                  style={{ marginBottom: 0 }}
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={e => setCantidad(e.target.value)}
                  placeholder="Ej. 10"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button type="submit" variant="outline" style={{ color: '#7c3aed', borderColor: '#7c3aed', width: '100%' }}>
                + Añadir a la Lista
              </Button>
            </div>
          </form>

          {/* Carrito */}
          {cart.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ListChecks size={16} /> Ítems a Entregar ({cart.length})
              </div>
              <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <table className="data-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Ítem</th>
                      <th>Cant.</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.id}>
                        <td>{item.medNameDisplay}</td>
                        <td style={{ fontWeight: '700', color: '#7c3aed' }}>{item.cantidad}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '0.2rem' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

/* ─────────────────────────────────────────────────────────────
   Subcomponente inline: Acta de Entrega General (sin detalle FEFO)
   ───────────────────────────────────────────────────────────── */
import { useRef } from 'react';
import { Printer, ShoppingBag as Gift } from 'lucide-react';

const ActaGeneral = ({ actaData, onClose }) => {
  const printRef = useRef(null);
  const { beneficiario, donaciones } = actaData;
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const totalGeneral = donaciones.reduce((s, d) => s + (d.total_despachado || 0), 0);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML || '';
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<html><head><title>Acta General — Fundación Arupo</title>
      <style>body{font-family:Arial,sans-serif;padding:2rem;color:#111;max-width:750px;margin:0 auto}
      h1{color:#7c3aed;font-size:1.5rem;margin:0 0 .25rem 0}.subtitle{color:#6b7280;font-size:.85rem;margin:0}
      table{width:100%;border-collapse:collapse;margin-top:1rem}
      th{background:#f5f3ff;color:#4b5563;padding:.75rem 1rem;text-align:left;font-size:.75rem;text-transform:uppercase;border:1px solid #e5e7eb}
      td{padding:.75rem 1rem;border:1px solid #e5e7eb;font-size:.9rem}
      .grand-total{margin-top:1.5rem;text-align:right;font-size:1.1rem;font-weight:bold;padding:1rem;background:#f5f3ff;border-radius:8px;color:#6d28d9;border:1px dashed #a855f7}
      .footer{margin-top:2.5rem;font-size:.75rem;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:1rem;text-align:center}
      .signatures{display:grid;grid-template-columns:1fr 1fr;gap:3rem;margin-top:3rem;text-align:center}
      .sig-line{border-top:1px solid #111;padding-top:.5rem;font-weight:bold;font-size:.85rem}</style>
      </head><body>${content}</body></html>`);
    doc.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#f5f3ff', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(124,58,237,0.2)' }}>
        <Gift size={28} color="#7c3aed" />
        <div>
          <div style={{ fontWeight: '700', color: '#7c3aed' }}>¡Entrega general registrada con éxito!</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Se entregaron {totalGeneral} ítems en total a {beneficiario?.nombre_completo}.</div>
        </div>
      </div>

      <div ref={printRef} style={{ fontSize: '0.9rem', background: '#fff', color: '#111', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #7c3aed', paddingBottom: '1.5rem' }}>
          <img src="/logo.png" alt="Logo" style={{ maxWidth: '120px', maxHeight: '80px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
          <div>
            <h1>Acta de Entrega de Ítems Generales</h1>
            <p className="subtitle">Fundación Arupo — Programa de Ayuda Humanitaria<br/>Fecha: {dateStr} a las {timeStr}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ background: '#f5f3ff', padding: '1rem', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6d28d9', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Entregado a</div>
            <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{beneficiario?.nombre_completo || '—'}</div>
            {beneficiario?.cedula && <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '0.2rem' }}>ID/CI: {beneficiario.cedula}</div>}
          </div>
        </div>

        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1rem' }}>Detalle de Ítems Entregados</div>

        <table>
          <thead>
            <tr>
              <th>Ítem</th>
              <th>Categoría</th>
              <th style={{ textAlign: 'right' }}>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {donaciones.map((d, i) => (
              <tr key={i}>
                <td style={{ fontWeight: '600' }}>{d.producto?.nombre}</td>
                <td>{d.producto?.categorias?.nombre || 'General'}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{d.total_despachado}</td>
              </tr>
            ))}
            <tr>
              <td colSpan="2" style={{ fontWeight: 'bold', background: '#f5f3ff', color: '#6d28d9' }}>TOTAL ENTREGADO</td>
              <td style={{ fontWeight: 'bold', background: '#f5f3ff', color: '#6d28d9', textAlign: 'right' }}>{totalGeneral}</td>
            </tr>
          </tbody>
        </table>

        <div className="grand-total">TOTAL GENERAL: {totalGeneral} ítems entregados</div>

        <div className="signatures">
          <div><div className="sig-line">Firma de Entrega (Fundación)</div></div>
          <div>
            <div className="sig-line">Firma de Recibido (Receptor)</div>
            <div style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '0.2rem' }}>C.I. ____________________</div>
          </div>
        </div>

        <p className="footer">Documento generado por Arupo Med-Track — Gestión de Insumos Generales.<br/>Conservar copia para fines de auditoría.</p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
        <Button variant="outline" onClick={handlePrint} style={{ gap: '0.5rem' }}><Printer size={16} /> Imprimir Acta</Button>
        <Button variant="primary" onClick={onClose}>Finalizar</Button>
      </div>
    </div>
  );
};
