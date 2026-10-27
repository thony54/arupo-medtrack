import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { cargarLogo } from '../../utils/logo';

// Quien firma el documento por la Fundación.
const DIRECTORA = { nombre: 'Maria Fernanda Ayala', cargo: 'Directora de la Fundación Arupo' };

// Hoja A4 a 96 dpi: el HTML se dibuja a este tamaño y luego se pasa a una página A4.
const ANCHO_PAGINA = 794;
const ALTO_PAGINA = 1123;

// Los datos de la evaluación son texto libre escrito por el personal y se vuelcan en
// innerHTML: sin escapar, un "<img onerror=…>" en las notas se ejecutaría al generar el PDF.
const esc = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const texto = (valor) => esc(valor).replace(/\r?\n/g, '<br>');

const imcRange = (imc) => {
  if (imc < 18.5) return 'Abajo del peso ideal';
  if (imc >= 18.5 && imc < 25) return 'Peso normal';
  if (imc >= 25 && imc < 30) return 'Exceso de peso';
  if (imc >= 30 && imc < 35) return 'Obesidad (nivel I)';
  if (imc >= 35 && imc < 40) return 'Obesidad (nivel II)';
  return 'Obesidad (nivel III)';
};

const glucosaRange = (v) => {
  if (v >= 70 && v <= 110) return 'Normal';
  if (v < 70) return 'Bajo';
  if (v > 110 && v <= 150) return 'Moderado';
  if (v > 150 && v <= 180) return 'Aumentado';
  if (v > 180 && v <= 210) return 'Alto';
  return 'Crítico';
};

const presionRange = (s, d) => {
  if (s < 120 && d < 80) return 'Normal';
  if (s >= 120 && s <= 139 || d >= 80 && d <= 89) return 'Prehipertensión';
  if (s >= 140 && s <= 159 || d >= 90 && d <= 99) return 'Presión sanguínea elevada: 1 etapa';
  return 'Presión sanguínea elevada: 2 etapa';
};

// Tablas de referencia ("Significación de mi valor"): la fila activa va resaltada.
const filaEscala = (etiqueta, activa, color, ultima) => `
  <tr><td style="padding: 3px 8px; ${ultima ? '' : 'border-bottom: 1px solid #eee;'} background: ${activa ? color : 'transparent'}">${etiqueta}</td></tr>`;

const bloqueDiagnostico = (titulo, contenido) => (contenido && String(contenido).trim() ? `
  <div style="margin-bottom: 8px;">
    <div style="font-size: 9.5px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 3px;">${titulo}</div>
    <div style="font-size: 11px; line-height: 1.5; color: #333; background: #f9fafb; padding: 8px 10px; border-left: 3px solid #10b981; border-radius: 3px;">${texto(contenido)}</div>
  </div>` : '');

