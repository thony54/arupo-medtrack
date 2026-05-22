import React, { useState, useEffect } from 'react';
import { Plus, Database, FlaskConical, Pill, Tag, Trash2, ShoppingBag, Stethoscope, Edit2, Upload, HelpCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CATEGORIAS_GENERALES, esCategoriaMediaca, generarLoteGeneral, FECHA_NO_VENCE } from '../utils/itemUtils';
import * as XLSX from 'xlsx';
import './pages.css';

// Categorías médicas predefinidas para orientar al usuario
const CATEGORIAS_MEDICAS_SUGERIDAS = ['Analgésicos', 'Antibióticos', 'Antiinflamatorios', 'Antiparasitarios', 'Vitaminas', 'Antihistamínicos', 'Cardiovasculares', 'Otro'];

// Sinónimos inteligentes para mapear automáticamente las columnas del archivo Excel
const COLUMN_SYNONYMS = {
  nombre: ['nombre del medicamento', 'nombre del medicamento.', 'nombre', 'name', 'medicina', 'medicamento', 'producto', 'item', 'descripción', 'descripcion', 'artículo', 'articulo', 'desc'],
  categoria: ['categoría', 'categoria', 'grupo', 'tipo', 'clase', 'category', 'department', 'seccion'],
  laboratorio: ['laboratorio.', 'laboratorio', 'lab', 'fabricante', 'marca', 'laboratory', 'maker', 'brand'],
  presentacion: ['presentación.', 'presentación', 'presentacion', 'formato', 'envase', 'tipo envase', 'presentation', 'unit'],
  cantidad_por_presentacion: ['cantidad x presentación', 'cantidad x presentacion', 'cant x pres', 'cantidad por presentación', 'cantidad por presentacion', 'cpp'],
  cantidad: ['cant. total', 'cant total', 'cantidad total', 'stock', 'cantidad', 'total', 'cant', 'quantity', 'inventario', 'inicial', 'qty'],
  lote: ['lote', 'lote nro', 'lote #', 'numero lote', 'número lote', 'batch', 'lot', 'serial'],
  fecha_vencimiento: ['caducidad.', 'caducidad', 'fecha vencimiento', 'vencimiento', 'vence', 'fecha caducidad', 'fecha de vencimiento', 'expiration', 'expiry', 'fecha', 'venc'],
  observaciones: ['observaciones', 'notas', 'comentarios', 'observación', 'observacion', 'notes', 'comments', 'obs']
};

const autoMapHeaders = (excelHeaders) => {
  const mapping = {};
  Object.keys(COLUMN_SYNONYMS).forEach(field => {
    const synonyms = COLUMN_SYNONYMS[field];
    // Primero buscar coincidencia exacta limpia (reemplazando puntos finales)
    let matchedHeader = excelHeaders.find(h => {
      if (!h) return false;
      const hNorm = h.toString().trim().toLowerCase().replace(/\.$/, '');
      return synonyms.some(syn => syn.replace(/\.$/, '') === hNorm);
    });
    // Si no hay coincidencia exacta, buscar coincidencia parcial
    if (!matchedHeader) {
      matchedHeader = excelHeaders.find(h => {
        if (!h) return false;
        const hNorm = h.toString().trim().toLowerCase();
        return synonyms.some(syn => hNorm.includes(syn));
      });
    }
    mapping[field] = matchedHeader || '';
  });
  return mapping;
};

const parseExcelDate = (excelDate) => {
  if (!excelDate) return null;
  if (excelDate instanceof Date) {
    return excelDate.toISOString().split('T')[0];
  }
  if (typeof excelDate === 'string') {
    const d = new Date(excelDate);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    const parts = excelDate.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toISOString().split('T')[0];
        }
      }
      if (parts[0].length === 4) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toISOString().split('T')[0];
        }
      }
    }
  }
  if (typeof excelDate === 'number') {
    const dateObj = new Date((excelDate - 25569) * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  }
  return null;
};

const VIAS_ADMINISTRACION_SUGERIDAS = [
  'Oral',
  'Intravenosa',
  'Intramuscular',
  'Subcutánea',
  'Tópica',
  'Oftálmica',
  'Ótica',
  'Sublingual',
  'Inhalatoria',
  'Otro (Escribir...)'
];

