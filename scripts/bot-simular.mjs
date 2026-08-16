// Corre un guion de mensajes contra el bot y muestra el dialogo completo.
//
// Probar desde el telefono es lento y no repetible: cada prueba arranca de un
// estado distinto y no se puede comparar el antes y el despues de un cambio.
// Esto arranca siempre de cero y muestra que contesto en cada paso.
//
// No manda nada a Telegram: un bot no puede escribir haciendose pasar por el
// cliente, asi que en el chat apareceria media conversacion (solo las respuestas)
// mezclada con las pruebas a mano. Con --enviar salen igual, si se quiere ver
// como se leen en el telefono.
//
// Uso: node --env-file=.env.local scripts/bot-simular.mjs [guion] [--enviar]
//      guiones: pedido (default) | precios | zona | confuso | reclamo

import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const GUIONES = {
  pedido: [
    "hola!",
    "queria pedir paltas",
    "2 cajas",
    "Av Libertador 2809, Capital Federal",
    "1",
    "departamento",
    "4B",
    "efectivo"
  ],
  // Pedido completo hasta el numero de pedido: cantidad, direccion, pago,
  // nombre, telefono, upsell y confirmacion. Es el guion que mide si el bot
  // cierra o si deriva a una persona en el ultimo paso.
  cierre: [
    "hola, queria 2 cajas de paltas",
    "Av Libertador 2809, Capital Federal",
    "1",
    "departamento",
    "4B",
    "efectivo",
    "Pepe Gonzalez",
    "11 5555 4444",
    "no gracias",
    "si, confirmo"
  ],
  precios: ["cuanto sale la caja?", "y la chica?", "tenes frutos secos?"],
  zona: ["hacen envios a Bariloche?", "y a San Isidro?", "cuando pasan por Belgrano?"],
  confuso: ["hola", "che", "mmm", "nada, gracias"],
  reclamo: ["las paltas vinieron golpeadas", "queria hacer un reclamo"]
};

// Por defecto no manda nada a Telegram: el bot no puede escribir haciendose
// pasar por el cliente, asi que en el chat solo apareceria media conversacion.
// Con --enviar salen los mensajes de Cande al telefono.
const enviarAlCanal = process.argv.includes("--enviar");
const guion = (process.argv[2] ?? "pedido").replace(/^--.*/, "") || "pedido";
const mensajes = GUIONES[guion];

if (!mensajes) {
  console.error(`Guion desconocido: ${guion}. Hay: ${Object.keys(GUIONES).join(", ")}`);
  process.exit(1);
}

// Thread propio, separado del chat real. Compartirlo con el telefono hacia que
// el poller inyectara mensajes de verdad en medio de la simulacion: dos clientes
// escribiendo a la vez sobre la misma conversacion, con resultados que parecian
// aleatorios y no lo eran.
const thread = process.env.BOT_SIMULACION_THREAD ?? "999000001";
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const destino = process.env.BOT_LOCAL_URL ?? "http://127.0.0.1:3000";

if (!secret) {
  console.error("Falta TELEGRAM_WEBHOOK_SECRET.");
  process.exit(1);
}

// Cada corrida arranca limpia: comparar dos versiones del bot solo tiene sentido
// si las dos empiezan del mismo estado.
const { data: previa } = await db
  .from("conversations")
  .select("id")
  .eq("channel", "telegram")
  .eq("channel_thread_id", thread)
  .maybeSingle();

if (previa) {
  await db.from("conversation_messages").delete().eq("conversation_id", previa.id);
  await db.from("bot_llm_usage").delete().eq("conversation_id", previa.id);
  await db.from("conversations").delete().eq("id", previa.id);
}

console.log(`Guion "${guion}", ${mensajes.length} mensajes\n`);

let mid = Date.now() % 100000;
const t0 = Date.now();

for (const texto of mensajes) {
  console.log(`  cliente: ${texto}`);

  const inicio = Date.now();
  await fetch(`${destino}/api/bot/telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-bot-api-secret-token": secret,
      ...(enviarAlCanal ? {} : { "x-bot-simulate": "1" })
    },
    body: JSON.stringify({
      update_id: ++mid,
      message: {
        message_id: ++mid,
        chat: { id: Number(thread), type: "private" },
        from: { id: Number(thread), is_bot: false, first_name: "Prueba" },
        date: Math.floor(Date.now() / 1000),
        text: texto
      }
    })
  }).catch((e) => console.log(`  ERROR: ${e.message}`));

  const { data: conv } = await db
    .from("conversations")
    .select("id, status, requires_human")
    .eq("channel", "telegram")
    .eq("channel_thread_id", thread)
    .maybeSingle();

  const { data: ultimas } = await db
    .from("conversation_messages")
    .select("body, direction, created_at")
    .eq("conversation_id", conv?.id ?? "")
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1);

  const respuesta = ultimas?.[0]?.body;
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

  console.log(respuesta ? `  Cande:   ${respuesta}  (${segundos}s)` : `  Cande:   [sin respuesta]  (${segundos}s)`);

  if (conv?.requires_human) {
    console.log(`\n  -> derivada a humano (${conv.status}), el resto del guion no se procesa`);
    break;
  }

  console.log();
}

const { data: final } = await db
  .from("conversations")
  .select("id, status, requires_human, draft_order")
  .eq("channel", "telegram")
  .eq("channel_thread_id", thread)
  .maybeSingle();

const { count: llamadas } = await db
  .from("bot_llm_usage")
  .select("*", { count: "exact", head: true })
  .eq("conversation_id", final?.id ?? "");

console.log(`\nestado final:  ${final?.status}${final?.requires_human ? " (derivada)" : ""}`);
console.log(`llamadas LLM:  ${llamadas ?? 0} en ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log(`datos guardados: ${JSON.stringify(final?.draft_order) ?? "ninguno"}`);
