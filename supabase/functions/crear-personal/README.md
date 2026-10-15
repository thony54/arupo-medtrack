# Edge Function: `crear-personal`

Crea cuentas de personal (super_admin / brigadista / voluntario) de forma
**segura**, cerrando el hallazgo §2.1 de `SECURITY.md`: el rol deja de decidirse
en el cliente y el alta ya no depende del registro público.

## Qué hace

1. Lee el **JWT del solicitante** (lo adjunta `supabase.functions.invoke`) y
   verifica en el servidor que su rol en `perfiles` es `super_admin`. El rol
   **nunca** se toma del cuerpo de la petición.
2. Con la **service_role key** (solo vive en el servidor) crea la cuenta con el
   email ya confirmado y le asigna el rol pedido. No usa `signUp()`, así que
   funciona aunque el alta pública esté desactivada.

## Requisitos previos

- Supabase CLI instalado: <https://supabase.com/docs/guides/cli>
- Estar enlazado al proyecto correcto:

```bash
supabase link --project-ref <TU_PROJECT_REF>
```

> El `project-ref` está en el panel: Project Settings → General → Reference ID.

## Desplegar

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta
Supabase automáticamente en el runtime. **No hay que configurar secretos.**

```bash
supabase functions deploy crear-personal
```

Verifica que quedó desplegada:

```bash
supabase functions list
```

## Probar

Desde la app, inicia sesión como super_admin y crea un usuario eligiendo el rol
"Brigadista". Debe crearse como brigadista (ya no como voluntario). El frontend
llama a esta función automáticamente; si aún no estuviera desplegada, cae al
método anterior (signUp + promoción) para no bloquear el alta.

Prueba manual con `curl` (sustituye el host y un access-token de super_admin):

```bash
curl -i -X POST \
  "https://<TU_PROJECT_REF>.supabase.co/functions/v1/crear-personal" \
  -H "Authorization: Bearer <ACCESS_TOKEN_SUPER_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Prueba","email":"prueba@ejemplo.com","password":"contrasenalarga12","rol":"brigadista"}'
```

Respuestas:
- `200 {"ok":true,"id":"…","rol":"brigadista"}` — creado.
- `403` — quien llama no es super_admin.
- `409` — el email ya existe.
- `400` — validación (nombre/email/contraseña/rol).

## Cerrar el alta pública (paso final, recomendado)

Una vez la función está desplegada y probada, ya se puede cerrar el agujero de
registro público sin perder la capacidad de crear personal:

**Supabase → Authentication → Providers → Email**
- `[ ]` Allow new users to sign up → **DESACTIVAR**
- `[x]` Confirm email → **ACTIVAR**

Después de esto, el método de compatibilidad del frontend (signUp) dejará de
funcionar a propósito, y toda alta pasará por esta función. Es el estado final
deseado descrito en `supabase/schema_v19.sql` (PARTE 3) y `schema_v21.sql`.

## Notas de seguridad

- La service_role key **jamás** viaja al navegador: solo se usa dentro de la
  función.
- `verify_jwt = true` (en `supabase/config.toml`): el gateway exige un JWT
  válido antes de ejecutar; la función además revalida que sea super_admin.
- El trigger `handle_new_user` sigue creando todo perfil como `voluntario`; esta
  función lo promueve tras crearlo. Si el `upsert` del rol fallara, la cuenta
  queda como voluntario y la función lo informa para promover a mano.
