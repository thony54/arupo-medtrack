import { useState, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// usePersistentState — como useState, pero el valor sobrevive a que se cierre o
// se minimice la app.
//
// En tablets, minimizar la PWA hace que el navegador descarte la página para
// ahorrar memoria; al volver, recarga desde cero y se pierde todo el estado de
// React. Este hook espeja cada campo a localStorage en cada cambio (escritura
// síncrona: aunque maten la app justo después de teclear, el dato ya quedó
// guardado) y lo restaura al montar. Así un formulario a medio llenar reaparece
// tal cual al reabrirlo.
//
// La clave se namespacea con `medtrack_draft_` para que:
//   - no choque con otras claves,
//   - se limpie junto al resto de datos locales al cerrar sesión
//     (purgarDatosLocales borra todo lo que empieza por `medtrack_`), lo que en
//     una tablet compartida evita que el siguiente usuario vea borradores ajenos.
//
// Es defensivo: en modo incógnito o con el almacenamiento bloqueado, lectura y
// escritura fallan en silencio y el hook se comporta como un useState normal.
// ─────────────────────────────────────────────────────────────────────────────

const PREFIX = 'medtrack_draft_';

export function usePersistentState(key, initialValue) {
  const storageKey = PREFIX + key;

  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw != null) return JSON.parse(raw);
    } catch {
      /* almacenamiento no disponible: usar el valor inicial */
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* lleno o bloqueado: se pierde el borrador pero la app no se rompe */
    }
  }, [storageKey, value]);

  return [value, setValue];
}

// Borra explícitamente uno o más borradores (por su key sin el prefijo).
// Normalmente no hace falta llamarlo: al resetear el formulario, los campos
// vuelven a su valor inicial y el efecto persiste ese valor vacío. Se expone
// por si algún flujo necesita limpiar sin pasar por el reset del formulario.
export function clearDraft(...keys) {
  try {
    keys.forEach((k) => localStorage.removeItem(PREFIX + k));
  } catch {
    /* almacenamiento no disponible */
  }
}
