// ============================================================================
// Edge Function: crear-personal
// ----------------------------------------------------------------------------
// Crea una cuenta de personal (super_admin / brigadista / voluntario) de forma
// SEGURA, resolviendo el hallazgo §2.1 de SECURITY.md:
//
//   - El rol NUNCA lo decide el cliente. Se valida en el servidor que QUIEN
//     LLAMA es super_admin, leyendo su JWT (nunca un campo del body).
//   - Usa la SERVICE_ROLE key (solo existe en el servidor de Supabase, jamás
//     viaja al navegador) para crear el usuario ya confirmado y fijarle el rol,
//     saltándose el trigger handle_new_user que fuerza 'voluntario'.
//   - Al no depender de signUp() público, permite CERRAR el alta pública
//     (Authentication → Providers → Email → "Allow new users to sign up" OFF).
//
// Se invoca desde la app con supabase.functions.invoke('crear-personal', ...),
// que adjunta automáticamente el Authorization: Bearer <jwt> del super_admin
// que ha iniciado sesión.
//
// Variables de entorno: SUPABASE_URL, SUPABASE_ANON_KEY y
// SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase automáticamente en el runtime
// de Edge Functions. No hay que configurarlas a mano.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ROLES_VALIDOS = ['super_admin', 'brigadista', 'voluntario'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  // Preflight CORS.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido.' }, 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: 'Configuración del servidor incompleta.' }, 500);
  }

  // Cliente con service_role: salta RLS. NO se expone al navegador.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ------------------------------------------------------------------------
  // 1. Identificar a quien llama a partir de su JWT (jamás desde el body).
  // ------------------------------------------------------------------------
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return json({ error: 'Falta la sesión del solicitante.' }, 401);
  }

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json({ error: 'Sesión inválida.' }, 401);
  }
  const solicitanteId = userData.user.id;

  // ------------------------------------------------------------------------
  // 2. Autorización: SOLO super_admin puede crear personal.
  // ------------------------------------------------------------------------
  const { data: perfil, error: perfilErr } = await admin
    .from('perfiles')
    .select('rol')
    .eq('id', solicitanteId)
    .single();
  if (perfilErr || perfil?.rol !== 'super_admin') {
    return json({ error: 'No tienes permisos para crear personal.' }, 403);
  }

  // ------------------------------------------------------------------------
  // 3. Validar la entrada (mismas reglas que la UI, pero del lado servidor).
  // ------------------------------------------------------------------------
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Cuerpo de la petición inválido.' }, 400);
  }

  const nombre = String(payload?.nombre ?? '').trim();
  const email = String(payload?.email ?? '').trim().toLowerCase();
  const password = String(payload?.password ?? '');
  const rol = String(payload?.rol ?? '');

  if (!nombre) return json({ error: 'El nombre es obligatorio.' }, 400);
  if (!email) return json({ error: 'El email es obligatorio.' }, 400);
  if (!password || password.length < 12) {
    return json({ error: 'La contraseña debe tener al menos 12 caracteres.' }, 400);
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return json({ error: 'Rol inválido.' }, 400);
  }

  // ------------------------------------------------------------------------
  // 4. Crear la cuenta con el email YA confirmado. No usa el alta pública,
  //    así que sigue funcionando aunque se desactive "Allow new users to
  //    sign up" en Supabase.
  // ------------------------------------------------------------------------
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });

  if (createErr || !created?.user) {
    const yaExiste = /already/i.test(createErr?.message ?? '');
    return json(
      {
        error: yaExiste
          ? 'Ya existe una cuenta con ese email.'
          : createErr?.message ?? 'No se pudo crear la cuenta.',
      },
      yaExiste ? 409 : 400,
    );
  }

  // ------------------------------------------------------------------------
  // 5. Fijar el rol pedido. El trigger handle_new_user ya habrá creado el
  //    perfil como 'voluntario'; con service_role saltamos RLS y lo dejamos
  //    en el rol correcto. upsert por si en algún entorno no existiera el
  //    trigger.
  // ------------------------------------------------------------------------
  const { error: upsertErr } = await admin
    .from('perfiles')
    .upsert({ id: created.user.id, email, nombre, rol }, { onConflict: 'id' });

  if (upsertErr) {
    // La cuenta quedó creada, pero como voluntario. Se informa para promover.
    return json(
      {
        error:
          `La cuenta se creó, pero no se pudo asignar el rol "${rol}". ` +
          'Quedó como voluntario; promuévela desde /usuarios.',
      },
      500,
    );
  }

  return json({ ok: true, id: created.user.id, rol });
});
