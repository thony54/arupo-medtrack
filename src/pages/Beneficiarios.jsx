import React, { useState, useEffect } from 'react';
import { UserPlus, Users, Phone, MapPin, FileText, Search, X, Trash2, IdCard, FileDown, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Comprobante } from '../components/inventory/Comprobante';
import * as XLSX from 'xlsx';
import './pages.css';

const CONDICIONES = ['Diabetes', 'Hipertensión', 'Cardiopatía', 'Embarazo', 'Adulto Mayor', 'Pediatría', 'Oncología', 'VIH/SIDA', 'Otra'];
const TIPOS = ['Particular', 'ONG', 'Hospital', 'Centro de Salud', 'Fundación', 'Comunidad'];
const DISCAPACIDADES = ['Física', 'Visual', 'Auditiva', 'Intelectual', 'Psicosocial', 'Múltiple'];

// ─── Importación desde Excel ────────────────────────────────────────────
// El orden de estas claves es EL MISMO que el del formulario "Registrar
// Beneficiario", para que quien llene la plantilla siga la misma secuencia
// de preguntas que hace al beneficiario en persona.
const COLUMN_SYNONYMS = {
  nombre: ['nombre / organización', 'nombre completo', 'nombre y apellido', 'nombres y apellidos', 'beneficiario', 'organización', 'organizacion', 'nombre', 'name'],
  tipo: ['tipo de beneficiario', 'tipo', 'categoria', 'categoría', 'clase'],
  contacto_responsable: ['contacto (responsable)', 'contacto responsable', 'responsable', 'quien recibe', 'contacto', 'representante'],
  cedula: ['cédula / id', 'cedula / id', 'cédula', 'cedula', 'identificación', 'identificacion', 'documento', 'ci', 'dni', 'id'],
  telefono: ['teléfono', 'telefono', 'celular', 'móvil', 'movil', 'contacto telefónico', 'contacto telefonico', 'tel'],
  email: ['correo electrónico', 'correo electronico', 'correo', 'email', 'e-mail', 'mail'],
  direccion: ['dirección', 'direccion', 'domicilio', 'sector', 'ubicación', 'ubicacion', 'barrio'],
  condicion_medica: ['condición médica', 'condicion medica', 'condición', 'condicion', 'enfermedad', 'patología', 'patologia', 'diagnóstico', 'diagnostico'],
  discapacidad_tipo: ['tipo de discapacidad', 'discapacidad', 'discapacidad tipo'],
  tiene_carnet_discapacidad: ['posee calificación de discapacidad', 'posee calificacion de discapacidad', 'calificación de discapacidad', 'calificacion de discapacidad', 'carnet de discapacidad', 'carnet', 'conadis', 'tiene carnet'],
  notas: ['notas adicionales', 'observaciones', 'notas', 'comentarios', 'observación', 'observacion'],
};

const COLUMN_LABELS = {
  nombre: 'Nombre / Organización',
  tipo: 'Tipo',
  contacto_responsable: 'Contacto (Responsable)',
  cedula: 'Cédula / ID',
  telefono: 'Teléfono',
  email: 'Correo Electrónico',
  direccion: 'Dirección',
  condicion_medica: 'Condición Médica',
  discapacidad_tipo: 'Discapacidad',
  tiene_carnet_discapacidad: '¿Posee Calificación de discapacidad?',
  notas: 'Notas Adicionales',
};

// Empareja las cabeceras del Excel con los campos del formulario.
// Primero busca coincidencia exacta y, si no la hay, parcial.
const autoMapHeaders = (excelHeaders) => {
  const mapping = {};
  const usadas = new Set();
  Object.keys(COLUMN_SYNONYMS).forEach(field => {
    const sinonimos = COLUMN_SYNONYMS[field];
    const norm = (h) => h.toString().trim().toLowerCase().replace(/[.:]$/, '');

    let match = excelHeaders.find(h => h && !usadas.has(h) && sinonimos.some(s => s === norm(h)));
    if (!match) {
      match = excelHeaders.find(h => h && !usadas.has(h) && sinonimos.some(s => norm(h).includes(s)));
    }
    if (match) usadas.add(match);
    mapping[field] = match || '';
  });
  return mapping;
};

