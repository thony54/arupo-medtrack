// ─────────────────────────────────────────────────────────────────────────────
// Notificaciones de negocio → Discord
//
// Envía a los canales operativos (nuevo medicamento/ítem, beneficiario, donante,
// entregas y donaciones recibidas) vía el proxy serverless `/api/notify`, que
// enruta cada evento a su webhook. Cada notificación lleva SIEMPRE quién actuó
// (nombre + rol) para poder rastrear el movimiento de cada rol.
//
// A diferencia de los errores, estos canales envían datos completos a propósito
// (trazabilidad). El servidor NO redacta los canales de negocio.
//
// Reglas: nunca lanza (fire-and-forget); si no hay red, encola en localStorage y
// reintenta al reconectar. El endpoint tolera webhooks no configurados (200).
// ─────────────────────────────────────────────────────────────────────────────

const ENDPOINT = '/api/notify';
const QUEUE_KEY = 'medtrack_notify_queue';
const QUEUE_MAX = 50;

const COLOR = {
  'nuevo-medicamento': 0x10b981,
  'nuevo-item': 0x7c3aed,
  'nuevo-beneficiario': 0x3b82f6,
  'donacion-entregada': 0x059669,
  'nuevo-donante': 0xf59e0b,
  'donacion-recibida': 0x0ea5e9,
};

const originalConsoleError =
  typeof console !== 'undefined' ? console.error.bind(console) : () => {};

// ── Cola offline ─────────────────────────────────────────────────────────────
const leerCola = () => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
};
const guardarCola = (arr) => {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(arr.slice(-QUEUE_MAX))); } catch { /* lleno */ }
};

const despachar = async (payload) => {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (res && !res.ok && res.status !== 204) throw new Error('HTTP ' + res.status);
  } catch {
    const cola = leerCola();
    cola.push(payload);
    guardarCola(cola);
  }
};

export const flushNotifyQueue = async () => {
  const cola = leerCola();
  if (cola.length === 0) return;
  guardarCola([]);
  for (const p of cola) {
    await despachar(p);
  }
};

let instalado = false;
export const initNotifyFlush = () => {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;
  window.addEventListener('online', () => { void flushNotifyQueue(); });
  void flushNotifyQueue();
};

// ── Núcleo ───────────────────────────────────────────────────────────────────
const postEvento = (evento, { titulo, descripcion, campos }) => {
  try {
    void despachar({
      evento,
      username: 'MedTrack',
      titulo,
      descripcion: descripcion || undefined,
      campos: (campos || []).filter((c) => c && c.value != null && c.value !== ''),
      color: COLOR[evento],
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    originalConsoleError('[notify] fallo interno:', e);
  }
};

// Campo "quién actuó" — presente en todos los eventos.
const campoActor = (actor, label = 'Registrado por') => ({
  name: label,
  value: actor
    ? `${actor.nombre || 'Desconocido'} · ${actor.rol || 'sin-rol'}`
    : 'Desconocido · sin-rol',
  inline: true,
});

const f = (name, value, inline = true) => ({ name, value, inline });

// ── Eventos ──────────────────────────────────────────────────────────────────

export const notificarNuevoMedicamento = ({ producto, cantidad, numeroLote, fechaVencimiento, ubicacion, donante, actor }) =>
  postEvento('nuevo-medicamento', {
    titulo: `💊 Ingreso de medicina: ${producto}`,
    campos: [
      f('Cantidad', cantidad),
      f('N° Lote', numeroLote || 'S/N'),
      f('Vence', fechaVencimiento || 'N/A'),
      f('Ubicación', ubicacion || '—'),
      f('Donante', donante || 'Sin donante'),
      campoActor(actor, 'Ingresado por'),
    ],
  });

export const notificarNuevoItem = ({ producto, categoria, cantidad, numeroLote, ubicacion, donante, actor }) =>
  postEvento('nuevo-item', {
    titulo: `📦 Ingreso de ítem general: ${producto}`,
    campos: [
      f('Categoría', categoria || '—'),
      f('Cantidad', cantidad),
      f('Lote', numeroLote || '—'),
      f('Ubicación', ubicacion || '—'),
      f('Donante', donante || 'Sin donante'),
      campoActor(actor, 'Ingresado por'),
    ],
  });

export const notificarBeneficiario = ({ beneficiario = {}, actor }) =>
  postEvento('nuevo-beneficiario', {
    titulo: `🧑 Nuevo beneficiario: ${beneficiario.nombre || '—'}`,
    campos: [
      f('Tipo', beneficiario.tipo || '—'),
      f('Cédula/ID', beneficiario.cedula || '—'),
      f('Teléfono', beneficiario.telefono || '—'),
      f('Dirección', beneficiario.direccion || '—', false),
      f('Condición médica', beneficiario.condicion_medica || '—'),
      campoActor(actor, 'Registrado por'),
    ],
  });

export const notificarBeneficiariosImportados = ({ cantidad, actor }) =>
  postEvento('nuevo-beneficiario', {
    titulo: `🧑 Importación masiva: ${cantidad} beneficiario(s)`,
    campos: [
      f('Total importados', cantidad),
      campoActor(actor, 'Importado por'),
    ],
  });

export const notificarDonacionEntregada = ({ beneficiario = {}, destino, items = [], total, tipo, actor }) =>
  postEvento('donacion-entregada', {
    titulo: `🎁 Entrega a: ${beneficiario.nombre || destino || '—'}`,
    descripcion: items.length
      ? items.map((i) => `• ${i.nombre} — ${i.cantidad}`).join('\n')
      : undefined,
    campos: [
      f('Beneficiario', beneficiario.nombre || destino || '—'),
      f('Cédula/ID', beneficiario.cedula || '—'),
      f('Total unidades', total ?? '—'),
      f('Tipo', tipo || 'médico'),
      f('Condición médica', beneficiario.condicion_medica || '—'),
      campoActor(actor, 'Entregado por'),
    ],
  });

export const notificarNuevoDonante = ({ donante = {}, actor }) =>
  postEvento('nuevo-donante', {
    titulo: `🤝 Nuevo donante: ${donante.nombre || '—'}`,
    campos: [
      f('Tipo', donante.tipo || '—'),
      f('Cédula/ID', donante.cedula || '—'),
      f('Teléfono', donante.telefono || '—'),
      f('Correo', donante.email || '—'),
      f('Contacto', donante.contacto_responsable || '—'),
      campoActor(actor, 'Registrado por'),
    ],
  });

export const notificarDonacionRecibida = ({ donante = {}, items = [], total, actor }) =>
  postEvento('donacion-recibida', {
    titulo: `📥 Donación recibida de: ${donante.nombre || '—'}`,
    descripcion: items.length
      ? items.map((i) => `• ${i.nombre} — ${i.cantidad}`).join('\n')
      : undefined,
    campos: [
      f('Donante', donante.nombre || '—'),
      f('Tipo donante', donante.tipo || '—'),
      f('Cédula/ID', donante.cedula || '—'),
      f('Total ítems', total ?? '—'),
      campoActor(actor, 'Recibido por'),
    ],
  });
