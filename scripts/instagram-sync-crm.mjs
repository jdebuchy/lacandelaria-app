// Trae el historial de Instagram con la Graph API y lo sincroniza al CRM.
//
// A diferencia del webhook del worker, que solo guarda mensajes entrantes, esto
// trae la conversacion completa: tambien lo que respondio el equipo. Sin eso la
// bandeja del panel muestra preguntas sin respuestas y parece que nadie contesto.
//
// Guarda datos reales, no anonimizados: es el CRM. El export anonimizado
// (instagram-export-conversations.mjs) es otra cosa, y sirve para el tono del bot.
//
// Idempotente: se puede correr las veces que haga falta.
//
// Uso: node --env-file=.env.local scripts/instagram-sync-crm.mjs [--dry]

import { createClient } from "@supabase/supabase-js";

const token = process.env.META_PAGE_ACCESS_TOKEN;
const V = "v23.0";
const dry = process.argv.includes("--dry");

if (!token) {
  console.error("Falta META_PAGE_ACCESS_TOKEN.");
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const g = async (path, params = {}) => {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const r = await fetch(`https://graph.instagram.com/${V}/${path}?${qs}`);
  return r.json();
};

const yo = await g("me", { fields: "id,user_id,username" });

// Los mensajes identifican a la cuenta por user_id (el Instagram Business ID),
// no por el id con scope de app que devuelve /me. Comparar contra el equivocado
// clasifica todas las respuestas del equipo como si fueran del cliente.
const IGID = yo.user_id ?? yo.id;

if (yo.error) {
  console.error(`Token invalido: ${yo.error.message}`);
  process.exit(1);
}

console.log(`Cuenta: @${yo.username}${dry ? "  (--dry: no escribo nada)" : ""}\n`);

let pagina = await g("me/conversations", { fields: "id,updated_time", limit: "50" });

if (pagina.error) {
  console.error(`No pude listar conversaciones: ${pagina.error.message}`);
  process.exit(1);
}

let convs = 0;
let entrantes = 0;
let salientes = 0;
let nuevos = 0;

while (pagina?.data?.length) {
  for (const conv of pagina.data) {
    const detalle = await g(conv.id, {
      fields: "messages.limit(100){id,from,to,message,created_time}"
    });

    const mensajes = (detalle.messages?.data ?? []).filter((m) => m.message).reverse();

    if (!mensajes.length) {
      continue;
    }

    // El "scoped user id" del cliente es como Meta lo identifica para esta app.
    // Es la clave con la que el worker ya venia guardando conversaciones, asi que
    // usarla evita duplicar lo que ya esta en la bandeja.
    const cliente = mensajes.find((m) => m.from?.id !== IGID)?.from;

    if (!cliente?.id) {
      continue;
    }

    convs++;

    const fechasIn = mensajes.filter((m) => m.from?.id !== IGID).map((m) => m.created_time);
    const fechasOut = mensajes.filter((m) => m.from?.id === IGID).map((m) => m.created_time);

    const filaConv = {
      external_thread_id: conv.id,
      instagram_scoped_user_id: cliente.id,
      instagram_username: cliente.username ?? null,
      last_message_at: mensajes[mensajes.length - 1]?.created_time ?? null,
      last_inbound_at: fechasIn[fechasIn.length - 1] ?? null,
      last_outbound_at: fechasOut[fechasOut.length - 1] ?? null,
      updated_at: new Date().toISOString()
    };

    let conversationId = null;

    if (!dry) {
      const { data, error } = await db
        .from("instagram_conversations")
        .upsert(filaConv, { onConflict: "instagram_scoped_user_id" })
        .select("id")
        .single();

      if (error) {
        console.error(`\nNo pude guardar la conversacion de ${cliente.username ?? cliente.id}: ${error.message}`);
        continue;
      }

      conversationId = data.id;
    }

    for (const m of mensajes) {
      const esSaliente = m.from?.id === IGID;
      esSaliente ? salientes++ : entrantes++;

      if (dry) {
        continue;
      }

      const { error } = await db.from("instagram_messages").upsert(
        {
          conversation_id: conversationId,
          external_message_id: m.id,
          direction: esSaliente ? "outbound" : "inbound",
          message_type: "text",
          text: m.message,
          raw_payload: m,
          created_at: m.created_time
        },
        { onConflict: "external_message_id", ignoreDuplicates: false }
      );

      if (error) {
        console.error(`\nMensaje ${m.id}: ${error.message}`);
      } else {
        nuevos++;
      }
    }

    // Una linea cada 10 y no un \r: corriendo en background, el retorno de carro
    // nunca se vuelca al archivo de log y parece que el script se colgo.
    if (convs % 10 === 0) {
      console.log(`  ${convs} conversaciones, ${entrantes + salientes} mensajes...`);
    }
  }

  pagina = pagina.paging?.next ? await fetch(pagina.paging.next).then((r) => r.json()) : null;
}

console.log(`\n\n${convs} conversaciones`);
console.log(`  ${entrantes} mensajes de clientes`);
console.log(`  ${salientes} respuestas del equipo`);

if (!dry) {
  console.log(`  ${nuevos} filas escritas o actualizadas`);
  console.log("\nMiralas en /panel/crm/instagram");
}
