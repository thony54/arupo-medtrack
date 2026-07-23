# CLAUDE.md

Guía para agentes de IA que trabajen en este repositorio.

## Qué es esto

**Arupo MedTrack** — App web (PWA) de la Fundación Arupo para gestionar inventario de
donaciones médicas y generales, con trazabilidad por lotes, control de vencimientos
(FEFO), registro de beneficiarios/donantes y evaluaciones de salud en brigadas.

**La app está en producción y tiene datos reales cargados** (medicinas, lotes,
beneficiarios). No ejecutes migraciones, scripts de limpieza ni operaciones
destructivas sin que el usuario lo pida explícitamente.

## Stack

- React 19 + Vite 8, JavaScript puro (no TypeScript)
- React Router 7 (`BrowserRouter`)
- Supabase (Postgres + Auth) como único backend — **no hay servidor propio**
- `vite-plugin-pwa` (Workbox) para modo offline
- `jspdf` + `html2canvas` para actas/comprobantes en PDF, `xlsx` para exportar
- CSS plano por capas (`index.css`, `App.css`, `ui.css`, `layout.css`, `pages.css`) — sin Tailwind ni CSS-in-JS
- Despliegue en Vercel (`vercel.json` solo tiene el rewrite SPA)

## Comandos

```bash
npm run dev       # servidor de desarrollo Vite
npm run build     # build de producción a dist/
npm run preview   # sirve el build
npm run lint      # ESLint (flat config en eslint.config.js)
```

No hay suite de pruebas. `test.js` en la raíz es un script suelto de conexión a
Supabase, no un test automatizado.

## Arquitectura

```
src/
  lib/supabase.js          Cliente único de Supabase. Es null si falta o es inválida
                           la VITE_SUPABASE_URL — todo el código debe tolerarlo.
  contexts/AuthContext.jsx Sesión + perfil + rol. Expone signIn/signOut/refreshProfile.
  components/layout/       Layout, Sidebar, ProtectedRoute, ProfileDropdown, PWAInstallPrompt
  components/ui/           Primitivas: Button, Input, Select, Modal, Badge
  components/inventory/    Flujos de entrada/salida de stock (ver abajo)
  components/salud/        Stepper de evaluación de salud + generación de PDF
  pages/                   Una página por ruta
  hooks/useOfflineCache.js Caché en localStorage + cola de acciones offline
  utils/itemUtils.js       Fuente de verdad para "¿es ítem médico o general?"
supabase/                  Scripts SQL versionados (schema_v2 … v16, schema_salud)
```

### Roles y rutas

Tres roles en `perfiles.rol`: `super_admin`, `brigadista`, `voluntario`.
El mapeo ruta → roles vive en `src/App.jsx` vía `<ProtectedRoute allowedRoles={[...]}>`:

| Ruta | Roles |
|---|---|
| `/` (Dashboard), `/perfil` | cualquiera autenticado |
| `/inventory`, `/catalog`, `/lotes/:productoId`, `/evaluaciones` | `super_admin`, `brigadista` |
| `/beneficiarios`, `/donantes` | `super_admin`, `voluntario` |
| `/usuarios` | `super_admin` |

**Esto es solo control de UI.** La autorización real depende de las políticas RLS de
Postgres. Ver `SECURITY.md` — hoy las políticas son permisivas y el frontend hace
fallback a `super_admin`. No asumas que `allowedRoles` protege datos.

### Modelo de datos (Supabase)

Tablas: `perfiles`, `lotes`, `donantes`, `beneficiarios`, `entregas`, `evaluaciones_salud`.
Vistas: `alertas_vencimiento`, `historial_beneficiarios`, `historial_donantes`.
Funciones: `registrar_salida_fefo`, `sync_stock_desde_lotes`, `marcar_lotes_vencidos`,
`handle_new_user`, `crear_usuario_completo`, `eliminar_usuario`.

Ojo: `medicinas` y `categorias` se usan en el código pero **no** están en los scripts
de `supabase/` — se crearon antes de que se versionaran los schemas. Si necesitas su
estructura, consúltala en el panel de Supabase, no la infieras.

