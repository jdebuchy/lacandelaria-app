// Devuelve el control a Cande en una conversacion que quedo en needs_human o
// silenciada por strikes. Sin esto la unica salida es editar la base a mano, y
// mientras tanto el cliente le escribe a un fantasma.
//
// Uso: node --env-file=.env.local scripts/bot-resume.mjs            (lista las trabadas)
//      node --env-file=.env.local scripts/bot-resume.mjs <threadId> (destraba una)
//      node --env-file=.env.local scripts/bot-resume.mjs --todas

import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const arg = process.argv[2];

const { data: trabadas, error } = await db
  .from("conversations")
  .select("id, channel, channel_thread_id, status, requires_human, bot_muted_until, off_topic_strikes")
  .or("requires_human.eq.true,bot_muted_until.not.is.null");

if (error) {
  console.error(`No pude leer las conversaciones: ${error.message}`);
  process.exit(1);
}

if (!trabadas?.length) {
  console.log("No hay conversaciones trabadas.");
  process.exit(0);
}

if (!arg) {
  console.log("Conversaciones trabadas:\n");
  for (const c of trabadas) {
    const motivo = c.requires_human ? "needs_human" : `silenciada hasta ${c.bot_muted_until}`;
    console.log(`  ${c.channel}/${c.channel_thread_id}  ${motivo}  (strikes: ${c.off_topic_strikes})`);
  }
  console.log("\nPara destrabar: scripts/bot-resume.mjs <threadId>   o   --todas");
  process.exit(0);
}

const objetivo = arg === "--todas" ? trabadas : trabadas.filter((c) => c.channel_thread_id === arg);

if (!objetivo.length) {
  console.error(`No encontre una conversacion trabada con thread id ${arg}.`);
  process.exit(1);
}

for (const c of objetivo) {
  const { error: updateError } = await db
    .from("conversations")
    .update({
      requires_human: false,
      status: "idle",
      bot_muted_until: null,
      off_topic_strikes: 0,
      updated_at: new Date().toISOString()
    })
    .eq("id", c.id);

  console.log(
    updateError
      ? `  FALLA ${c.channel}/${c.channel_thread_id}: ${updateError.message}`
      : `  ok    ${c.channel}/${c.channel_thread_id} devuelta a Cande`
  );
}