export const htmlEvaluacion = (evaluacion, logo) => {
  const { imc, glucosa, presion_sistolica: sis, presion_diastolica: dia } = evaluacion;
  const presion = presionRange(sis, dia);

  const diagnosticos = bloqueDiagnostico('Medidas físicas', evaluacion.diagnostico_fisico)
    + bloqueDiagnostico('Examen médico', evaluacion.diagnostico_medico);

  return `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        ${logo ? `<img src="${logo}" alt="Fundación Arupo" style="width: 54px; height: 54px; object-fit: contain;" />` : ''}
        <div>
          <h1 style="margin: 0; color: #10b981; font-size: 19px; text-transform: uppercase;">Evaluación de Salud</h1>
          <p style="margin: 3px 0 0 0; color: #666; font-weight: bold; font-size: 11px;">Fundación Arupo - MedTrack</p>
        </div>
      </div>
      <div style="text-align: right; font-size: 11px;">
        <p style="margin: 0;"><strong>Fecha:</strong> ${esc(evaluacion.fecha)}</p>
        <p style="margin: 4px 0 0 0;"><strong>Hora:</strong> ${esc(evaluacion.hora_atencion)}</p>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; background: #f9fafb; padding: 12px 14px; border-radius: 6px; font-size: 10.5px;">
      <div>
        <p style="margin: 0 0 6px 0;"><strong>Nombre:</strong> ${esc(evaluacion.paciente_nombre)}</p>
        <p style="margin: 0 0 6px 0;"><strong>CI/ID:</strong> ${esc(evaluacion.paciente_ci)}</p>
        <p style="margin: 0 0 6px 0;"><strong>Dirección:</strong> ${esc(evaluacion.paciente_direccion)}</p>
        <p style="margin: 0;"><strong>Teléfono:</strong> ${esc(evaluacion.paciente_telefono || '—')}</p>
      </div>
      <div>
        <p style="margin: 0 0 6px 0;"><strong>Lugar:</strong> ${esc(evaluacion.lugar_atencion)}</p>
        <p style="margin: 0 0 6px 0;"><strong>Email:</strong> ${esc(evaluacion.paciente_email || '—')}</p>
        <p style="margin: 0 0 6px 0;"><strong>Acompañante:</strong> ${esc(evaluacion.acompanante_nombre || '—')} ${evaluacion.acompanante_telefono ? `(${esc(evaluacion.acompanante_telefono)})` : ''}</p>
        <p style="margin: 0;"><strong>Atendido por:</strong> ${esc(evaluacion.perfiles?.nombre || 'Personal Autorizado')}</p>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10.5px;">
      <thead>
        <tr style="background: #10b981; color: white;">
          <th style="padding: 7px 10px; border: 1px solid #10b981; text-align: left; font-size: 10px; width: 30%;">Categoría / Mis Valores</th>
          <th style="padding: 7px 10px; border: 1px solid #10b981; text-align: left; font-size: 10px; width: 42%;">Significación de mi valor</th>
          <th style="padding: 7px 10px; border: 1px solid #10b981; text-align: left; font-size: 10px; width: 28%;">Resultado Actual</th>
        </tr>
      </thead>
      <tbody>
        <!-- Peso e IMC -->
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #ddd; line-height: 1.5;">
            <strong>Peso:</strong> ${esc(evaluacion.peso)} kg<br>
            <strong>Talla:</strong> ${esc(evaluacion.talla)} cm<br>
            <strong>IMC:</strong> <span style="font-size: 13px; font-weight: bold; color: #10b981;">${esc(imc)}</span>
          </td>
          <td style="padding: 0; border: 1px solid #ddd;">
            <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
              ${filaEscala('&lt; 18.5: Abajo del peso ideal', imc < 18.5, '#e0f2f1')}
              ${filaEscala('18.5 - 25: Peso normal', imc >= 18.5 && imc < 25, '#e0f2f1')}
              ${filaEscala('25 - 30: Exceso de peso', imc >= 25 && imc < 30, '#e0f2f1')}
              ${filaEscala('30 - 35: Obesidad (nivel I)', imc >= 30 && imc < 35, '#e0f2f1')}
              ${filaEscala('35 - 40: Obesidad (nivel II)', imc >= 35 && imc < 40, '#e0f2f1')}
              ${filaEscala('&gt; 40: Obesidad (nivel III)', imc >= 40, '#e0f2f1', true)}
            </table>
          </td>
          <td style="padding: 8px 10px; border: 1px solid #ddd; text-align: center; vertical-align: middle;">
            <div style="font-weight: bold; font-size: 11px; color: #059669;">${imcRange(imc)}</div>
          </td>
        </tr>

        <!-- Glucosa -->
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #ddd; line-height: 1.5;">
            <strong>Glucosa en sangre:</strong><br>
            <span style="font-size: 13px; font-weight: bold; color: #ef4444;">${esc(glucosa)} mg/dL</span>
          </td>
          <td style="padding: 0; border: 1px solid #ddd;">
            <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
              ${filaEscala('70 - 110: Normal', glucosa >= 70 && glucosa <= 110, '#fee2e2')}
              ${filaEscala('120: Bajo (Referencial)', glucosa < 70, '#fee2e2')}
              ${filaEscala('150: Moderado', glucosa > 110 && glucosa <= 150, '#fee2e2')}
              ${filaEscala('180: Aumentado', glucosa > 150 && glucosa <= 180, '#fee2e2')}
              ${filaEscala('210: Alto', glucosa > 180 && glucosa <= 210, '#fee2e2')}
              ${filaEscala('240: Crítico', glucosa > 210, '#fee2e2', true)}
            </table>
          </td>
          <td style="padding: 8px 10px; border: 1px solid #ddd; text-align: center; vertical-align: middle;">
            <div style="font-weight: bold; font-size: 11px; color: #dc2626;">${glucosaRange(glucosa)}</div>
          </td>
        </tr>

        <!-- Presión Arterial -->
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #ddd; line-height: 1.5;">
            <strong>Presión arterial:</strong><br>
            <span style="font-size: 13px; font-weight: bold; color: #3b82f6;">${esc(sis)} / ${esc(dia)} mmHg</span>
          </td>
          <td style="padding: 0; border: 1px solid #ddd;">
            <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
              ${filaEscala('&lt; 120 / &lt; 80: Normal', presion === 'Normal', '#dbeafe')}
              ${filaEscala('120-139 / 80-89: Prehipertensión', presion === 'Prehipertensión', '#dbeafe')}
              ${filaEscala('140-159 / 90-99: Presión elevada (Etapa 1)', presion === 'Presión sanguínea elevada: 1 etapa', '#dbeafe')}
              ${filaEscala('&gt; 160 / &gt; 100: Presión elevada (Etapa 2)', presion === 'Presión sanguínea elevada: 2 etapa', '#dbeafe', true)}
            </table>
          </td>
          <td style="padding: 8px 10px; border: 1px solid #ddd; text-align: center; vertical-align: middle;">
            <div style="font-weight: bold; font-size: 11px; color: #2563eb;">${presion}</div>
          </td>
        </tr>
      </tbody>
    </table>

    ${diagnosticos ? `
    <div style="margin-bottom: 14px;">
      <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 5px; margin: 0 0 8px 0; font-size: 12px; color: #10b981;">Diagnóstico</h3>
      ${diagnosticos}
    </div>` : ''}

    <div>
      <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 5px; margin: 0 0 8px 0; font-size: 12px; color: #10b981;">Notas Adicionales</h3>
      <p style="margin: 0; font-size: 10.5px; line-height: 1.5; color: #444; padding: 8px 10px; border: 1px dashed #ccc; border-radius: 4px;">
        ${evaluacion.notas ? texto(evaluacion.notas) : 'No hay notas adicionales para esta evaluación.'}
      </p>
    </div>

    <div style="margin-top: auto; padding-top: 70px; display: flex; justify-content: space-between;">
      <div style="width: 230px; border-top: 1px solid #333; text-align: center; padding-top: 6px;">
        <p style="margin: 0; font-size: 11px; font-weight: bold;">${DIRECTORA.nombre}</p>
        <p style="margin: 3px 0 0 0; font-size: 10px; color: #555;">${DIRECTORA.cargo}</p>
      </div>
      <div style="width: 230px; border-top: 1px solid #333; text-align: center; padding-top: 6px;">
        <p style="margin: 0; font-size: 11px;">Firma del Paciente / Acompañante</p>
      </div>
    </div>
  `;
};