// Cuántas celdas de una fila se reconocen como campos del formulario.
const contarCamposReconocidos = (fila) => {
  const norm = (h) => h.toString().trim().toLowerCase().replace(/[.:]$/, '');
  const todos = Object.values(COLUMN_SYNONYMS);
  return (fila || [])
    .filter(c => c !== '' && c !== null && c !== undefined)
    .filter(c => {
      const h = norm(c);
      return todos.some(sins => sins.some(s => h === s || h.includes(s)));
    }).length;
};

// Localiza la fila de cabeceras. Se elige la que MÁS campos reconoce, no la
// primera que mencione uno: un título como "LISTADO DE BENEFICIARIOS 2026"
// contiene la palabra "beneficiarios" pero es una sola celda, no la tabla.
const detectarFilaCabecera = (filas) => {
  let mejor = -1;
  let mejorPuntaje = 1; // hacen falta al menos 2 columnas reconocidas
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const puntaje = contarCamposReconocidos(filas[i]);
    if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = i; }
  }
  if (mejor !== -1) return mejor;
  // Sin cabeceras reconocibles: la primera fila con varias celdas llenas
  const alterno = filas.findIndex(f => f && f.filter(c => c !== '').length > 2);
  return alterno === -1 ? 0 : alterno;
};

// "SI", "X", "1", "verdadero"… → true. Cualquier otra cosa → false.
const parseBooleano = (valor) => {
  if (valor === true) return true;
  if (valor === undefined || valor === null || valor === '') return false;
  const v = valor.toString().trim().toLowerCase();
  return ['si', 'sí', 's', 'yes', 'y', 'true', 'verdadero', '1', 'x'].includes(v);
};

// Devuelve el valor de la lista oficial si coincide (ignorando tildes y
// mayúsculas); si no, respeta lo que escribió el usuario en el Excel.
const normalizarContraLista = (valor, lista) => {
  if (!valor) return '';
  const limpio = valor.toString().trim();
  const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const encontrado = lista.find(op => sinTildes(op) === sinTildes(limpio));
  return encontrado || limpio;
};

