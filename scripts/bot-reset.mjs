// Borra una conversacion del bot para empezar de cero.
//
// Probar sobre una conversacion usada arrastra estado: mensajes viejos en el
// historial, contadores de LLM, un draft a medio llenar. Eso hace que dos
// pruebas del mismo mensaje den resultados distintos y no se sepa por que.
//
// Uso: node --env-file=.env.local scripts/bot-reset.mjs            (la del allowlist)
//      node --env-file=.env.local scripts/bot-reset.mjs <threadId>

import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const thread = process.argv[2] ?? (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "").split(",")[0]?.trim();

if (!thread) {
  console.error("Pasa un threadId o carga TELEGRAM_ALLOWED_CHAT_IDS.");
  process.exit(1);
}

const { data: conv } = await db
  .from("conversations")
  .select("id")
  .eq("channel", "telegram")
  .eq("channel_thread_id", thread)
  .maybeSingle();

if (!conv) {
  console.log(`No hay conversacion para ${thread}. Ya esta limpio.`);
  process.exit(0);
}

const { count: mensajes } = await db
  .from("conversation_messages")
  .delete({ count: "exact" })
  .eq("conversation_id", conv.id);

const { count: usos } = await db
  .from("bot_llm_usage")
  .delete({ count: "exact" })
  .eq("conversation_id", conv.id);

await db.from("conversations").delete().eq("id", conv.id);

console.log(`Listo. Borre ${mensajes ?? 0} mensajes, ${usos ?? 0} registros de uso y la conversacion.`);
console.log("El proximo mensaje arranca de cero.");