export const generateSaludPDF = async (evaluacion) => {
  const logo = await cargarLogo();

  // Contenedor temporal fuera de pantalla: html2canvas lo convierte en imagen.
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.boxSizing = 'border-box';
  container.style.width = `${ANCHO_PAGINA}px`;
  container.style.minHeight = `${ALTO_PAGINA}px`;
  container.style.padding = '36px 40px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.background = 'white';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.fontSize = '11px';
  container.style.color = '#333';
  container.innerHTML = htmlEvaluacion(evaluacion, logo);

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    // compress: sin esto jsPDF guarda la página como píxeles sin comprimir (~10 MB).
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const anchoMm = pdf.internal.pageSize.getWidth();
    const altoPaginaMm = pdf.internal.pageSize.getHeight();
    const altoMm = (canvas.height * anchoMm) / canvas.width;

    // Normalmente cabe en una sola página; si el texto es largo, continúa en las siguientes.
    let desplazamiento = 0;
    pdf.addImage(imgData, 'PNG', 0, desplazamiento, anchoMm, altoMm);
    while (altoMm + desplazamiento > altoPaginaMm + 1) {
      desplazamiento -= altoPaginaMm;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, desplazamiento, anchoMm, altoMm);
    }

    pdf.save(`Evaluacion_Salud_${evaluacion.paciente_nombre.replace(/\s+/g, '_')}_${evaluacion.fecha}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error al generar el PDF. Por favor intente de nuevo.');
  } finally {
    document.body.removeChild(container);
  }
};
