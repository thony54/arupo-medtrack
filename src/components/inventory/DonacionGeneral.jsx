/**
 * DonacionGeneral.jsx
 * Formulario de ingreso rápido para ítems GENERALES (ropa, higiene, alimentos, etc.)
 *
 * DIFERENCIAS CON LoteForm.jsx (modo médico):
 * - NO requiere fecha de vencimiento real → se usa FECHA_NO_VENCE (2099-12-31)
 * - NO requiere N° de lote del proveedor → se autogenera LOTE-GENERAL-YYYY-XXXXX
 * - Solo muestra categorías no médicas (CATEGORIAS_GENERALES)
 * - Flujo simplificado: sin QR scanner, sin principio activo
 *
 * La tabla `lotes` es la misma — solo los valores varían.
 * NO se modifica ninguna tabla de la BD.
 */
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ListChecks, ShoppingBag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ActaIngreso } from './ActaIngreso';
import {
  CATEGORIAS_GENERALES,
  FECHA_NO_VENCE,
  generarLoteGeneral,
} from '../../utils/itemUtils';

export const DonacionGeneral = ({ isOpen, onClose, onSuccess }) => {
  const [productos, setProductos] = useState([]);   // ítems del catálogo de categoría general
  const [donantes, setDonantes] = useState([]);
  const [categorias, setCategorias] = useState([]); // solo categorías generales

  // Carrito
  const [cart, setCart] = useState([]);

  // Form states — ítem actual
  const [productoId, setProductoId] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [ubicacion, setUbicacion] = useState('');

  // Form global
  const [donanteId, setDonanteId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actaData, setActaData] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchProductos();
      fetchDonantes();
    }
  }, [isOpen]);

  const fetchProductos = async () => {
    if (!supabase) return;
    // Traer medicinas (tabla unificada) cuya categoría sea general
    const { data: cats } = await supabase
      .from('categorias')
      .select('id, nombre')
      .in('nombre', CATEGORIAS_GENERALES);

    const catIds = (cats || []).map(c => c.id);
    setCategorias(cats || []);

    if (catIds.length === 0) {
      setProductos([]);
      return;
    }

    const { data } = await supabase
      .from('medicinas')
      .select('id, nombre, presentacion, categorias(nombre)')
      .in('categoria_id', catIds)
      .order('nombre');
    setProductos(data || []);
  };

  const fetchDonantes = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('donantes')
      .select('id, nombre, tipo, contacto_responsable, cedula, telefono, email, direccion')
      .order('nombre');
    setDonantes(data || []);
  };

  const resetCurrentItem = () => {
    setProductoId('');
    setNuevoNombre('');
    setNuevaCategoria('');
    setCantidad('');
    setUbicacion('');
    setError('');
  };

  const resetAll = () => {
    resetCurrentItem();
    setDonanteId('');
    setCart([]);
    setActaData(null);
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    setError('');

    if (!productoId) { setError('Selecciona o escribe el nombre del ítem.'); return; }
    if (productoId === 'NEW' && !nuevoNombre.trim()) { setError('Escribe el nombre del nuevo ítem.'); return; }
    if (productoId === 'NEW' && !nuevaCategoria) { setError('Selecciona la categoría del nuevo ítem.'); return; }
    if (!cantidad || Number(cantidad) <= 0) { setError('La cantidad debe ser mayor a 0.'); return; }

    let displayName = '';
    if (productoId === 'NEW') {
      displayName = `${nuevoNombre.trim()} [${nuevaCategoria}] *(Nuevo)*`;
    } else {
      const prod = productos.find(p => p.id === productoId);
      displayName = prod ? `${prod.nombre}${prod.presentacion ? ` — ${prod.presentacion}` : ''}` : 'Ítem';
    }

    const loteAuto = generarLoteGeneral();

    setCart([...cart, {
      id: Date.now().toString(),
      productoId,
      nuevoNombre: nuevoNombre.trim(),
      nuevaCategoria,
      medNameDisplay: displayName,
      // Campos de lote con valores "generales"
      numeroLote: loteAuto,
      fechaVencimiento: FECHA_NO_VENCE, // "no vence"
      cantidad: Number(cantidad),
      ubicacion: ubicacion.trim() || null,
    }]);

    resetCurrentItem();
  };

  const removeFromCart = (id) => setCart(cart.filter(i => i.id !== id));

  const handleSubmitAll = async () => {
    if (cart.length === 0) return;
    try {
      setLoading(true);
      setError('');

      for (const item of cart) {
        let finalProductoId = item.productoId;

        // Si es ítem nuevo, insertarlo en la tabla `medicinas` (tabla unificada)
        if (item.productoId === 'NEW') {
          // Buscar o crear la categoría general
          let catId = null;
          const { data: catExist } = await supabase
            .from('categorias')
            .select('id')
            .ilike('nombre', item.nuevaCategoria.trim())
            .maybeSingle();

          if (catExist) {
            catId = catExist.id;
          } else {
            const { data: newCat, error: catErr } = await supabase
              .from('categorias')
              .insert({ nombre: item.nuevaCategoria.trim(), descripcion: 'Categoría general añadida automáticamente' })
              .select()
              .single();
            if (catErr) throw catErr;
            catId = newCat.id;
          }

          const { data: newProd, error: prodErr } = await supabase
            .from('medicinas')
            .insert({ nombre: item.nuevoNombre, categoria_id: catId })
            .select()
            .single();
          if (prodErr) throw prodErr;
          finalProductoId = newProd.id;
        }

        // Insertar el lote con fecha "no vence" y lote autogenerado
        const loteData = {
          producto_id: finalProductoId,
          donante_id: donanteId || null,
          numero_lote: item.numeroLote,           // LOTE-GENERAL-YYYY-XXXXX
          cantidad_actual: item.cantidad,
          fecha_vencimiento: item.fechaVencimiento, // 2099-12-31
          ubicacion_estante: item.ubicacion,
          estado: 'Disponible',
        };

        const { error: loteErr } = await supabase.from('lotes').insert(loteData);
        if (loteErr) throw loteErr;

        // Registrar movimiento de Entrada (misma tabla, compatible)
        await supabase.from('movimientos').insert({
          medicina_id: finalProductoId,
          tipo: 'Entrada',
          cantidad: item.cantidad,
          origen_destino: `Donación General — Lote: ${item.numeroLote}`,
        });
      }

      const donante = donantes.find(d => d.id === donanteId);
      setActaData({ donante, items: [...cart] });
      setCart([]);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Error al procesar la donación general.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); resetAll(); }}
      title={actaData ? 'Acta de Ingreso General' : 'Registrar Donación General'}
      footer={!actaData && (
        <>
          <Button type="button" variant="ghost" onClick={() => { onClose(); resetAll(); }}>Cancelar</Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmitAll}
            disabled={loading || cart.length === 0}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
          >
            {loading ? 'Procesando...' : `Guardar (${cart.length})`}
          </Button>
        </>
      )}
    >
      {actaData ? (
        <ActaIngreso
          donante={actaData.donante}
          items={actaData.items}
          onClose={() => { onClose(); resetAll(); }}
          modoGeneral={true}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Banner informativo */}
          <div style={{ padding: '0.875rem 1rem', background: '#f5f3ff', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#6d28d9', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <ShoppingBag size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>Modo <strong>Donación General</strong>: ropa, higiene, alimentos, etc. El lote se autogenera y no se aplica trazabilidad por vencimiento.</span>
          </div>

          {error && (
            <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* 1. Donante Global */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <label htmlFor="dg-donante" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
              1. Donante / Origen (aplica para todos los ítems)
            </label>
            <select
              id="dg-donante"
              className="input-field"
              style={{ marginBottom: 0, cursor: 'pointer' }}
              value={donanteId}
              onChange={e => setDonanteId(e.target.value)}
            >
              <option value="">— Sin donante registrado —</option>
              {donantes.map(d => (
                <option key={d.id} value={d.id}>{d.nombre} ({d.tipo})</option>
              ))}
            </select>
          </div>

          {/* 2. Añadir ítem */}
          <form onSubmit={handleAddToCart} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={16} color="#7c3aed" /> 2. Añadir Ítem a la Lista
            </div>

            {/* Selector de producto */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="dg-prod" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Ítem / Producto <span style={{ color: 'var(--danger-color)' }}>*</span>
              </label>
              <select
                id="dg-prod"
                className="input-field"
                style={{ marginBottom: 0, cursor: 'pointer' }}
                value={productoId}
                onChange={e => setProductoId(e.target.value)}
                required
              >
                <option value="">— Selecciona un ítem —</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} {p.categorias?.nombre ? `[${p.categorias.nombre}]` : ''}
                  </option>
                ))}
                <option value="NEW" style={{ fontWeight: 'bold', color: '#7c3aed' }}>[+] Nuevo ítem...</option>
              </select>
            </div>

            {/* Si es nuevo ítem */}
            {productoId === 'NEW' && (
              <div className="grid-responsive" style={{ gap: '1rem', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    Nombre del ítem <span style={{ color: 'var(--danger-color)' }}>*</span>
                  </label>
                  <input
                    className="input-field"
                    required
                    value={nuevoNombre}
                    onChange={e => setNuevoNombre(e.target.value)}
                    placeholder="Ej. Camiseta Talla M"
                    style={{ marginBottom: 0, border: '1px dashed #7c3aed' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    Categoría <span style={{ color: 'var(--danger-color)' }}>*</span>
                  </label>
                  <select
                    className="input-field"
                    required
                    value={nuevaCategoria}
                    onChange={e => setNuevaCategoria(e.target.value)}
                    style={{ marginBottom: 0, border: '1px dashed #7c3aed', cursor: 'pointer' }}
                  >
                    <option value="">— Selecciona categoría —</option>
                    {CATEGORIAS_GENERALES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Cantidad + Ubicación */}
            <div className="grid-responsive" style={{ gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="dg-cant" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Cantidad <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <input
                  id="dg-cant"
                  className="input-field"
                  style={{ marginBottom: 0 }}
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={e => setCantidad(e.target.value)}
                  placeholder="Ej. 50"
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="dg-ubic" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Ubicación / Zona
                </label>
                <input
                  id="dg-ubic"
                  className="input-field"
                  style={{ marginBottom: 0 }}
                  value={ubicacion}
                  onChange={e => setUbicacion(e.target.value)}
                  placeholder="Ej. Almacén B-2"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button type="submit" variant="outline" style={{ color: '#7c3aed', borderColor: '#7c3aed' }}>
                + Añadir a la Lista
              </Button>
            </div>
          </form>

          {/* Carrito */}
          {cart.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ListChecks size={16} /> Ítems a Registrar ({cart.length})
              </div>
              <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <table className="data-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Ítem</th>
                      <th>Lote (auto)</th>
                      <th>Cant.</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.id}>
                        <td>{item.medNameDisplay}</td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{item.numeroLote}</td>
                        <td style={{ fontWeight: '600' }}>{item.cantidad}</td>
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
