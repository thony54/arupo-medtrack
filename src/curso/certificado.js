import { tEs } from '../i18n/tEs';
import { cargarLogo } from '../utils/logo';

// Certificado del curso en PDF (jsPDF, se carga solo al descargar).
// El texto principal va SIEMPRE en español (documento oficial); si la persona usa otro
// idioma, debajo se añade la traducción en pequeño.

const DORADO = [180, 130, 20];
const VERDE = [13, 148, 136];
const GRIS = [100, 116, 139];

// Folio de referencia: ARUPO-ESP-AAAAMMDD-XXXXXXXX (fecha de fin + inicio del id).
export const folioDe = (userId, fin) => {
  const f = `${fin.getFullYear()}${String(fin.getMonth() + 1).padStart(2, '0')}${String(fin.getDate()).padStart(2, '0')}`;
  return `ARUPO-ESP-${f}-${String(userId || '').replace(/-/g, '').slice(0, 8).toUpperCase()}`;
};

// datos: { nombre, userId, inicio, fin, duracionEs, duracionLocal, local }
// `t` y `idioma`: traductor del voluntario. Devuelve el Blob del PDF (y lo descarga si `descargar`).
export const generarCertificado = async ({ nombre, userId, inicio, fin, duracionEs, duracionLocal, t, idioma, local = 'es-ES', descargar = true }) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const fechaEs = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const traducir = idioma && idioma !== 'es' && typeof t === 'function';

  // Marco doble
  doc.setDrawColor(...DORADO);
  doc.setLineWidth(1.2);
  doc.rect(8, 8, ancho - 16, alto - 16);
  doc.setLineWidth(0.3);
  doc.rect(11, 11, ancho - 22, alto - 22);

  // Logo
  const logo = await cargarLogo();
  let y = 22;
  if (logo) {
    doc.addImage(logo, 'PNG', ancho / 2 - 11, y - 6, 22, 22);
    y += 22;
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...VERDE);
  doc.setFontSize(34);
  doc.text(tEs('certificado.titulo'), ancho / 2, y + 8, { align: 'center' });
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(13);
  doc.text(tEs('certificado.otorga'), ancho / 2, y, { align: 'center' });
  if (traducir) {
    doc.setFontSize(9);
    doc.setTextColor(...GRIS);
    doc.text(t('certificado.otorga'), ancho / 2, y + 5, { align: 'center' });
  }
  y += traducir ? 20 : 16;

  // Nombre
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(30);
  doc.text(nombre || '—', ancho / 2, y, { align: 'center', maxWidth: ancho - 50 });
  doc.setDrawColor(...DORADO);
  doc.setLineWidth(0.5);
  doc.line(ancho / 2 - 70, y + 3, ancho / 2 + 70, y + 3);
  y += 14;

  // Motivo
  const variablesEs = { duracion: duracionEs, inicio: fechaEs(inicio), fin: fechaEs(fin) };
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(13);
  const lineasEs = doc.splitTextToSize(tEs('certificado.por', variablesEs), ancho - 70);
  doc.text(lineasEs, ancho / 2, y, { align: 'center' });
  y += lineasEs.length * 6;

  if (traducir) {
    const variablesLocal = {
      duracion: duracionLocal,
      inicio: inicio.toLocaleDateString(local, { day: 'numeric', month: 'long', year: 'numeric' }),
      fin: fin.toLocaleDateString(local, { day: 'numeric', month: 'long', year: 'numeric' })
    };
    doc.setFontSize(9);
    doc.setTextColor(...GRIS);
    const lineasLocal = doc.splitTextToSize(t('certificado.por', variablesLocal), ancho - 80);
    doc.text(lineasLocal, ancho / 2, y + 2, { align: 'center' });
    y += lineasLocal.length * 4.2 + 4;
  }

  // Pie: fecha de emisión, folio y firma
  const base = alto - 34;
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(tEs('certificado.emitido', { fecha: fechaEs(fin) }), 30, base);
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  if (traducir) {
    doc.text(t('certificado.emitido', { fecha: fin.toLocaleDateString(local, { day: 'numeric', month: 'long', year: 'numeric' }) }), 30, base + 5);
  }
  doc.text(tEs('certificado.folio', { folio: folioDe(userId, fin) }), 30, base + (traducir ? 10 : 6));

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.line(ancho - 100, base, ancho - 30, base);
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(tEs('certificado.firma'), ancho - 65, base + 5, { align: 'center' });

  if (descargar) doc.save('Certificado-Curso-Espanol-Arupo.pdf');
  return doc.output('blob');
};
