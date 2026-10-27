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
npm run i18n:check # los 6 diccionarios de idioma tienen las mismas claves y variables
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
  utils/roles.js           Fuente de verdad de roles: etiquetas, colores, orden jerárquico
  utils/estancia.js        Tiempo de estancia del voluntario (3–24 meses): rango, formato, fecha de fin
  i18n/                    Idiomas (es en de pt it fr): I18nProvider, useI18n(), SelectorIdioma, locales/*.js
  utils/bitacora.js        Bitácora de jornada: validación de actividades, horas am/pm, compresión de foto
  components/voluntariado/ CierreJornada (modal); pages/MisActividades.jsx (`/actividades`,
                           timeline de jornadas) y pages/Tareas.jsx (`/tareas`) son del voluntario
  utils/reporteBitacoras.js Excel de bitácoras (hojas Actividades y Resumen)
  lib/equipos.js           Perfiles con columnas tolerantes (v22/v27), designar líderes, asignar voluntarios
  legal/terminos.js        Texto y VERSION de los términos (BORRADOR a revisar por la Fundación)
  lib/terminos.js          Verificar/registrar la aceptación de términos
  components/security/     ProteccionPantalla (cortina anti-captura, mejor esfuerzo)
  curso/                   Curso de español: plan.js (12 unidades), calendario.js, contenido/, certificado.js
  components/curso/        LeccionPlayer (ejercicios); pages/Curso.jsx = línea de tiempo
supabase/                  Scripts SQL versionados (schema_v2 … v36, schema_salud)
```

### Roles y rutas

**Jerarquía (decidida por el dueño, Karter):** el **admin principal**
(`thony.karter@gmail.com`) no tiene a nadie por encima. Debajo están los **Admin**
(`perfiles.rol = 'super_admin'`; "Admin" es solo la etiqueta de la interfaz, el valor de la base
no cambia) y, por debajo, brigadistas y voluntarios. **Ser Admin NO da acceso a Coordinación, a
las Evaluaciones de salud ni a Gestión de Personal** (menú, rutas ni datos): cada una la da un
rol que el admin principal asigne, y el admin principal accede a todo. Lo hace valer la base
(`schema_v35.sql` y `schema_v36.sql`), no solo la interfaz. **No des a un Admin acceso a nada de
esto "por ser admin"**; si añades un módulo nuevo, decide qué rol adicional lo abre.

| Permiso | Quién lo tiene | En la base | En la UI (`useAuth()`) |
|---|---|---|---|
| Coordinación | admin principal; `es_coordinador` (voluntarios); `es_coordinador_brigadas` (brigadistas) | `puede_revisar_bitacoras()`, `puede_gestionar_usuario(id)` | `esCoordinacion`, `cohortes` |
| Evaluaciones de salud | brigadista (las suyas); `es_coordinador_brigadas` y admin principal (todas) | `puede_ver_todas_evaluaciones()`, `puede_registrar_evaluaciones()` | `puedeVerEvaluaciones`, `veTodasEvaluaciones` |
| Gestión de Personal (`/usuarios`) | admin principal; un Admin con `es_gestor_personal` | `puede_gestionar_personal()` | `puedeGestionarPersonal` |

`es_gestor_personal` solo vale en un Admin y solo lo otorga el admin principal (trigger de `perfiles`).
Quien gestiona personal no puede crear, modificar ni eliminar a otro Admin ni al admin principal
(políticas de `perfiles`, `eliminar_usuario` y la Edge Function `crear-personal`, que hay que
**redesplegar** con `supabase functions deploy crear-personal` cuando cambia su código).

Tres roles principales en `perfiles.rol`: `super_admin`, `brigadista`, `voluntario`.
Además hay roles **adicionales** que se suman al principal; el primero, `perfiles.es_coordinador`
(Coordinador de Voluntariado). No es un valor de `rol` porque un mismo usuario
puede ser `super_admin` y coordinador a la vez (caso de e_milton@fundacionarupo.org).
Se otorga **solo desde `/usuarios` con la sesión del super admin principal**
(`thony.karter@gmail.com`, botón "Gestionar roles"), nunca por registro. En código:
`useAuth().isCoordinador`. Sus módulos (bitácoras, reportes Excel) se añaden por
partes según `MedTrack Modulo por anadir.docx`. Requiere `schema_v22.sql` (columna).

**Coordinador de Brigadas Médicas** (`schema_v33.sql`): segundo rol adicional, columna
`perfiles.es_coordinador_brigadas` (`useAuth().isCoordinadorBrigadas`). Monitorea y lidera a
los que entran con el rol `brigadista`. **Solo lo otorga el admin principal** y la base
lo hace valer: el trigger `perfiles_proteger_campos` compara el correo del JWT con
`es_super_admin_principal()` y, desde v35, exige lo mismo para cambiar `es_coordinador`,
`es_coordinador_brigadas`, `es_lider` y `lider_id` (otro Admin recibe 42501 aunque llame a la API
directamente). **Alcance por equipo:** el admin principal ve voluntarios y brigadistas;
`es_coordinador`, solo voluntarios; `es_coordinador_brigadas`, solo brigadistas; un Admin sin rol
de coordinación, a nadie. Lo decide `puede_gestionar_usuario(id)` en las
políticas de `bitacoras`, `tareas_voluntario`, `curso_progreso`, las fotos del bucket y los RPC
(aprobar/rechazar, asignar/retirar tareas, `asignar_voluntario_a_lider`, `curso_resumen`).
`puede_revisar_bitacoras()` solo significa "tiene acceso a Coordinación" (rol de coordinación o
admin principal): no basta por sí sola para ver datos de una persona. En la UI: `cohortes` (de
`cohortesGestionadas()` en `roles.js`; `[]` = sin acceso), `esCoordinacion` (= `cohortes.length > 0`)
y `esAdminPrincipal` salen de `useAuth()`; `etiquetasPersonal()` adapta `/bitacoras`, `/equipos` y
`/asignar-tareas` a quién gestiona cada uno. Las rutas usan `<ProtectedRoute permiso="coordinacion">`.
La lista de líderes (`es_lider`) es una sola y la comparten ambos equipos; una
coordinación no puede quitar a un líder que tiene personas del otro equipo (error 55006).

**Brigadistas y el voluntariado:** los brigadistas conservan todo lo suyo y además usan Mis
Actividades (`/actividades`), Tareas (`/tareas`) y el Curso (`/curso`), igual que el voluntario
(`useAuth().participaVoluntariado` = voluntario o brigadista; `registrar_bitacora` acepta ambos
roles). Su tiempo de estancia es **opcional** (solo hace falta para el curso) y ven la app en su
idioma (ver "Idiomas").

**Estancia del voluntario:** `perfiles.tiempo_estancia_meses` (3–24) y
`fecha_inicio_estancia`, obligatorios en la edición de perfil del `voluntario`. Se
guardan con el RPC `guardar_tiempo_estancia` (`schema_v23.sql`), no con UPDATE directo,
porque `perfiles` no admite auto-edición general. La app oculta el campo y el aviso
mientras la columna no exista (`estanciaDisponible`), así que el orden de despliegue
da igual.

**Bitácora de cierre de jornada** (`schema_v24.sql`): el voluntario la registra desde
el menú lateral → "Mis Actividades" (`/actividades`, o el aviso del Inicio). Tabla `bitacoras` (actividades en
JSONB, líder, **1 a 3 fotos** (`fotos TEXT[]`, mínimo 1 en las nuevas), formación continua,
`estado` pendiente/aprobada). **Solo se escribe con el RPC `registrar_bitacora`** (valida en
servidor y fija `created_at` con el reloj de la base: es el timestamp inmutable); la API no
tiene INSERT/UPDATE/DELETE. Las fotos "Momento feliz" van al bucket **privado**
`momentos-felices` (`<uid>/<id>.jpg`) y se muestran con URL firmada; pueden contener a
beneficiarios, así que el bucket nunca debe ser público (`schema_v26.sql` pasó de 1 a 3 fotos).
Las ven super_admin y la coordinación de su equipo (`puede_gestionar_usuario()`, v33): cada
coordinador, solo las de su gente.

**Revisión de bitácoras** (`schema_v25.sql`): pantalla `/bitacoras` (`pages/Bitacoras.jsx`,
menú "Coordinación") para super_admin y coordinadores, con filtros por voluntario,
estado y fechas, aprobación y descarga a Excel (`utils/reporteBitacoras.js`: hojas
"Actividades" y "Resumen"). Los campos siguen la tabla "Estructura del reporte Excel" del
docx (viene como IMAGEN dentro del documento): ID y voluntario, tiempo de estancia, timestamp
en UTC, detalle de actividades, líder a cargo, evidencia (enlaces firmados de **7 días** a las
fotos del bucket privado, como hipervínculo) y avance de español (% y nivel, de `curso_resumen`;
"N/D" si falta v29). La ruta usa `<ProtectedRoute permiso="coordinacion">` porque
el coordinador no es un valor de `rol` y un Admin corriente no debe entrar. Aprobar solo se hace con el RPC
`aprobar_bitacora` (nadie aprueba la suya). **Rechazar** (`schema_v32.sql`): estado `rechazada`,
columna `motivo_rechazo` (mensaje obligatorio, ≤500) y RPC `rechazar_bitacora`; el voluntario
ve el estado y el mensaje en Mis Actividades (`bitacora.estado_rechazada`,
`actividades.motivo_rechazo`). Una bitácora aprobada o rechazada no se vuelve a tocar: para
corregir, el voluntario registra una jornada nueva. El Inicio muestra el KPI "Bitácoras por
Revisar" (solo pendientes).

**Líderes de grupo** (`schema_v27.sql`, pantalla `/equipos`): `perfiles.es_lider` marca quién
puede ser "líder responsable" (lo designa un super_admin o coordinador con los RPC
`asignar_lider` / `asignar_voluntario_a_lider`, porque `perfiles` solo lo escribe
super_admin) y `perfiles.lider_id` es el líder asignado a un voluntario. El selector del
cierre de jornada lista solo a los `es_lider` (solo el nombre, sin correo ni rol; sin respaldo
por rol) y preselecciona el asignado; `registrar_bitacora` lo valida igual. Líder es únicamente
quien designa la coordinación en `/equipos`: ni voluntarios ni brigadistas lo son por defecto.
(La migración v27 sembró como líderes a super_admin, brigadistas y coordinadores; esa siembra
se reinicia a mano con un UPDATE puntual en el SQL Editor, sin archivo de schema para no
borrar designaciones al re-ejecutarlo. No vuelvas a sembrarlos.) `/equipos` también muestra la actividad de 30 días por
voluntario y por líder.

**Tareas asignadas** (`schema_v30.sql`): el menú del voluntario tiene su propia página
"Tareas" (`/tareas`, `pages/Tareas.jsx`) con lo que la coordinación le asignó. Las
asigna el coordinador (o super_admin) desde su propia pantalla `/asignar-tareas`
(`pages/AsignarTareas.jsx`, menú "Coordinación"): asignar, ver pendientes y hechas por
voluntario y retirar; `/equipos` ya no maneja tareas. Tabla `tareas_voluntario` sin escritura por API: solo los RPC
`asignar_tarea`, `completar_tarea` (el voluntario dueño o la coordinación) y `retirar_tarea`.
El voluntario ve solo las suyas; el Inicio le avisa cuántas tiene pendientes. La app oculta
todo mientras la tabla no exista (`lib/tareas.js`). Textos de voluntario en 6 idiomas
(`tareas.*`); la pantalla de la coordinación va en español.

**Formación continua de la bitácora:** el cierre de jornada sugiere (ya marcadas) las lecciones
del curso de español que el voluntario trabajó desde su última jornada (tope 7 días; lee
`curso_progreso`, solo si v29 está aplicado). Lo marcado + el texto libre se guardan como un
único texto en `bitacoras.formacion_continua` (`armarFormacionContinua` en `utils/bitacora.js`,
siempre en español porque lo lee la coordinación y va al Excel). No hay columna nueva.

**Evaluaciones de salud** (`/evaluaciones`, `components/salud/`): el stepper (`SaludStepper`) cierra
cada examen con un diagnóstico escrito por el médico o brigadista (`diagnostico_fisico` en Medidas
Físicas, `diagnostico_medico` en Examen Médico; `schema_v34.sql`). Si la columna aún no existe, el
diagnóstico se guarda dentro de `notas` (no se pierde). El PDF (`SaludPDF.jsx`) es una hoja A4 con el
logo, el diagnóstico y la firma de la directora de la Fundación (Maria Fernanda Ayala) y la del
paciente; no lleva pie de "generado automáticamente". Todo texto libre se escapa (`esc`) antes de
volcarlo en el HTML del PDF. El formulario usa `.salud-form` (`ui.css`): `.label` y `.input-field`
no tienen ancho por defecto y fuera de ese contenedor la etiqueta queda en línea con el campo.

## Idiomas (6)

`src/i18n/`: `useI18n()` → `{ t, tn, idioma, formatearFecha, ... }`; `t('clave', { var })` y
`{var}` en los textos. Idiomas: es (original), en, de, pt (neutro, sesgo brasileño), it, fr.
**Regla de producto: solo el voluntario y el brigadista ven la app en su idioma y solo sus
pantallas** (ingreso, términos, inicio, perfil, cierre de jornada, Mis Actividades, curso, menú
lateral). Inventario, CRM (Beneficiarios/Donantes) y administración siguen en español. Los
componentes compartidos usan `t()`: como el idioma efectivo del super_admin es siempre `es`,
staff ve lo de siempre y el selector (`SelectorIdioma`) no se muestra. (Quitar el idioma al
brigadista es una línea: `selectorVisible` en `I18nProvider.jsx`.) Antes del login (sin
rol) se usa el idioma elegido, guardado en `localStorage` bajo `arupo_idioma` (sin prefijo
`medtrack_` para que sobreviva al cerrar sesión). Las utilidades puras reciben `t` (español
por defecto, vía `i18n/tEs.js`). **Al añadir un texto para voluntarios: ponlo con `t()` en los
6 `locales/*.js` y corre `npm run i18n:check`.** Las traducciones (sobre todo los términos
legales) conviene que las revise una persona nativa.

## Curso de español (opcional)

Ruta `/curso` (voluntarios; el super_admin puede entrar a revisarlo), menú "Curso de Español".
Estructura de `MedTrack Modulo por anadir.docx`: 12 unidades en 4 bloques (`curso/plan.js`).
**El curso dura exactamente la estancia del voluntario**: `calendario.js` reparte las 12 unidades
en el intervalo `fecha_inicio_estancia` → fin (pesos del plan de 24 meses: 1/1/1, 5/3 ×3, 4/3 ×3,
4/4/4), por lo que la última unidad termina el día del fin y esa es la fecha del certificado.
Las lecciones se desbloquean en orden. El progreso se guarda con el RPC
`guardar_progreso_leccion` (`schema_v29.sql`, tabla `curso_progreso`); la coordinación ve las
lecciones completadas por voluntario en `/equipos` (RPC `curso_resumen`). **El certificado**
(PDF con jsPDF, español + traducción al idioma del voluntario) solo está disponible con TODAS las
unidades con contenido y completas y habiendo llegado a la fecha de fin del voluntariado.
**Contenido:** vive en `src/curso/contenido/` (hoy solo ejemplos en las unidades 1 y 2; formato y
tipos de ejercicio —opcion, escuchar, completar, emparejar— documentados en `contenido/index.js`).
Las unidades sin lecciones salen como "Próximamente". Las respuestas viajan en la app: el curso es
formativo y opcional; si el certificado exigiera garantía fuerte, habría que corregir en servidor.

## Seguridad: términos y protección de pantalla

**Aceptación de términos** (`schema_v28.sql`): `Layout` muestra `AceptarTerminos` (botón
"ESTOY DE ACUERDO") en lugar de la app hasta que la persona acepte la versión vigente
(`VERSION_TERMINOS` en `src/legal/terminos.js`). Se guarda en `aceptaciones_terminos`
(user_id, fecha del reloj de la base, **IP tomada en el servidor** de los encabezados de
PostgREST, navegador, versión) solo vía el RPC `aceptar_terminos`; la tabla es append-only y
sin FK al usuario para que sobreviva si se borra la cuenta. Cambiar el texto de forma
relevante = subir `VERSION_TERMINOS` (todos vuelven a aceptar). La compuerta **no bloquea**
si falla la consulta (sin red / sin SQL): es un trámite legal, no autorización. El texto
actual es un borrador redactado por el asistente: debe revisarlo la Fundación.

**Protección de pantalla** (`components/security/ProteccionPantalla.jsx`): una web NO puede
impedir capturas del sistema; es un disuasivo que oculta el contenido con una cortina al
pasar a segundo plano, perder el foco, pulsar PrintScreen / Cmd+Shift+3-4-5 o Ctrl/Cmd+P.
Solo en producción. `VITE_PROTECCION_PANTALLA=off` la quita y `=suave` no oculta por pérdida
de foco. No tocar la impresión con CSS (`@media print`): las actas se imprimen desde un
iframe y en iPad un `print()` dentro de un iframe puede imprimir la página completa.
Para bloqueo real (Android FLAG_SECURE / iOS) haría falta empaquetar la app (Capacitor).

**Aviso a Discord de cada bitácora** (`api/notify-bitacora.js`, variable
`DISCORD_WEBHOOK_BITACORAS`): tras registrar, el navegador llama al endpoint con la sesión del
voluntario; el servidor lee SU bitácora (RPC `obtener_bitacora_a_notificar`), descarga las
fotos del bucket privado con esa misma sesión, las adjunta al embed y marca `notificada_en`
(RPC `marcar_bitacora_notificada`) solo si Discord aceptó. No usa `service_role` ni confía en
lo que envíe el cliente. `MisActividades` reintenta los avisos pendientes de los últimos 3 días.
**Las fotos salen del bucket privado hacia Discord**: el canal debe ser privado y reducido.
El mapeo ruta → roles vive en `src/App.jsx` vía `<ProtectedRoute allowedRoles={[...]}>`:

| Ruta | Roles |
|---|---|
| `/` (Dashboard), `/perfil` | cualquiera autenticado |
| `/inventory`, `/catalog`, `/lotes/:productoId` | `super_admin`, `brigadista` |
| `/evaluaciones` | brigadista, `es_coordinador_brigadas` o admin principal (`permiso="evaluaciones"`); **un Admin corriente no entra** |
| `/beneficiarios`, `/donantes` | `super_admin`, `voluntario` |
| `/usuarios` | admin principal o Admin con `es_gestor_personal` (`permiso="personal"`); **un Admin corriente no entra** |
| `/bitacoras`, `/equipos`, `/asignar-tareas` | solo quien tenga un rol de coordinación asignado (`es_coordinador` / `es_coordinador_brigadas`) o sea el admin principal (`permiso="coordinacion"`); **un Admin corriente no entra**; cada uno ve solo a su equipo |
| `/actividades`, `/tareas` | `voluntario`, `brigadista` |
| `/curso` | `voluntario`, `brigadista`; `super_admin` puede revisarlo |

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

### Notificaciones a Discord (7 canales + bitácoras)

Eventos de runtime y de negocio se envían a Discord, un canal por tipo de evento.
Todo pasa por un **único proxy serverless** para que los webhooks no viajen en el
bundle público. Piezas:

- `api/notify.js` — **proxy único en Vercel**. Mapea `evento → webhook` (7 env
  vars **sin** prefijo `VITE_`, ver abajo), compone el embed y bloquea @menciones.
  Un evento sin su webhook responde `200` sin enviar (no rompe la app). Solo el
  canal de errores se redacta server-side; los de negocio envían datos completos.
- `src/lib/notify.js` — notificaciones de negocio (6 tipos: nuevo-medicamento,
  nuevo-item, nuevo-beneficiario, donacion-entregada, nuevo-donante,
  donacion-recibida) + cola offline en `localStorage`.
- `src/lib/errorReporter.js` — errores → canal de errores (evento `error`).
  Capta `window.onerror`, `unhandledrejection` e **intercepta `console.error`**;
  redacta PII, deduplica, limita ritmo y encola offline.
- `src/components/ErrorBoundary.jsx` — crashes de render de React. Envuelve `<App/>`.
- `AuthContext` expone `window.__MEDTRACK_ROLE__` para el reporter de errores.

**Quién actuó:** cada notificación de negocio lleva nombre + rol de quien la hizo
(vía `useAuth()` en el componente). Así los canales sirven de registro por rol.
Componentes que notifican: `LoteForm`, `DonacionGeneral`, `SalidaFEFO`,
`SalidaGeneral`, `pages/Beneficiarios`, `pages/Donantes`.

**Solapamiento:** un ingreso de stock con donante dispara el canal por producto
**y** un `donacion-recibida` consolidado. Sin donante, no hay `donacion-recibida`.

**Privacidad:** en `#errores-medtrack` se enmascaran correos, cédulas, JWT y
claves `sb_...`. Los canales de negocio NO se redactan (decisión del usuario:
trazabilidad completa). Si añades un `console.error`, se reenviará a Discord.

Conexión de los webhooks: ver `NOTIFICACIONES-DISCORD.local.md` (local, gitignoreado).

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

Variables adicionales, **solo en el servidor** (Vercel, sin prefijo `VITE_`) —
los webhooks de Discord que usa `api/notify.js`, una por canal:

```
DISCORD_WEBHOOK_ERRORES
DISCORD_WEBHOOK_NUEVO_MEDICAMENTO
DISCORD_WEBHOOK_NUEVO_ITEM
DISCORD_WEBHOOK_NUEVO_BENEFICIARIO
DISCORD_WEBHOOK_DONACION_ENTREGADA
DISCORD_WEBHOOK_NUEVO_DONANTE
DISCORD_WEBHOOK_DONACION_RECIBIDA
DISCORD_WEBHOOK_BITACORAS            # lo usa api/notify-bitacora.js (8.º canal, con fotos)
```

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