export const Catalog = () => {
  const [medicinas, setMedicinas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filtro visual (médicos / generales / todos)
  const [filtroTipo, setFiltroTipo] = useState('todos');

  // Form states
  const [nombre, setNombre] = useState('');
  const [nombreGenerico, setNombreGenerico] = useState('');
  const [nombreComercial, setNombreComercial] = useState('');
  const [concentracion, setConcentracion] = useState('');
  const [viaAdministracion, setViaAdministracion] = useState('');
  const [viaAdministracionCustom, setViaAdministracionCustom] = useState('');
  const [cantidadUnidades, setCantidadUnidades] = useState('');
  const [numeroCajas, setNumeroCajas] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [newCategoriaNombre, setNewCategoriaNombre] = useState('');
  const [tipoRegistro, setTipoRegistro] = useState('medico'); // 'medico' | 'general'
  const [presentacion, setPresentacion] = useState('');
  const [laboratorio, setLaboratorio] = useState('');
  const [cantidadPorPresentacion, setCantidadPorPresentacion] = useState('');
  const [cantidadTotal, setCantidadTotal] = useState('');
  const [numeroLote, setNumeroLote] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [editingId, setEditingId] = useState(null);

  // Excel Import states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importHeaders, setImportHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [importStep, setImportStep] = useState(1); // 1: upload, 2: mapping/preview, 3: success
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccessCount, setImportSuccessCount] = useState(0);
  const [detectedCategory, setDetectedCategory] = useState('Otros');

  useEffect(() => {
    fetchData();
  }, []);

  // Recalcular stock automáticamente en base a Cantidad (unidades por caja) y Número de Cajas
  useEffect(() => {
    if (tipoRegistro === 'medico' && !editingId) {
      const unidades = Number(cantidadUnidades) || 0;
      const cajas = Number(numeroCajas) || 0;
      setCantidadTotal(unidades * cajas > 0 ? String(unidades * cajas) : '');
    }
  }, [cantidadUnidades, numeroCajas, tipoRegistro, editingId]);

  const fetchData = async () => {
    if (!supabase) return;
    try {
      const [medRes, catRes] = await Promise.all([
        supabase.from('medicinas').select('*, categorias(nombre)').order('nombre'),
        supabase.from('categorias').select('*').order('nombre')
      ]);
      if (medRes.error) throw medRes.error;
      if (catRes.error) throw catRes.error;
      setMedicinas(medRes.data || []);
      setCategorias(catRes.data || []);
    } catch (err) {
      console.error('Error al cargar datos:', err);
    }
  };

  const resetForm = () => {
    setNombre('');
    setNombreGenerico('');
    setNombreComercial('');
    setConcentracion('');
    setViaAdministracion('');
    setViaAdministracionCustom('');
    setCantidadUnidades('');
    setNumeroCajas('');
    setCategoriaId('');
    setNewCategoriaNombre('');
    setPresentacion('');
    setLaboratorio('');
    setCantidadPorPresentacion('');
    setCantidadTotal('');
    setNumeroLote('');
    setFechaVencimiento('');
    setObservaciones('');
    setTipoRegistro('medico');
    setEditingId(null);
    setError('');
  };

  const resetImportState = () => {
    setIsImportModalOpen(false);
    setImportRows([]);
    setImportHeaders([]);
    setColumnMapping({});
    setImportStep(1);
    setImportLoading(false);
    setImportError('');
    setImportSuccessCount(0);
    setDetectedCategory('Otros');
    
    // Clear file input value so the same file can be selected again
    const fileInput = document.getElementById('excel-file-input');
    if (fileInput) fileInput.value = '';
  };

  const handleEditMedicine = (med) => {
    resetForm();
    const esMedico = esCategoriaMediaca(med.categorias?.nombre);
    setTipoRegistro(esMedico ? 'medico' : 'general');
    setNombre(med.nombre);
    setNombreGenerico(med.nombre_generico || '');
    setNombreComercial(med.nombre_comercial || '');
    setConcentracion(med.concentracion || '');
    
    if (med.via_administracion) {
      if (VIAS_ADMINISTRACION_SUGERIDAS.includes(med.via_administracion)) {
        setViaAdministracion(med.via_administracion);
      } else {
        setViaAdministracion('Otro (Escribir...)');
        setViaAdministracionCustom(med.via_administracion);
      }
    } else {
      setViaAdministracion('');
    }
    
    setCategoriaId(med.categoria_id || '');
    setPresentacion(med.presentacion || '');
    setLaboratorio(med.laboratorio || '');
    setCantidadPorPresentacion(med.cantidad_por_presentacion || '');
    
    // Si cantidad_por_presentacion es un número, pre-poblar cantidadUnidades
    const matchUnits = med.cantidad_por_presentacion ? med.cantidad_por_presentacion.match(/^\d+$/) : null;
    if (matchUnits) {
      setCantidadUnidades(matchUnits[0]);
      if (med.stock_actual && Number(matchUnits[0]) > 0) {
        setNumeroCajas(String(Math.floor(med.stock_actual / Number(matchUnits[0]))));
      }
    } else {
      const matchNumber = med.cantidad_por_presentacion ? med.cantidad_por_presentacion.match(/\b\d+\b/) : null;
      if (matchNumber) {
        setCantidadUnidades(matchNumber[0]);
        if (med.stock_actual && Number(matchNumber[0]) > 0) {
          setNumeroCajas(String(Math.floor(med.stock_actual / Number(matchNumber[0]))));
        }
      }
    }
    
    setCantidadTotal(med.stock_actual || '');
    setObservaciones(med.observaciones || '');
    setEditingId(med.id);
    setIsModalOpen(true);
  };

  const handleExcelFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setImportError('');
    setImportLoading(true);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Leer como array 2D para escanear títulos y cabeceras
        const rows2D = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        
        let headerRowIndex = -1;
        let foundCategory = 'Otros';
        
        // Escanear las primeras 15 filas buscando la cabecera real
        for (let i = 0; i < Math.min(rows2D.length, 15); i++) {
          const row = rows2D[i];
          if (!row) continue;
          const hasNombre = row.some(cell => cell && cell.toString().trim().toLowerCase().replace(/\.$/, '').includes('nombre del medicamento'));
          const hasLab = row.some(cell => cell && cell.toString().trim().toLowerCase().replace(/\.$/, '').includes('laboratorio'));
          if (hasNombre || hasLab) {
            headerRowIndex = i;
            break;
          }
        }
        
        // Si no se encuentra con la cabecera exacta, buscar la primera fila que tenga más de 3 elementos con contenido
        if (headerRowIndex === -1) {
          for (let i = 0; i < rows2D.length; i++) {
            const row = rows2D[i];
            if (row && row.filter(c => c !== '').length > 3) {
              headerRowIndex = i;
              break;
            }
          }
        }
        
        if (headerRowIndex === -1) headerRowIndex = 0;
        
        // Extraer categoría de las filas previas a la cabecera (título como "INVENTARIO MEDICAMENTOS - ANTIINFLAMATORIOS")
        for (let i = 0; i < headerRowIndex; i++) {
          const row = rows2D[i];
          if (!row) continue;
          for (const cell of row) {
            if (cell) {
              const str = cell.toString().trim();
              if (str.toUpperCase().includes('INVENTARIO MEDICAMENTOS')) {
                if (str.includes('-')) {
                  foundCategory = str.split('-')[1].trim();
                } else {
                  foundCategory = str.replace(/INVENTARIO MEDICAMENTOS/i, '').replace(/[-_:]/g, '').trim() || 'Otros';
                }
              } else if (str.includes('-') && str.length > 5 && str.length < 50) {
                foundCategory = str.split('-')[1].trim();
              }
            }
          }
        }
        
        // Formatear categoría (ej. ANTIINFLAMATORIOS -> Antiinflamatorios)
        if (foundCategory && foundCategory !== 'Otros') {
          foundCategory = foundCategory.charAt(0).toUpperCase() + foundCategory.slice(1).toLowerCase();
        }
        setDetectedCategory(foundCategory);
        
        // Extraer los encabezados de forma segura directamente desde la fila de cabeceras identificada en rows2D
        const headers = (rows2D[headerRowIndex] || [])
          .map(h => h ? h.toString().trim() : '')
          .filter(h => h !== ''); // filtrar celdas vacías
          
        if (headers.length === 0) {
          throw new Error('No se pudieron identificar cabeceras válidas en el archivo Excel.');
        }
        
        // Mapear manualmente las filas de datos siguientes usando los encabezados de la fila identificada
        const parsedRows = [];
        for (let i = headerRowIndex + 1; i < rows2D.length; i++) {
          const rowData = rows2D[i];
          if (!rowData || rowData.length === 0) continue;
          
          const rowObj = {};
          let hasContent = false;
          
          rows2D[headerRowIndex].forEach((headerName, colIdx) => {
            if (headerName !== undefined && headerName !== null && headerName !== '') {
              const val = rowData[colIdx];
              rowObj[headerName.toString().trim()] = val !== undefined ? val : '';
              if (val !== undefined && val !== '') {
                hasContent = true;
              }
            }
          });
          
          if (hasContent) {
            parsedRows.push(rowObj);
          }
        }
        
        if (parsedRows.length === 0) {
          throw new Error('El archivo Excel no contiene filas de datos válidas.');
        }
        
        const initialMapping = autoMapHeaders(headers);
        
        setImportHeaders(headers);
        setImportRows(parsedRows);
        setColumnMapping(initialMapping);
        setImportStep(2);
      } catch (err) {
        setImportError(err.message || 'Error al procesar el archivo Excel.');
      } finally {
        setImportLoading(false);
      }
    };
    
    reader.onerror = () => {
      setImportError('Error de lectura del archivo.');
      setImportLoading(false);
    };
    
    reader.readAsBinaryString(file);
  };

  const executeImport = async () => {
    setImportLoading(true);
    setImportError('');
    let successCount = 0;
    
    try {
      // 1. Cargar categorías existentes para prevenir duplicación
      const { data: currentCats, error: catError } = await supabase.from('categorias').select('*');
      if (catError) throw catError;
      
      const categoryCache = [...(currentCats || [])];
      
      for (const row of importRows) {
        // Obtener campos mapeados
        const rawNombre = row[columnMapping.nombre];
        if (!rawNombre) continue; // Omitir filas sin nombre
        
        const nombreVal = rawNombre.toString().trim();
        const rawCategoria = row[columnMapping.categoria];
        const rawLab = row[columnMapping.laboratorio];
        const rawPres = row[columnMapping.presentacion];
        const rawCPP = row[columnMapping.cantidad_por_presentacion];
        const rawCant = row[columnMapping.cantidad];
        const rawLote = row[columnMapping.lote];
        const rawVenc = row[columnMapping.fecha_vencimiento];
        const rawObs = row[columnMapping.observaciones];
        
        // Resolver Categoría (si la fila no la trae, usar la detectada en el título del Excel)
        let finalCatId = null;
        let finalCatNombre = '';
        const catName = rawCategoria ? rawCategoria.toString().trim() : detectedCategory;
        
        // Verificar en caché (insensible a mayúsculas/minúsculas)
        const cachedCat = categoryCache.find(c => c.nombre.trim().toLowerCase() === catName.toLowerCase());
        if (cachedCat) {
          finalCatId = cachedCat.id;
          finalCatNombre = cachedCat.nombre;
        } else {
          // Crear nueva categoría si no existe
          const isMed = esCategoriaMediaca(catName);
          const { data: newCatList, error: newCatErr } = await supabase.from('categorias')
            .insert({ 
              nombre: catName, 
              descripcion: isMed ? 'Categoría médica importada vía Excel' : 'Categoría general importada vía Excel' 
            })
            .select();
          
          if (newCatErr) {
            console.error('Error al crear categoría durante la importación:', newCatErr);
            continue;
          }
          if (newCatList && newCatList.length > 0) {
            finalCatId = newCatList[0].id;
            finalCatNombre = newCatList[0].nombre;
            categoryCache.push(newCatList[0]);
          } else {
            continue;
          }
        }
        
        const esMedico = esCategoriaMediaca(finalCatNombre);
        const stockVal = rawCant ? Number(rawCant) : 0;
        
        // Insertar Medicina/Ítem
        const medData = {
          nombre: nombreVal,
          categoria_id: finalCatId,
          presentacion: rawPres ? rawPres.toString().trim() : (esMedico ? 'Tabletas' : 'Unidad'),
          laboratorio: esMedico ? (rawLab ? rawLab.toString().trim() : null) : null,
          cantidad_por_presentacion: rawCPP ? rawCPP.toString().trim() : null,
          observaciones: rawObs ? rawObs.toString().trim() : 'Importado vía Excel',
          stock_actual: stockVal
        };
        
        const { data: newMedList, error: medInsertErr } = await supabase.from('medicinas').insert(medData).select();
        if (medInsertErr) {
          console.error('Error al insertar medicina:', medInsertErr);
          continue;
        }
        
        if (newMedList && newMedList.length > 0) {
          const savedMedId = newMedList[0].id;
          successCount++;
          
          // Crear Lote para el stock inicial
          const parsedVenc = parseExcelDate(rawVenc);
          const loteNum = rawLote ? rawLote.toString().trim() : (esMedico ? 'S/N' : generarLoteGeneral());
          const vencDate = esMedico ? (parsedVenc || FECHA_NO_VENCE) : FECHA_NO_VENCE;
          
          const loteData = {
            producto_id: savedMedId,
            numero_lote: loteNum,
            cantidad_actual: stockVal,
            fecha_vencimiento: vencDate,
            estado: 'Disponible'
          };
          
          await supabase.from('lotes').insert(loteData);
          
          // Crear Movimiento de entrada
          if (stockVal > 0) {
            await supabase.from('movimientos').insert({
              medicina_id: savedMedId,
              tipo: 'Entrada',
              cantidad: stockVal,
              origen_destino: `Importación Excel - Lote: ${loteNum}`
            });
          }
        }
      }
      
      setImportSuccessCount(successCount);
      setImportStep(3);
      await fetchData();
    } catch (err) {
      setImportError(err.message || 'Ocurrió un error inesperado durante la importación.');
    } finally {
      setImportLoading(false);
    }
  };

  // Categorías médicas son las que NO están en CATEGORIAS_GENERALES
  const categoriasMedicas = categorias.filter(c => esCategoriaMediaca(c.nombre));
  const categoriasGenerales = categorias.filter(c => !esCategoriaMediaca(c.nombre));

  // Categorías a mostrar en el selector según el tipo de registro activo
  const categoriasDisponibles = tipoRegistro === 'general' ? categoriasGenerales : categoriasMedicas;

  const handleAddItem = async (e) => {
    e.preventDefault();
    setError('');

    if (tipoRegistro === 'general') {
      if (!nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    } else {
      if (!nombreGenerico.trim()) { setError('El nombre genérico es obligatorio.'); return; }
    }
    if (!categoriaId) { setError('Debes seleccionar una categoría.'); return; }
    if (categoriaId === 'NEW' && !newCategoriaNombre.trim()) { setError('Escribe el nombre de la nueva categoría.'); return; }

    try {
      setLoading(true);
      if (supabase) {
        let finalCategoriaId = categoriaId;
        let finalCategoriaNombre = '';

        // Crear categoría si es nueva
        if (categoriaId === 'NEW') {
          const catName = newCategoriaNombre.trim();
          // Primero, verificar si ya existe (insensible a mayúsculas)
          const { data: existingCatList, error: findError } = await supabase.from('categorias')
            .select('*')
            .ilike('nombre', catName);
            
          if (findError) throw findError;
            
          if (existingCatList && existingCatList.length > 0) {
            finalCategoriaId = existingCatList[0].id;
            finalCategoriaNombre = existingCatList[0].nombre;
          } else {
            const { data: catData, error: catError } = await supabase.from('categorias')
              .insert({ nombre: catName, descripcion: tipoRegistro === 'general' ? 'Categoría general añadida manualmente' : 'Categoría médica añadida manualmente' })
              .select();
            if (catError) throw catError;
            if (!catData || catData.length === 0) {
              throw new Error('La categoría fue creada, pero no se pudo recuperar de la base de datos.');
            }
            finalCategoriaId = catData[0].id;
            finalCategoriaNombre = catData[0].nombre;
          }
        } else {
          const catSeleccionada = categorias.find(c => c.id === categoriaId);
          finalCategoriaNombre = catSeleccionada ? catSeleccionada.nombre : '';
        }

        // Lógica de Vía de Administración
        const finalVia = tipoRegistro === 'medico'
          ? (viaAdministracion === 'Otro (Escribir...)' ? viaAdministracionCustom.trim() : viaAdministracion)
          : null;

        // Combinación del nombre maestro
        const finalNombre = tipoRegistro === 'medico'
          ? (nombreComercial.trim() ? `${nombreGenerico.trim()} (${nombreComercial.trim()})` : nombreGenerico.trim())
          : nombre.trim();

        const medData = {
          nombre: finalNombre,
          categoria_id: finalCategoriaId,
          presentacion: presentacion.trim() || null,
          concentracion: tipoRegistro === 'medico' ? (concentracion.trim() || null) : null,
          laboratorio: tipoRegistro === 'medico' ? (laboratorio.trim() || null) : null,
          cantidad_por_presentacion: tipoRegistro === 'medico' ? (cantidadUnidades.trim() || null) : (presentacion.trim() || null),
          observaciones: observaciones.trim() || null,
          stock_actual: cantidadTotal ? Number(cantidadTotal) : 0,
          nombre_generico: tipoRegistro === 'medico' ? nombreGenerico.trim() : null,
          nombre_comercial: tipoRegistro === 'medico' ? (nombreComercial.trim() || null) : null,
          via_administracion: finalVia || null
        };

        let savedMedId = editingId;

        if (editingId) {
          const { error: updateError } = await supabase.from('medicinas').update(medData).eq('id', editingId);
          if (updateError) throw updateError;
        } else {
          const { data: newMed, error: insertError } = await supabase.from('medicinas').insert(medData).select();
          if (insertError) throw insertError;
          if (!newMed || newMed.length === 0) {
            throw new Error('El ítem fue guardado, pero no se pudo recuperar el ID. Intenta recargar la página.');
          }
          savedMedId = newMed[0].id;
        }

        // Si se proporcionó lote o cantidad total y NO estamos editando (o si el usuario quiere crear un lote inicial)
        // Solo creamos lote si hay cantidad o número de lote
        if (!editingId && (cantidadTotal || numeroLote)) {
          const esMedico = esCategoriaMediaca(finalCategoriaNombre);
          const loteData = {
            producto_id: savedMedId,
            numero_lote: esMedico ? (numeroLote.trim() || 'S/N') : generarLoteGeneral(),
            cantidad_actual: cantidadTotal ? Number(cantidadTotal) : 0,
            fecha_vencimiento: esMedico ? (fechaVencimiento || FECHA_NO_VENCE) : FECHA_NO_VENCE,
            estado: 'Disponible'
          };
          
          const { error: loteError } = await supabase.from('lotes').insert(loteData);
          if (loteError) throw loteError;
          
          if (cantidadTotal && Number(cantidadTotal) > 0) {
            const { error: movError } = await supabase.from('movimientos').insert({
              medicina_id: savedMedId,
              tipo: 'Entrada',
              cantidad: Number(cantidadTotal),
              origen_destino: `Registro inicial - Lote: ${loteData.numero_lote}`
            });
            if (movError) throw movError;
          }
        }

        await fetchData();
        setIsModalOpen(false);
        resetForm();
      }
    } catch (err) {
      setError(err.message || 'Error al guardar el ítem.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMedicine = async (id, nombre) => {
    if (window.confirm(`¿Estás seguro de borrar "${nombre}" y todo su historial? Esta acción no se puede deshacer.`)) {
      try {
        setLoading(true);
        if (supabase) {
          // Borrar recursiva/manualmente movimientos y lotes para blindar restricciones de FK
          await supabase.from('movimientos').delete().eq('medicina_id', id);
          await supabase.from('lotes').delete().eq('producto_id', id);
          const { error: delError } = await supabase.from('medicinas').delete().eq('id', id);
          if (delError) throw delError;
          await fetchData();
        }
      } catch (err) {
        alert(err.message || 'Error al borrar el ítem.');
      } finally {
        setLoading(false);
      }
    }
  };

  const presentacionOptions = ['Tabletas', 'Cápsulas', 'Jarabe', 'Ampolla', 'Crema', 'Gotas', 'Unidad', 'Par', 'Kit', 'Otro'];

  // Filtrar la lista según el tipo seleccionado
  const medicinasFiltered = medicinas.filter(m => {
    if (filtroTipo === 'medico') return esCategoriaMediaca(m.categorias?.nombre);
    if (filtroTipo === 'general') return !esCategoriaMediaca(m.categorias?.nombre);
    return true;
  });

  return (
    <>
      <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo Maestro</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {medicinas.length} ítem{medicinas.length !== 1 ? 's' : ''} registrado{medicinas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Botón Importar Excel — Función Exclusiva */}
          <Button
            variant="outline"
            onClick={() => { resetImportState(); setIsImportModalOpen(true); }}
            style={{ color: '#16a34a', borderColor: '#16a34a', background: '#f0fdf4', gap: '0.4rem', display: 'flex', alignItems: 'center', fontWeight: '700' }}
            aria-label="Importar catálogo desde archivo Excel"
          >
            <Upload size={16} />
            Importar Excel
          </Button>

          {/* Botón Registrar Donación General — acceso rápido */}
          <Button
            variant="outline"
            onClick={() => { resetForm(); setTipoRegistro('general'); setIsModalOpen(true); }}
            style={{ color: '#7c3aed', borderColor: '#7c3aed', gap: '0.4rem' }}
            aria-label="Añadir ítem general al catálogo"
          >
            <ShoppingBag size={16} />
            Ítem General
          </Button>
          <Button variant="primary" onClick={() => { resetForm(); setTipoRegistro('medico'); setIsModalOpen(true); }}>
            <Plus size={18} />
            Añadir Medicina
          </Button>
        </div>
      </div>

      {/* Filtro tipo */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { key: 'todos', label: 'Todos', count: medicinas.length },
          { key: 'medico', label: 'Médicos', count: medicinas.filter(m => esCategoriaMediaca(m.categorias?.nombre)).length },
          { key: 'general', label: 'Generales', count: medicinas.filter(m => !esCategoriaMediaca(m.categorias?.nombre)).length },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltroTipo(f.key)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: 'var(--radius-pill)',
              border: `1.5px solid ${filtroTipo === f.key ? (f.key === 'general' ? '#7c3aed' : 'var(--primary-color)') : 'var(--border-color)'}`,
              background: filtroTipo === f.key ? (f.key === 'general' ? '#f5f3ff' : 'var(--primary-light)') : 'var(--bg-surface)',
              color: filtroTipo === f.key ? (f.key === 'general' ? '#7c3aed' : 'var(--primary-hover)') : 'var(--text-secondary)',
              fontWeight: filtroTipo === f.key ? '700' : '400',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              fontFamily: 'var(--font-family)',
            }}
          >
            {f.label} <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>({f.count})</span>
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ background: filtroTipo === 'general' ? '#f5f3ff' : 'var(--primary-light)', color: filtroTipo === 'general' ? '#7c3aed' : 'var(--primary-color)', width: '36px', height: '36px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {filtroTipo === 'general' ? <ShoppingBag size={18} /> : <Database size={18} />}
          </div>
          <h2 style={{ fontSize: '1rem', fontWeight: '700' }}>
            {filtroTipo === 'general' ? 'Ítems Generales' : filtroTipo === 'medico' ? 'Medicamentos Médicos' : 'Todos los Ítems'}
          </h2>
        </div>

        <div className="table-container animate-slide-up stagger-1" style={{ borderRadius: 0, border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Laboratorio</th>
                <th>Stock</th>
                <th>Presentación</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {medicinasFiltered.map((med) => {
                const esMedico = esCategoriaMediaca(med.categorias?.nombre);
                return (
                  <tr key={med.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{med.nombre}</div>
                    </td>
                    <td>
                      <span style={{
                        background: esMedico ? 'var(--primary-light)' : '#f5f3ff',
                        color: esMedico ? 'var(--primary-hover)' : '#6d28d9',
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        width: 'fit-content',
                        border: `1px solid ${esMedico ? 'rgba(16,185,129,0.1)' : 'rgba(124,58,237,0.1)'}`
                      }}>
                        {esMedico ? <Stethoscope size={11} /> : <ShoppingBag size={11} />}
                        {esMedico ? 'Médico' : 'General'}
                      </span>
                    </td>
                    <td>
                      <span style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-pill)', fontSize: '0.8rem', fontWeight: '600' }}>
                        {med.categorias?.nombre || '-'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{med.laboratorio || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: '700', color: med.stock_actual > 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                        {med.stock_actual || 0}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{med.presentacion || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem' }}>
                        <button
                          onClick={() => handleEditMedicine(med)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', padding: '0.25rem', opacity: 0.8 }}
                          title="Editar ítem"
                          aria-label={`Editar ${med.nombre}`}
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteMedicine(med.id, med.nombre)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color)', padding: '0.25rem', opacity: 0.8 }}
                          title="Borrar ítem"
                          aria-label={`Borrar ${med.nombre}`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {medicinasFiltered.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Pill size={40} style={{ margin: '0 auto 0.75rem', color: 'var(--text-tertiary)', display: 'block' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>No hay ítems en esta categoría.<br />Añade el primero usando los botones de arriba.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* ─── Modal de Importación desde Excel (Exclusivo) ─── */}
    <Modal
        isOpen={isImportModalOpen}
        onClose={resetImportState}
        title="Importar Catálogo desde Excel"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={resetImportState} disabled={importLoading}>
              {importStep === 3 ? 'Cerrar' : 'Cancelar'}
            </Button>
            {importStep === 2 && (
              <Button
                type="button"
                variant="primary"
                disabled={importLoading || !columnMapping.nombre}
                onClick={executeImport}
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none' }}
              >
                {importLoading ? 'Importando...' : 'Iniciar Importación'}
              </Button>
            )}
          </>
        }
      >
        <div style={{ minHeight: '260px' }}>
          {importError && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', border: '1px solid rgba(239,68,68,0.2)' }}>
              {importError}
            </div>
          )}

          {/* Paso 1: Subir Archivo */}
          {importStep === 1 && (
            <div>
              <div 
                style={{
                  border: '2px dashed #16a34a',
                  borderRadius: 'var(--radius-lg)',
                  padding: '3.5rem 2rem',
                  textAlign: 'center',
                  background: '#f0fdf4',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onClick={() => document.getElementById('excel-file-input').click()}
              >
                <Upload size={48} style={{ color: '#16a34a', marginBottom: '1rem' }} />
                <h3 style={{ color: '#15803d', fontWeight: '700', marginBottom: '0.5rem' }}>Subir documento Excel</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Arrastra tu archivo aquí o haz clic para buscar. Soporta .xlsx, .xls y .csv.
                </p>
                <input 
                  id="excel-file-input"
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelFileChange}
                  style={{ display: 'none' }}
                />
              </div>

              <div style={{ marginTop: '1.5rem', background: 'var(--bg-surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <HelpCircle size={15} style={{ color: '#16a34a' }} /> Recomendaciones de columnas:
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  <div>• <strong>Nombre</strong> <span style={{ color: 'var(--danger-color)' }}>*</span></div>
                  <div>• <strong>Categoría</strong></div>
                  <div>• <strong>Laboratorio</strong></div>
                  <div>• <strong>Presentación</strong></div>
                  <div>• <strong>Cantidad</strong></div>
                  <div>• <strong>Lote</strong></div>
                  <div>• <strong>Vencimiento</strong></div>
                  <div>• <strong>Observaciones</strong></div>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.75rem', lineHeight: '1.3' }}>
                  * El sistema mapeará tus columnas automáticamente por sinonimia (ej: "Stock" se asociará a "Cantidad", "Vence" a "Vencimiento", etc.). Podrás revisar y corregir las columnas en el siguiente paso.
                </p>
              </div>
            </div>
          )}

          {/* Paso 2: Mapeo y Vista Previa */}
          {importStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: '#f0fdf4', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📊</span>
                <div>
                  <h4 style={{ fontWeight: '700', color: '#15803d', fontSize: '0.9rem' }}>¡Archivo procesado con éxito!</h4>
                  <p style={{ fontSize: '0.8rem', color: '#166534' }}>Detectamos <strong>{importRows.length}</strong> fila(s) en tu documento. Verifica el mapeo de columnas abajo:</p>
                </div>
              </div>

              {/* Contenedor de Mapeo */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', background: 'var(--bg-surface-hover)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                {Object.keys(COLUMN_SYNONYMS).map(field => (
                  <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                      {field.replace('_', ' ')} {field === 'nombre' && <span style={{ color: 'var(--danger-color)' }}>*</span>}
                    </label>
                    <select
                      className="input-field"
                      style={{ marginBottom: 0, fontSize: '0.825rem', padding: '0.35rem', cursor: 'pointer' }}
                      value={columnMapping[field] || ''}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                    >
                      <option value="">— No importar —</option>
                      {importHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Vista Previa de Datos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <h4 style={{ fontSize: '0.825rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Vista previa de las primeras 4 filas:</h4>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', maxHeight: '180px' }}>
                  <table style={{ width: '100%', fontSize: '0.725rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '0.5rem' }}>Nombre</th>
                        <th style={{ padding: '0.5rem' }}>Categoría</th>
                        <th style={{ padding: '0.5rem' }}>Laboratorio</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Stock</th>
                        <th style={{ padding: '0.5rem' }}>Vencimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 4).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < 3 ? '1px solid var(--border-color)' : 'none' }}>
                          <td style={{ padding: '0.5rem', fontWeight: '600' }}>{row[columnMapping.nombre] || <span style={{ color: 'var(--danger-color)', fontStyle: 'italic' }}>Vacío (se omitirá)</span>}</td>
                          <td style={{ padding: '0.5rem' }}>{row[columnMapping.categoria] || 'Otros'}</td>
                          <td style={{ padding: '0.5rem' }}>{row[columnMapping.laboratorio] || '—'}</td>
                          <td style={{ padding: '0.5rem', fontWeight: '700', textAlign: 'center' }}>{row[columnMapping.cantidad] || 0}</td>
                          <td style={{ padding: '0.5rem' }}>{parseExcelDate(row[columnMapping.fecha_vencimiento]) || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Paso 3: Éxito */}
          {importStep === 3 && (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <div style={{ width: '64px', height: '64px', background: '#dcfce7', color: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '2rem', fontWeight: 'bold' }}>
                ✓
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#15803d', marginBottom: '0.5rem' }}>¡Importación Finalizada!</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto', lineHeight: '1.4' }}>
                Se han registrado exitosamente <strong>{importSuccessCount}</strong> medicina(s)/ítem(s) en tu catálogo y se han creado automáticamente sus respectivos lotes de control de inventario inicial.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* ─── Modal Unificado con Formulario Dinámico de Registro ─── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title={editingId ? 'Editar Ítem/Medicina' : (tipoRegistro === 'general' ? 'Añadir Ítem General' : 'Añadir Nueva Medicina')}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={loading}
              onClick={() => document.getElementById('cat-submit-trigger').click()}
              style={tipoRegistro === 'general' ? { background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: 'none' } : {}}
            >
              {loading ? 'Guardando...' : `${editingId ? 'Actualizar' : 'Guardar'} ${tipoRegistro === 'general' ? 'Ítem' : 'Medicina'}`}
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          {tipoRegistro === 'general' ? (
            // Formulario simplificado para Ítem General
            <>
              {/* Categoría */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="cat-categoria-gen" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Categoría <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <select
                  id="cat-categoria-gen"
                  className="input-field"
                  required
                  aria-required="true"
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  style={{ marginBottom: 0, cursor: 'pointer' }}
                >
                  <option value="">— Selecciona una categoría —</option>
                  {categoriasDisponibles.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                  <option value="NEW" style={{ fontWeight: 'bold', color: '#7c3aed' }}>[+] Nueva Categoría...</option>
                </select>

                {categoriaId === 'NEW' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <input
                      className="input-field animate-fade-in"
                      required
                      value={newCategoriaNombre}
                      onChange={(e) => setNewCategoriaNombre(e.target.value)}
                      placeholder="Ej. Ropa, Higiene, Alimentos..."
                      style={{ marginBottom: 0, border: '1px dashed #7c3aed' }}
                    />
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      {CATEGORIAS_GENERALES.slice(0, 6).map(sug => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => setNewCategoriaNombre(sug)}
                          style={{ padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-pill)', border: '1px solid #c4b5fd', background: newCategoriaNombre === sug ? '#ede9fe' : 'transparent', color: '#6d28d9', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-family)' }}
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Nombre */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="cat-nombre-gen" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Nombre del Ítem <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <input
                  id="cat-nombre-gen"
                  className="input-field"
                  required
                  aria-required="true"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Camiseta Talla M, Kit de Higiene..."
                  style={{ marginBottom: 0 }}
                />
              </div>

              {/* Presentación (Chips / Variante) */}
              <div
                role="group"
                aria-label="Descripción de ítem general"
                style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '1rem', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', animation: 'fadeIn 0.2s ease-out' }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShoppingBag size={13} /> Detalle del Ítem General
                </div>
                <label htmlFor="cat-pres-gen" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Descripción / Talla / Variante (opcional)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  {['Talla S', 'Talla M', 'Talla L', 'Talla XL', 'Unitario', 'Par', 'Kit', 'Paquete'].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPresentacion(opt === presentacion ? '' : opt)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: 'var(--radius-pill)',
                        border: `1.5px solid ${presentacion === opt ? '#7c3aed' : 'var(--border-color)'}`,
                        background: presentacion === opt ? '#ede9fe' : 'var(--bg-surface)',
                        color: presentacion === opt ? '#6d28d9' : 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        fontWeight: presentacion === opt ? '600' : '400',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        fontFamily: 'var(--font-family)'
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <input
                  id="cat-pres-gen"
                  className="input-field"
                  value={presentacion}
                  onChange={(e) => setPresentacion(e.target.value)}
                  placeholder="Ej. Talla única, 500ml, 3 piezas..."
                  style={{ marginBottom: 0, fontSize: '0.85rem' }}
                />
              </div>

              {/* Cantidad Total / cpp */}
              <div className="grid-responsive" style={{ gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label htmlFor="cat-cpp-gen" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    Cantidad por presentación (opcional)
                  </label>
                  <input
                    id="cat-cpp-gen"
                    className="input-field"
                    value={cantidadPorPresentacion}
                    onChange={(e) => setCantidadPorPresentacion(e.target.value)}
                    placeholder="Ej. Caja x 30, Bolsa x 10"
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label htmlFor="cat-ct-gen" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    Cantidad Total (Stock Inicial) {editingId && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>(Editar en Inventario)</span>}
                  </label>
                  <input
                    id="cat-ct-gen"
                    type="number"
                    className="input-field"
                    value={cantidadTotal}
                    disabled={!!editingId}
                    onChange={(e) => setCantidadTotal(e.target.value)}
                    placeholder="0"
                    style={{ marginBottom: 0, cursor: editingId ? 'not-allowed' : 'text' }}
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="cat-obs-gen" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Observaciones
                </label>
                <textarea
                  id="cat-obs-gen"
                  className="input-field"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas adicionales..."
                  style={{ marginBottom: 0, resize: 'vertical', minHeight: '60px' }}
                />
              </div>
            </>
          ) : (
            // Formulario reestructurado para MEDICINA
            <>
              {/* 1. Grupo farmacológico (Categoría) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="cat-categoria-med" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Grupo farmacológico (Categoría) <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <select
                  id="cat-categoria-med"
                  className="input-field"
                  required
                  aria-required="true"
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  style={{ marginBottom: 0, cursor: 'pointer' }}
                >
                  <option value="">— Selecciona un grupo farmacológico —</option>
                  {categoriasDisponibles.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                  <option value="NEW" style={{ fontWeight: 'bold', color: 'var(--primary-hover)' }}>[+] Nueva Categoría...</option>
                </select>

                {categoriaId === 'NEW' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <input
                      className="input-field animate-fade-in"
                      required
                      value={newCategoriaNombre}
                      onChange={(e) => setNewCategoriaNombre(e.target.value)}
                      placeholder="Ej. Antiinflamatorios, Analgésicos, Antipiréticos..."
                      style={{ marginBottom: 0, border: '1px dashed var(--primary-color)' }}
                    />
                  </div>
                )}
              </div>

              {/* 2. Nombre genérico */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="cat-nombre-generico" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Nombre genérico <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <input
                  id="cat-nombre-generico"
                  className="input-field"
                  required
                  aria-required="true"
                  value={nombreGenerico}
                  onChange={(e) => setNombreGenerico(e.target.value)}
                  placeholder="Ej. Paracetamol, Ibuprofeno..."
                  style={{ marginBottom: 0 }}
                />
              </div>

              {/* 3. Nombre comercial */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="cat-nombre-comercial" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Nombre comercial
                </label>
                <input
                  id="cat-nombre-comercial"
                  className="input-field"
                  value={nombreComercial}
                  onChange={(e) => setNombreComercial(e.target.value)}
                  placeholder="Ej. Tempra, Advil... (opcional)"
                  style={{ marginBottom: 0 }}
                />
              </div>

              {/* 4 y 5. Fecha de vencimiento y Lote (solo si no es edición, para mantener coherencia de lote inicial) */}
              {!editingId && (
                <div className="grid-responsive" style={{ gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label htmlFor="cat-venc-med" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      Fecha de vencimiento
                    </label>
                    <input
                      id="cat-venc-med"
                      type="date"
                      className="input-field"
                      value={fechaVencimiento}
                      onChange={(e) => setFechaVencimiento(e.target.value)}
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label htmlFor="cat-lote-med" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      Lote
                    </label>
                    <input
                      id="cat-lote-med"
                      className="input-field"
                      value={numeroLote}
                      onChange={(e) => setNumeroLote(e.target.value)}
                      placeholder="Ej. L12345"
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                </div>
              )}

              {/* 6. Concentración */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="cat-concentracion" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Concentración
                </label>
                <input
                  id="cat-concentracion"
                  className="input-field"
                  value={concentracion}
                  onChange={(e) => setConcentracion(e.target.value)}
                  placeholder="Ej. 500mg, 100mg/5ml..."
                  style={{ marginBottom: 0 }}
                />
              </div>

              {/* 7. Presentación */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Presentación
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['Tabletas', 'Cápsulas', 'Jarabe', 'Ampolla', 'Crema', 'Gotas', 'Supositorio'].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPresentacion(opt === presentacion ? '' : opt)}
                      style={{
                        padding: '0.4rem 0.875rem',
                        borderRadius: 'var(--radius-pill)',
                        border: `1.5px solid ${presentacion === opt ? 'var(--primary-color)' : 'var(--border-color)'}`,
                        background: presentacion === opt ? 'var(--primary-light)' : 'var(--bg-surface)',
                        color: presentacion === opt ? 'var(--primary-hover)' : 'var(--text-secondary)',
                        fontSize: '0.85rem',
                        fontWeight: presentacion === opt ? '600' : '400',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        fontFamily: 'var(--font-family)'
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <input
                  id="cat-presentacion-custom"
                  className="input-field"
                  value={presentacion}
                  onChange={(e) => setPresentacion(e.target.value)}
                  placeholder="O escribe una presentación personalizada..."
                  style={{ marginBottom: 0, marginTop: '0.5rem', fontSize: '0.85rem' }}
                />
              </div>

              {/* 8. Vía de administración */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="cat-via-admin" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Vía de administración
                </label>
                <select
                  id="cat-via-admin"
                  className="input-field"
                  value={viaAdministracion}
                  onChange={(e) => setViaAdministracion(e.target.value)}
                  style={{ marginBottom: 0, cursor: 'pointer' }}
                >
                  <option value="">— Selecciona vía de administración —</option>
                  {VIAS_ADMINISTRACION_SUGERIDAS.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>

                {viaAdministracion === 'Otro (Escribir...)' && (
                  <input
                    id="cat-via-admin-custom"
                    className="input-field animate-fade-in"
                    required
                    value={viaAdministracionCustom}
                    onChange={(e) => setViaAdministracionCustom(e.target.value)}
                    placeholder="Escribe la vía de administración personalizada..."
                    style={{ marginBottom: 0, marginTop: '0.5rem' }}
                  />
                )}
              </div>

              {/* 9, 10, 11. Cantidad (unidades por caja), Número de cajas y Total Stock */}
              <div className="grid-responsive" style={{ gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label htmlFor="cat-cant-unidades" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    Cantidad (por caja/unidad)
                  </label>
                  <input
                    id="cat-cant-unidades"
                    type="number"
                    className="input-field"
                    value={cantidadUnidades}
                    onChange={(e) => setCantidadUnidades(e.target.value)}
                    placeholder="Ej. 30"
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label htmlFor="cat-num-cajas" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    Número de cajas
                  </label>
                  <input
                    id="cat-num-cajas"
                    type="number"
                    className="input-field"
                    value={numeroCajas}
                    onChange={(e) => setNumeroCajas(e.target.value)}
                    placeholder="Ej. 5"
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label htmlFor="cat-total-stock" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    Total Stock
                  </label>
                  <input
                    id="cat-total-stock"
                    type="number"
                    className="input-field"
                    value={cantidadTotal}
                    disabled
                    placeholder="0"
                    style={{ marginBottom: 0, cursor: 'not-allowed', backgroundColor: 'var(--bg-surface-hover)' }}
                  />
                </div>
              </div>

              {/* 12. Laboratorio */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="cat-lab-med" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Laboratorio
                </label>
                <input
                  id="cat-lab-med"
                  className="input-field"
                  value={laboratorio}
                  onChange={(e) => setLaboratorio(e.target.value)}
                  placeholder="Ej. Pfizer, Bayer, Genérico..."
                  style={{ marginBottom: 0 }}
                />
              </div>

              {/* 13. Observaciones */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="cat-obs-med" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Observaciones
                </label>
                <textarea
                  id="cat-obs-med"
                  className="input-field"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas adicionales..."
                  style={{ marginBottom: 0, resize: 'vertical', minHeight: '60px' }}
                />
              </div>
            </>
          )}

          {/* Hidden submit trigger */}
          <button type="submit" id="cat-submit-trigger" style={{ display: 'none' }} aria-hidden="true" />
        </form>
      </Modal>
    </>
  );
};
