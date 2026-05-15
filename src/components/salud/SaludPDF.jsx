import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateSaludPDF = async (evaluacion) => {
  // Create a temporary container for the PDF content
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.padding = '40px';
  container.style.background = 'white';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.color = '#333';

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

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 30px;">
      <div>
        <h1 style="margin: 0; color: #10b981; font-size: 28px; text-transform: uppercase;">Evaluación de Salud</h1>
        <p style="margin: 5px 0 0 0; color: #666; font-weight: bold;">Fundación Arupo - MedTrack</p>
      </div>
      <div style="text-align: right;">
        <p style="margin: 0; font-size: 14px;"><strong>Fecha:</strong> ${evaluacion.fecha}</p>
        <p style="margin: 5px 0 0 0; font-size: 14px;"><strong>Hora:</strong> ${evaluacion.hora_atencion}</p>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f9fafb; padding: 20px; border-radius: 8px;">
      <div>
        <p style="margin: 0 0 10px 0;"><strong>Nombre:</strong> ${evaluacion.paciente_nombre}</p>
        <p style="margin: 0 0 10px 0;"><strong>CI/ID:</strong> ${evaluacion.paciente_ci}</p>
        <p style="margin: 0 0 10px 0;"><strong>Dirección:</strong> ${evaluacion.paciente_direccion}</p>
        <p style="margin: 0;"><strong>Teléfono:</strong> ${evaluacion.paciente_telefono || '—'}</p>
      </div>
      <div>
        <p style="margin: 0 0 10px 0;"><strong>Lugar:</strong> ${evaluacion.lugar_atencion}</p>
        <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${evaluacion.paciente_email || '—'}</p>
        <p style="margin: 0 0 10px 0;"><strong>Acompañante:</strong> ${evaluacion.acompanante_nombre || '—'}</p>
        <p style="margin: 0;"><strong>Tel. Acompañante:</strong> ${evaluacion.acompanante_telefono || '—'}</p>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
      <thead>
        <tr style="background: #10b981; color: white;">
          <th style="padding: 12px; border: 1px solid #10b981; text-align: left; width: 30%;">Categoría / Mis Valores</th>
          <th style="padding: 12px; border: 1px solid #10b981; text-align: left; width: 40%;">Significación de mi valor</th>
          <th style="padding: 12px; border: 1px solid #10b981; text-align: left; width: 30%;">Resultado Actual</th>
        </tr>
      </thead>
      <tbody>
        <!-- Peso e IMC -->
        <tr>
          <td style="padding: 15px; border: 1px solid #ddd;">
            <strong>Peso:</strong> ${evaluacion.peso} kg<br>
            <strong>Talla:</strong> ${evaluacion.talla} cm<br>
            <strong>IMC:</strong> <span style="font-size: 18px; font-weight: bold; color: #10b981;">${evaluacion.imc}</span>
          </td>
          <td style="padding: 0; border: 1px solid #ddd;">
            <table style="width: 100%; height: 100%; border-collapse: collapse; font-size: 11px;">
              <tr><td style="padding: 4px 10px; border-bottom: 1px solid #eee; background: ${evaluacion.imc < 18.5 ? '#e0f2f1' : 'transparent'}">&lt; 18.5: Abajo del peso ideal</td></tr>
              <tr><td style="padding: 4px 10px; border-bottom: 1px solid #eee; background: ${evaluacion.imc >= 18.5 && evaluacion.imc < 25 ? '#e0f2f1' : 'transparent'}">18.5 - 25: Peso normal</td></tr>
              <tr><td style="padding: 4px 10px; border-bottom: 1px solid #eee; background: ${evaluacion.imc >= 25 && evaluacion.imc < 30 ? '#e0f2f1' : 'transparent'}">25 - 30: Exceso de peso</td></tr>
              <tr><td style="padding: 4px 10px; border-bottom: 1px solid #eee; background: ${evaluacion.imc >= 30 && evaluacion.imc < 35 ? '#e0f2f1' : 'transparent'}">30 - 35: Obesidad (nivel I)</td></tr>
              <tr><td style="padding: 4px 10px; border-bottom: 1px solid #eee; background: ${evaluacion.imc >= 35 && evaluacion.imc < 40 ? '#e0f2f1' : 'transparent'}">35 - 40: Obesidad (nivel II)</td></tr>
              <tr><td style="padding: 4px 10px; background: ${evaluacion.imc >= 40 ? '#e0f2f1' : 'transparent'}">&gt; 40: Obesidad (nivel III)</td></tr>
            </table>
          </td>
          <td style="padding: 15px; border: 1px solid #ddd; text-align: center; vertical-align: middle;">
            <div style="font-weight: bold; font-size: 14px; color: #059669;">${imcRange(evaluacion.imc)}</div>
          </td>
        </tr>

        <!-- Glucosa -->
        <tr>
          <td style="padding: 15px; border: 1px solid #ddd;">
            <strong>Glucosa en sangre:</strong><br>
            <span style="font-size: 18px; font-weight: bold; color: #ef4444;">${evaluacion.glucosa} mg/dL</span>
          </td>
          <td style="padding: 0; border: 1px solid #ddd;">
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <tr><td style="padding: 4px 10px; border-bottom: 1px solid #eee; background: ${evaluacion.glucosa >= 70 && evaluacion.glucosa <= 110 ? '#fee2e2' : 'transparent'}">70 - 110: Normal</td></tr>
              <tr><td style="padding: 4px 10px; border-bottom: 1px solid #eee; background: ${evaluacion.glucosa < 70 ? '#fee2e2' : 'transparent'}">120: Bajo (Referencial)</td></tr>
              <tr><td style="padding: 4px 10px; border-bottom: 1px solid #eee; background: ${evaluacion.glucosa > 110 && evaluacion.glucosa <= 150 ? '#fee2e2' : 'transparent'}">150: Moderado</td></tr>
              <tr><td style="padding: 4px 10px; border-bottom: 1px solid #eee; background: ${evaluacion.glucosa > 150 && evaluacion.glucosa <= 180 ? '#fee2e2' : 'transparent'}">180: Aumentado</td></tr>
              <tr><td style="padding: 4px 10px; border-bottom: 1px solid #eee; background: ${evaluacion.glucosa > 180 && evaluacion.glucosa <= 210 ? '#fee2e2' : 'transparent'}">210: Alto</td></tr>
              <tr><td style="padding: 4px 10px; background: ${evaluacion.glucosa > 210 ? '#fee2e2' : 'transparent'}">240: Crítico</td></tr>
            </table>
          </td>
          <td style="padding: 15px; border: 1px solid #ddd; text-align: center; vertical-align: middle;">
            <div style="font-weight: bold; font-size: 14px; color: #dc2626;">${glucosaRange(evaluacion.glucosa)}</div>
          </td>
        </tr>

        <!-- Presión Arterial -->
        <tr>
          <td style="padding: 15px; border: 1px solid #ddd;">
            <strong>Presión arterial:</strong><br>
            <span style="font-size: 18px; font-weight: bold; color: #3b82f6;">${evaluacion.presion_sistolica} / ${evaluacion.presion_diastolica} mmHg</span>
          </td>
          <td style="padding: 0; border: 1px solid #ddd;">
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <tr><td style="padding: 6px 10px; border-bottom: 1px solid #eee; background: ${presionRange(evaluacion.presion_sistolica, evaluacion.presion_diastolica) === 'Normal' ? '#dbeafe' : 'transparent'}">&lt; 120 / &lt; 80: Normal</td></tr>
              <tr><td style="padding: 6px 10px; border-bottom: 1px solid #eee; background: ${presionRange(evaluacion.presion_sistolica, evaluacion.presion_diastolica) === 'Prehipertensión' ? '#dbeafe' : 'transparent'}">120-139 / 80-89: Prehipertensión</td></tr>
              <tr><td style="padding: 6px 10px; border-bottom: 1px solid #eee; background: ${presionRange(evaluacion.presion_sistolica, evaluacion.presion_diastolica) === 'Presión sanguínea elevada: 1 etapa' ? '#dbeafe' : 'transparent'}">140-159 / 90-99: Presión elevada (Etapa 1)</td></tr>
              <tr><td style="padding: 6px 10px; background: ${presionRange(evaluacion.presion_sistolica, evaluacion.presion_diastolica) === 'Presión sanguínea elevada: 2 etapa' ? '#dbeafe' : 'transparent'}">&gt; 160 / &gt; 100: Presión elevada (Etapa 2)</td></tr>
            </table>
          </td>
          <td style="padding: 15px; border: 1px solid #ddd; text-align: center; vertical-align: middle;">
            <div style="font-weight: bold; font-size: 14px; color: #2563eb;">${presionRange(evaluacion.presion_sistolica, evaluacion.presion_diastolica)}</div>
          </td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top: 20px;">
      <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 8px; font-size: 16px; color: #10b981;">Notas Adicionales</h3>
      <p style="font-size: 13px; line-height: 1.6; color: #444; background: #fefefe; padding: 15px; border: 1px dashed #ccc; border-radius: 4px;">
        ${evaluacion.notas || 'No hay notas adicionales para esta evaluación.'}
      </p>
    </div>

    <div style="margin-top: 50px; display: flex; justify-content: space-between;">
      <div style="width: 250px; border-top: 1px solid #333; text-align: center; padding-top: 10px;">
        <p style="margin: 0; font-size: 12px;">Firma del Brigadista</p>
        <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: bold;">${evaluacion.perfiles?.nombre || 'Personal Autorizado'}</p>
      </div>
      <div style="width: 250px; border-top: 1px solid #333; text-align: center; padding-top: 10px;">
        <p style="margin: 0; font-size: 12px;">Firma del Paciente / Acompañante</p>
      </div>
    </div>

    <div style="position: absolute; bottom: 20px; left: 40px; right: 40px; text-align: center; font-size: 10px; color: #999;">
      Generado automáticamente por Arupo MedTrack - ${new Date().toLocaleString()}
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [canvas.width / 2, canvas.height / 2]
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
    pdf.save(`Evaluacion_Salud_${evaluacion.paciente_nombre.replace(/\s+/g, '_')}_${evaluacion.fecha}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error al generar el PDF. Por favor intente de nuevo.');
  } finally {
    document.body.removeChild(container);
  }
};