export const Beneficiarios = () => {
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // for history panel
  const [historial, setHistorial] = useState([]);
  const [entregas, setEntregas] = useState([]); // saved actas for the selected beneficiary
  const [actaView, setActaView] = useState(null); // acta being viewed/printed

  // Form states
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('Particular');
  const [contactoResponsable, setContactoResponsable] = useState('');
  const [cedula, setCedula] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [condicion, setCondicion] = useState('');
  const [discapacidad, setDiscapacidad] = useState('');
  const [tieneCarnet, setTieneCarnet] = useState(false);
  const [notas, setNotas] = useState('');

  // ─── Estado de la importación desde Excel ───
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importStep, setImportStep] = useState(1); // 1: subir · 2: mapear · 3: resultado
  const [importRows, setImportRows] = useState([]);
  const [importHeaders, setImportHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importOk, setImportOk] = useState(0);
  const [importOmitidos, setImportOmitidos] = useState([]);

  useEffect(() => { fetchBeneficiarios(); }, []);

  const fetchBeneficiarios = async () => {
    setLoading(true);
    try {
      if (!supabase) throw new Error('Sin conexión');
      const { data, error: err } = await supabase
        .from('beneficiarios')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;

      // Get donation count per beneficiary
      const { data: movData } = await supabase
        .from('movimientos')
        .select('beneficiario_id')
        .eq('tipo', 'Salida')
        .not('beneficiario_id', 'is', null);

      const countMap = {};
      (movData || []).forEach(m => { countMap[m.beneficiario_id] = (countMap[m.beneficiario_id] || 0) + 1; });
      setBeneficiarios((data || []).map(b => ({ ...b, donaciones_count: countMap[b.id] || 0 })));
    } catch {
      setBeneficiarios([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorial = async (ben) => {
    setSelected(ben);
    if (!supabase) return;

    // Actas de entrega guardadas (una factura por donación, descargable)
    const { data: entregasData } = await supabase
      .from('entregas')
      .select('*')
      .eq('beneficiario_id', ben.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setEntregas(entregasData || []);

    // Movimientos individuales (respaldo / donaciones anteriores sin acta)
    const { data } = await supabase
      .from('movimientos')
      .select('*, medicinas(nombre)')
      .eq('beneficiario_id', ben.id)
      .eq('tipo', 'Salida')
      .order('timestamp', { ascending: false })
      .limit(20);
    setHistorial(data || []);
  };

  const resetForm = () => {
    setNombre(''); setTipo('Particular'); setContactoResponsable('');
    setCedula(''); setTelefono(''); setEmail(''); setDireccion('');
    setCondicion(''); setDiscapacidad(''); setTieneCarnet(false);
    setNotas(''); setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('El Nombre/Organización es obligatorio.'); return; }

    try {
      setSaving(true);
      const { error: err } = await supabase.from('beneficiarios').insert({
        nombre: nombre.trim(),
        tipo: tipo,
        contacto_responsable: contactoResponsable.trim() || null,
        cedula: cedula.trim() || null,
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        direccion: direccion.trim() || null,
        condicion_medica: condicion || null,
        discapacidad_tipo: discapacidad.trim() || null,
        tiene_carnet_discapacidad: tieneCarnet,
        notas: notas.trim() || null
      });
      if (err) throw err;
      resetForm(); setIsModalOpen(false); fetchBeneficiarios();
    } catch (err) {
      setError(err.message || 'Error al guardar. Asegúrate de que la Cédula/ID sea única si la ingresaste.');
    } finally { setSaving(false); }
  };

  const handleDeleteBeneficiario = async (e, id, nombre) => {
    e.stopPropagation();
    if (window.confirm(`¿Estás seguro de borrar el beneficiario "${nombre}"? Esta acción no se puede deshacer.`)) {
      try {
        setLoading(true);
        if (supabase) {
          const { error: delError } = await supabase.from('beneficiarios').delete().eq('id', id);
          if (delError) throw delError;
          await fetchBeneficiarios();
          if (selected?.id === id) setSelected(null);
        }
      } catch (err) {
        alert(err.message || 'Error al borrar.');
      } finally {
        setLoading(false);
      }
    }
  };

  // ─── Importación desde Excel ─────────────────────────────────────────
  const resetImport = () => {
    setIsImportOpen(false);
    setImportStep(1);
    setImportRows([]);
    setImportHeaders([]);
    setColumnMapping({});
    setImportLoading(false);
    setImportError('');
    setImportOk(0);
    setImportOmitidos([]);
    const input = document.getElementById('excel-beneficiarios-input');
    if (input) input.value = ''; // permitir volver a elegir el mismo archivo
  };

  const handleExcelFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportError('');
    setImportLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Fila de cabeceras (tolera títulos y filas vacías encima de la tabla)
        const idxCabecera = detectarFilaCabecera(filas);

        const cabeceras = (filas[idxCabecera] || [])
          .map(h => (h ? h.toString().trim() : ''))
          .filter(h => h !== '');
        if (cabeceras.length === 0) {
          throw new Error('No se reconocieron las cabeceras del archivo. Revisa que la primera fila tenga los nombres de las columnas.');
        }

        const datos = [];
        for (let i = idxCabecera + 1; i < filas.length; i++) {
          const fila = filas[i];
          if (!fila || fila.length === 0) continue;
          const obj = {};
          let tieneContenido = false;
          (filas[idxCabecera] || []).forEach((nombreCol, col) => {
            if (nombreCol !== undefined && nombreCol !== null && nombreCol !== '') {
              const val = fila[col];
              obj[nombreCol.toString().trim()] = val !== undefined ? val : '';
              if (val !== undefined && val !== '') tieneContenido = true;
            }
          });
          if (tieneContenido) datos.push(obj);
        }

        if (datos.length === 0) {
          throw new Error('El archivo no contiene filas de datos debajo de las cabeceras.');
        }

        setImportHeaders(cabeceras);
        setImportRows(datos);
        setColumnMapping(autoMapHeaders(cabeceras));
        setImportStep(2);
      } catch (err) {
        setImportError(err.message || 'No se pudo leer el archivo Excel.');
      } finally {
        setImportLoading(false);
      }
    };
    reader.onerror = () => {
      setImportError('Error al leer el archivo.');
      setImportLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  // Convierte una fila del Excel en el mismo objeto que guarda el formulario
  const filaABeneficiario = (row) => {
    const val = (campo) => {
      const col = columnMapping[campo];
      if (!col) return '';
      const v = row[col];
      return v === undefined || v === null ? '' : v.toString().trim();
    };

    return {
      nombre: val('nombre'),
      tipo: normalizarContraLista(val('tipo'), TIPOS) || 'Particular',
      contacto_responsable: val('contacto_responsable') || null,
      cedula: val('cedula') || null,
      telefono: val('telefono') || null,
      email: val('email') || null,
      direccion: val('direccion') || null,
      condicion_medica: normalizarContraLista(val('condicion_medica'), CONDICIONES) || null,
      discapacidad_tipo: normalizarContraLista(val('discapacidad_tipo'), DISCAPACIDADES) || null,
      tiene_carnet_discapacidad: parseBooleano(columnMapping.tiene_carnet_discapacidad ? row[columnMapping.tiene_carnet_discapacidad] : ''),
      notas: val('notas') || null,
    };
  };

  const ejecutarImportacion = async () => {
    if (!supabase) { setImportError('Sin conexión con el servidor.'); return; }
    setImportLoading(true);
    setImportError('');

    const omitidos = [];
    let correctos = 0;

    // Cédulas ya registradas: evita chocar contra la restricción de unicidad
    // y, de paso, no duplica a alguien que ya está en el sistema.
    const cedulasExistentes = new Set(
      beneficiarios.filter(b => b.cedula).map(b => b.cedula.trim().toLowerCase())
    );

    try {
      for (let i = 0; i < importRows.length; i++) {
        const fila = importRows[i];
        const numeroFila = i + 1;
        const datos = filaABeneficiario(fila);

        if (!datos.nombre) {
          omitidos.push({ fila: numeroFila, nombre: '(sin nombre)', motivo: 'Falta el nombre, es obligatorio' });
          continue;
        }

        if (datos.cedula) {
          const clave = datos.cedula.toLowerCase();
          if (cedulasExistentes.has(clave)) {
            omitidos.push({ fila: numeroFila, nombre: datos.nombre, motivo: `La cédula ${datos.cedula} ya está registrada` });
            continue;
          }
          cedulasExistentes.add(clave); // también evita duplicados dentro del propio archivo
        }

        const { error: insertErr } = await supabase.from('beneficiarios').insert(datos);
        if (insertErr) {
          console.error(`Error al importar la fila ${numeroFila}:`, insertErr);
          omitidos.push({ fila: numeroFila, nombre: datos.nombre, motivo: 'La base de datos rechazó el registro' });
          continue;
        }
        correctos++;
      }

      setImportOk(correctos);
      setImportOmitidos(omitidos);
      setImportStep(3);
      await fetchBeneficiarios();
    } catch (err) {
      console.error('Error durante la importación:', err);
      setImportError('Ocurrió un error inesperado durante la importación.');
    } finally {
      setImportLoading(false);
    }
  };

  const filtered = beneficiarios.filter(b => {
    const s = search.toLowerCase();
    return (b.nombre || '').toLowerCase().includes(s) ||
      (b.codigo || '').toLowerCase().includes(s) ||
      (b.cedula || '').toLowerCase().includes(s) ||
      (b.discapacidad_tipo || '').toLowerCase().includes(s) ||
      (b.condicion_medica || '').toLowerCase().includes(s) ||
      (b.contacto_responsable || '').toLowerCase().includes(s);
  });

  return (
    <>
      <div className="animate-fade-in flex-responsive" style={{ alignItems: 'flex-start' }}>
        {/* Main Panel */}
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          <div className="page-header">
            <div>
              <h1 className="page-title">Beneficiarios</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                onClick={() => { resetImport(); setIsImportOpen(true); }}
                style={{ color: '#16a34a', borderColor: '#16a34a', background: '#f0fdf4', gap: '0.4rem', fontWeight: '700' }}
                aria-label="Importar beneficiarios desde archivo Excel"
              >
                <Upload size={16} /> Importar Excel
              </Button>
              <Button variant="primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
                <UserPlus size={18} /> Añadir Beneficiario
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
              <input className="input-field" style={{ paddingLeft: '2.75rem', marginBottom: 0, width: '100%' }}
                placeholder="Buscar por código, nombre, cédula, discapacidad o condición..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre / Organización</th>
                  <th>Tipo</th>
                  <th>Contacto & ID</th>
                  <th>Info Médica</th>
                  <th style={{ textAlign: 'center' }}>Donaciones</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>Cargando datos de beneficiarios...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                      <Users size={40} style={{ display: 'block', margin: '0 auto 0.75rem', color: 'var(--text-tertiary)' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>No se encontraron beneficiarios.</span>
                    </td>
                  </tr>
                ) : filtered.map(b => (
                  <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => fetchHistorial(b)}>
                    <td style={{ fontWeight: '700', color: 'var(--primary-color)' }}>{b.codigo || '—'}</td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{b.nombre}</div>
                      {b.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{b.email}</div>}
                    </td>
                    <td><span style={{ fontSize: '0.75rem', background: 'var(--bg-surface-hover)', padding: '0.25rem 0.65rem', borderRadius: 'var(--radius-pill)', fontWeight: '600', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>{b.tipo}</span></td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{b.contacto_responsable || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ID: {b.cedula || 'N/A'} • {b.telefono || '—'}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                        {b.condicion_medica ? <span style={{ background: 'var(--warning-bg)', color: 'var(--warning-color)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-pill)', fontSize: '0.75rem', fontWeight: '700', border: '1px solid rgba(245,158,11,0.2)' }}>{b.condicion_medica}</span> : null}
                        {b.discapacidad_tipo ? <span style={{ background: 'var(--danger-bg)', color: 'var(--danger-color)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-pill)', fontSize: '0.75rem', fontWeight: '700', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><IdCard size={12} /> {b.discapacidad_tipo} {b.tiene_carnet_discapacidad && '(Con Carnet)'}</span> : null}
                        {!b.condicion_medica && !b.discapacidad_tipo && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', fontStyle: 'italic' }}>Sin condiciones</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--primary-color)' }}>{b.donaciones_count}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={(e) => handleDeleteBeneficiario(e, b.id, b.nombre)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color)', padding: '0.25rem', opacity: 0.8 }}
                        title="Borrar Beneficiario"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* History Side Panel */}
        {selected && (
          <div className="card animate-fade-in mobile-full-width" style={{ width: '340px', flexShrink: 0, position: 'sticky', top: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.2rem' }}>{selected.codigo}</div>
                <div style={{ fontWeight: '700', fontSize: '1rem', lineHeight: '1.2' }}>{selected.nombre}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>{selected.tipo} • ID: {selected.cedula || 'N/A'}</div>
              </div>
              <button onClick={() => { setSelected(null); setEntregas([]); setHistorial([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {selected.contacto_responsable && <div style={{ fontSize: '0.85rem' }}><strong style={{ color: 'var(--text-secondary)' }}>Contacto:</strong> {selected.contacto_responsable}</div>}
              {selected.telefono && <div style={{ fontSize: '0.85rem' }}><strong style={{ color: 'var(--text-secondary)' }}>Tel:</strong> {selected.telefono}</div>}
              {selected.direccion && <div style={{ fontSize: '0.85rem' }}><strong style={{ color: 'var(--text-secondary)' }}>Dir:</strong> {selected.direccion}</div>}
            </div>

            <div style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              Historial de Donaciones Recibidas
            </div>

            {entregas.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {entregas.map(ent => {
                  const meds = ent.acta?.donaciones || [];
                  return (
                    <div key={ent.id} style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', background: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                          {new Date(ent.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div style={{ color: 'var(--text-tertiary)', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {meds.length} medicamento{meds.length !== 1 ? 's' : ''} · <span style={{ fontWeight: '700', color: 'var(--success-color)' }}>{ent.total_unidades} u.</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setActaView(ent.acta)}
                        title="Descargar / imprimir factura de esta donación"
                        style={{ background: 'var(--primary-light)', border: '1px solid rgba(5,150,105,0.25)', color: 'var(--primary-color)', cursor: 'pointer', padding: '0.5rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      >
                        <FileDown size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : historial.length === 0 ? (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Aún no ha recibido donaciones registradas.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', fontStyle: 'italic', margin: '0 0 0.25rem' }}>
                  Estas donaciones se registraron antes de activar las facturas descargables, por eso no tienen acta.
                </p>
                {historial.map(h => (
                  <div key={h.id} style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', background: 'var(--bg-surface)' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{h.medicinas?.nombre}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)', marginTop: '0.35rem' }}>
                      <span>{new Date(h.timestamp).toLocaleDateString('es-ES')}</span>
                      <span style={{ fontWeight: '700', color: 'var(--success-color)' }}>+{h.cantidad} u.</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title="Registrar Beneficiario"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); resetForm(); }}>Cancelar</Button>
            <Button
              type="button"
              variant="primary"
              disabled={saving}
              onClick={() => document.getElementById('b-submit-trigger').click()}
            >
              {saving ? 'Guardando...' : 'Guardar Beneficiario'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>{error}</div>}

          <div style={{ padding: '0.75rem', background: 'var(--primary-light)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--primary-color)' }}>
            <strong style={{ fontWeight: '700' }}>Nota:</strong> El código de beneficiario (BEN-XXXX) se generará automáticamente al guardar.
          </div>

          <div className="grid-responsive" style={{ gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 2 }}>
              <label htmlFor="b-nombre" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Nombre / Organización <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <input id="b-nombre" className="input-field" style={{ marginBottom: 0 }} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Fundación Sonrisas o Juan Pérez" required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
              <label htmlFor="b-tipo" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Tipo</label>
              <select id="b-tipo" className="input-field" style={{ marginBottom: 0, appearance: 'none' }} value={tipo} onChange={e => setTipo(e.target.value)}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid-responsive" style={{ gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="b-contacto" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Contacto (Responsable)</label>
              <input id="b-contacto" className="input-field" style={{ marginBottom: 0 }} value={contactoResponsable} onChange={e => setContactoResponsable(e.target.value)} placeholder="Nombre de quien recibe" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="b-cedula" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Cédula / ID</label>
              <input id="b-cedula" className="input-field" style={{ marginBottom: 0 }} value={cedula} onChange={e => setCedula(e.target.value)} placeholder="V-12345678" />
            </div>
          </div>

          <div className="grid-responsive" style={{ gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="b-tel" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Teléfono</label>
              <input id="b-tel" className="input-field" style={{ marginBottom: 0 }} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="04XX-1234567" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="b-email" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Correo Electrónico</label>
              <input id="b-email" type="email" className="input-field" style={{ marginBottom: 0 }} value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="b-dir" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Dirección <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <input id="b-dir" className="input-field" style={{ marginBottom: 0 }} value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Sector ciudad y provincia, calles del domicilio." required />
          </div>

          {/* Información Médica */}
          <div style={{ padding: '1rem', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Información Médica (Opcional)
            </div>

            <div className="grid-responsive" style={{ gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="b-condicion" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Condición Médica</label>
                <select id="b-condicion" className="input-field" style={{ marginBottom: 0, appearance: 'none' }} value={condicion} onChange={e => setCondicion(e.target.value)}>
                  <option value="">Ninguna / No especificada</option>
                  {CONDICIONES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="b-discapacidad" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Discapacidad</label>
                <input
                  list="discapacidades-list"
                  id="b-discapacidad"
                  className="input-field"
                  style={{ marginBottom: 0 }}
                  value={discapacidad}
                  onChange={e => setDiscapacidad(e.target.value)}
                  placeholder="Escriba o seleccione..."
                />
                <datalist id="discapacidades-list">
                  {DISCAPACIDADES.map(d => <option key={d} value={d} />)}
                </datalist>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.25rem' }}>
              <input
                type="checkbox"
                checked={tieneCarnet}
                onChange={e => setTieneCarnet(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>¿Posee Calificación de discapacidad?</span>
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="b-notas" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Notas Adicionales</label>
            <textarea id="b-notas" className="input-field" style={{ marginBottom: 0, resize: 'vertical', minHeight: '60px' }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Cualquier información relevante..." />
          </div>

          <button type="submit" id="b-submit-trigger" style={{ display: 'none' }} aria-hidden="true" />
        </form>
      </Modal>

      {/* ─── Modal: Importar beneficiarios desde Excel ─── */}
      <Modal
        isOpen={isImportOpen}
        onClose={resetImport}
        title="Importar Beneficiarios desde Excel"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={resetImport} disabled={importLoading}>
              {importStep === 3 ? 'Cerrar' : 'Cancelar'}
            </Button>
            {importStep === 2 && (
              <Button
                type="button"
                variant="primary"
                disabled={importLoading || !columnMapping.nombre}
                onClick={ejecutarImportacion}
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none' }}
              >
                {importLoading ? 'Importando...' : `Importar ${importRows.length} fila(s)`}
              </Button>
            )}
          </>
        }
      >
        <div style={{ minHeight: '260px' }}>
          {importError && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', border: '1px solid rgba(239,68,68,0.2)' }}>
              {importError}
            </div>
          )}

          {/* Paso 1 — Subir el archivo */}
          {importStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                onClick={() => document.getElementById('excel-beneficiarios-input').click()}
                style={{ border: '2px dashed #16a34a', borderRadius: 'var(--radius-lg)', padding: '3rem 2rem', textAlign: 'center', background: '#f0fdf4', cursor: 'pointer' }}
              >
                <Upload size={44} style={{ color: '#16a34a', marginBottom: '1rem' }} />
                <h3 style={{ color: '#15803d', fontWeight: '700', marginBottom: '0.5rem' }}>
                  {importLoading ? 'Leyendo archivo...' : 'Subir documento Excel'}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Haz clic para buscar el archivo. Admite .xlsx, .xls y .csv.
                </p>
                <input
                  id="excel-beneficiarios-input"
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelFile}
                  style={{ display: 'none' }}
                />
              </div>

              <div style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Columnas esperadas (el mismo orden en que se le pregunta al beneficiario):
                </p>
                <ol style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '1.1rem', lineHeight: '1.7', margin: 0 }}>
                  {Object.keys(COLUMN_LABELS).map(k => (
                    <li key={k}>
                      {COLUMN_LABELS[k]}
                      {k === 'nombre' && <strong style={{ color: 'var(--danger-color)' }}> (obligatorio)</strong>}
                    </li>
                  ))}
                </ol>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.75rem', marginBottom: 0 }}>
                  No hace falta que estén todas ni con ese nombre exacto: en el siguiente paso
                  podrás corregir a mano qué columna corresponde a cada campo.
                </p>
              </div>
            </div>
          )}

          {/* Paso 2 — Mapear columnas y previsualizar */}
          {importStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: '#f0fdf4', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📋</span>
                <div>
                  <h4 style={{ fontWeight: '700', color: '#15803d', fontSize: '0.9rem' }}>Archivo leído correctamente</h4>
                  <p style={{ fontSize: '0.8rem', color: '#166534' }}>
                    Se detectaron <strong>{importRows.length}</strong> fila(s). Revisa que cada campo apunte a la columna correcta.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', background: 'var(--bg-surface-hover)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                {Object.keys(COLUMN_SYNONYMS).map(field => (
                  <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                      {COLUMN_LABELS[field]}
                      {field === 'nombre' && <span style={{ color: 'var(--danger-color)' }}> *</span>}
                    </label>
                    <select
                      className="input-field"
                      style={{ marginBottom: 0, fontSize: '0.825rem', padding: '0.35rem', cursor: 'pointer' }}
                      value={columnMapping[field] || ''}
                      onChange={e => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                    >
                      <option value="">— No importar —</option>
                      {importHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {!columnMapping.nombre && (
                <div style={{ padding: '0.75rem 1rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.825rem' }}>
                  Indica qué columna contiene el <strong>Nombre / Organización</strong>: sin ese dato no se puede registrar a nadie.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <h4 style={{ fontSize: '0.825rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Vista previa de las primeras 4 filas:</h4>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', maxHeight: '190px' }}>
                  <table style={{ width: '100%', fontSize: '0.725rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '0.5rem' }}>Nombre</th>
                        <th style={{ padding: '0.5rem' }}>Cédula</th>
                        <th style={{ padding: '0.5rem' }}>Teléfono</th>
                        <th style={{ padding: '0.5rem' }}>Discapacidad</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Calificación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 4).map((row, idx) => {
                        const b = filaABeneficiario(row);
                        return (
                          <tr key={idx} style={{ borderBottom: idx < 3 ? '1px solid var(--border-color)' : 'none' }}>
                            <td style={{ padding: '0.5rem', fontWeight: '600' }}>
                              {b.nombre || <span style={{ color: 'var(--danger-color)', fontStyle: 'italic' }}>Vacío (se omitirá)</span>}
                            </td>
                            <td style={{ padding: '0.5rem' }}>{b.cedula || '—'}</td>
                            <td style={{ padding: '0.5rem' }}>{b.telefono || '—'}</td>
                            <td style={{ padding: '0.5rem' }}>{b.discapacidad_tipo || '—'}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>{b.tiene_carnet_discapacidad ? 'Sí' : 'No'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Paso 3 — Resultado */}
          {importStep === 3 && (
            <div style={{ padding: '1.5rem 0.5rem' }}>
              <div style={{ textAlign: 'center', marginBottom: importOmitidos.length > 0 ? '1.5rem' : 0 }}>
                <div style={{ width: '64px', height: '64px', background: '#dcfce7', color: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '2rem', fontWeight: 'bold' }}>
                  ✓
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#15803d', marginBottom: '0.5rem' }}>Importación finalizada</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Se registraron <strong>{importOk}</strong> beneficiario(s)
                  {importOmitidos.length > 0 && <> y se omitieron <strong>{importOmitidos.length}</strong></>}.
                </p>
              </div>

              {importOmitidos.length > 0 && (
                <div style={{ background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                  <p style={{ fontSize: '0.825rem', fontWeight: '700', color: 'var(--warning-color)', marginBottom: '0.5rem' }}>
                    Filas que no se importaron:
                  </p>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {importOmitidos.map((o, i) => (
                      <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <strong>Fila {o.fila}</strong> — {o.nombre}: {o.motivo}
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.75rem', marginBottom: 0 }}>
                    Corrige esas filas en el Excel y vuelve a importar solo ellas; las ya registradas no se duplicarán.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Acta / Factura de una donación guardada */}
      <Modal
        isOpen={!!actaView}
        onClose={() => setActaView(null)}
        title="Acta de Donación"
      >
        {actaView && (
          <Comprobante
            beneficiario={actaView.beneficiario}
            donaciones={actaView.donaciones || []}
            onClose={() => setActaView(null)}
          />
        )}
      </Modal>
    </>
  );
};

