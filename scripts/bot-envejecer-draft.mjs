// Envejece el draft de una conversacion, para probar que pasa cuando el cliente
// vuelve horas o dias despues.
//
// Sin esto no hay forma de probar a mano una regla que depende de que pase el
// tiempo: habria que esperar tres horas de verdad, o cambiar el reloj de la
// maquina, que rompe otras cosas.
//
// Uso: node --env-file=.env.local scripts/bot-envejecer-draft.mjs 5
//      node --env-file=.env.local scripts/bot-envejecer-draft.mjs 30 999000001
//
// Menos de 3h el bot sigue como si nada, entre 3h y 24h retoma nombrando el
// hueco, y pasadas 24h el pedido viejo pasa a ser una sugerencia.

import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const horas = Number(process.argv[2]);
const thread = process.argv[3] ?? (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "").split(",")[0]?.trim();

if (!Number.isFinite(horas) || horas <= 0) {
  console.error("Pasa cuantas horas envejecer. Ej: scripts/bot-envejecer-draft.mjs 5");
  process.exit(1);
}

if (!thread) {
  console.error("Pasa un threadId o carga TELEGRAM_ALLOWED_CHAT_IDS.");
  process.exit(1);
}

const { data: conv } = await db
  .from("conversations")
  .select("id, draft_order")
  .eq("channel", "telegram")
  .eq("channel_thread_id", thread)
  .maybeSingle();

if (!conv) {
  console.error(`No hay conversacion de Telegram para el thread ${thread}.`);
  process.exit(1);
}

if (!conv.draft_order || !Object.keys(conv.draft_order).length) {
  console.error("Esa conversacion no tiene ningun pedido a medias que envejecer.");
  process.exit(1);
}

const nuevaFecha = new Date(Date.now() - horas * 3_600_000).toISOString();

const { error } = await db
  .from("conversations")
  .update({ draft_order: { ...conv.draft_order, actualizadoEn: nuevaFecha } })
  .eq("id", conv.id);

if (error) {
  console.error(`No se pudo actualizar: ${error.message}`);
  process.exit(1);
}

const esperado = horas >= 24 ? "sugerencia" : horas >= 3 ? "dormido" : "activo";

console.log(`Listo. El pedido ahora figura como de hace ${horas}h (${nuevaFecha}).`);
console.log(`Escribile al bot: deberia tratarlo como "${esperado}".`);
