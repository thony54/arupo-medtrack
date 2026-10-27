// Logo de la Fundación como data URL, para incrustarlo en los PDF (jsPDF / html2canvas).
// Devuelve null si no se puede cargar: el documento se genera igual, sin logo.
export const cargarLogo = async () => {
  try {
    const res = await fetch('/arupo-logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result);
      lector.onerror = () => resolve(null);
      lector.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};