Los archivos `supabase/schema_v*.sql` son migraciones incrementales que se ejecutan a
mano en el SQL Editor. No se aplican automáticamente. Al agregar una, crea un archivo
nuevo con el siguiente número; nunca reescribas uno ya aplicado.

## Reglas de dominio importantes

### FEFO vs FIFO — `src/utils/itemUtils.js`

- Los ítems **médicos** salen por **FEFO** (primero el que vence antes), vía el RPC
  `registrar_salida_fefo`.
- Los ítems **generales** (ropa, higiene, alimentos, juguetes… ver `CATEGORIAS_GENERALES`)
  salen por FIFO y no manejan vencimiento real.
- Un ítem se considera médico **por descarte**: si su categoría no está en
  `CATEGORIAS_GENERALES`, es médico. Sin categoría → médico (default seguro).
- Los generales se guardan con `fecha_vencimiento = '2099-12-31'` (`FECHA_NO_VENCE`) y
  se muestran como `N/A`. Cualquier consulta de vencimientos debe filtrar los `2099+`
  (`filtrarAlertasMedicas`).
- Número de lote autogenerado para generales: `LOTE-GENERAL-<año>-<5 dígitos>`.

Si tocas lógica de vencimientos o de stock, pasa por `itemUtils.js`; no dupliques la
regla en una página.

### Componentes de inventario

- `LoteForm` — alta de lote (entrada de stock)
- `SalidaFEFO` / `SalidaGeneral` — salidas según el tipo de ítem
- `MermaForm` — bajas por daño/vencimiento
- `DonacionGeneral` — entrega a un beneficiario; genera registro en `entregas`
- `ActaIngreso` / `Comprobante` — documentos imprimibles (usan `printRef.current.innerHTML`
  volcado a una ventana de impresión)
- `MovementForm`, `QRScanner` — movimientos y lectura de códigos

### Offline / PWA

`useOfflineCache` guarda medicinas y lotes en `localStorage` y encola acciones
(`INSERT_LOTE`, `MERMA`) mientras no hay red, sincronizándolas al volver online.
Además, Workbox cachea las respuestas de `supabase.co/rest/v1` durante 30 días
(`vite.config.js`). Ten en cuenta las implicaciones de privacidad descritas en
`SECURITY.md` antes de ampliar lo que se cachea.

## Convenciones

- **Idioma:** el dominio, los nombres de tabla/columna, los comentarios y la UI están
  en español. Mantenlo así. El código (variables JS, nombres de componentes) mezcla
  español e inglés; sigue el estilo del archivo que estés editando.
- Componentes exportados con **named export** (`export const Login = …`), no default.
- Cada página maneja su propio `loading` / `error` / `success` con `useState`; no hay
  librería de estado global más allá de `AuthContext`.
- Errores de Supabase: se hace `console.error` y se muestra un mensaje en español al
  usuario. No propagues el mensaje crudo de Postgres a la UI.
- Siempre comprueba que `supabase` no sea `null` antes de usarlo.

## Variables de entorno

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

En local viven en `.env.local`; en producción, en Vercel → Settings → Environment
Variables. Nota: cualquier variable con prefijo `VITE_` **se incrusta en el bundle del
navegador** y es pública por definición. Nunca pongas ahí una clave `service_role`.

## Scripts de utilidad en la raíz

`borrar_datos.js`, `clean_db.js` y `test.js` son scripts Node sueltos que se conectan a
la base **real** usando `.env.local`. Los dos primeros **borran datos**. No los ejecutes
salvo petición explícita del usuario.

## Antes de dar algo por terminado

1. `npm run lint` sin errores nuevos.
2. `npm run build` completa.
3. Si tocaste flujos de stock, verifica que el cálculo de existencias siga cuadrando
   (`sync_stock_desde_lotes`) y que los ítems generales no aparezcan en alertas de
   vencimiento.

## Seguridad

Lee `SECURITY.md`. Resume los riesgos conocidos del modelo actual (RLS permisiva,
fallback de rol a `super_admin`, rol elegido desde el cliente al registrar usuarios,
caché de datos clínicos en el navegador) y qué hacer para no empeorarlos.
