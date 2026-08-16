// Modo desarrollo sin tunel: en vez de que Telegram nos llame, le preguntamos
// nosotros por mensajes nuevos (long polling) y se los inyectamos al webhook local.
// Funciona detras de NAT, sin URL publica y sin re-registrar nada en cada sesion.
//
// Uso: node --env-file=.env.local scripts/telegram-poll.mjs
// Cortar con Ctrl+C. Para volver a webhook: scripts/telegram-set-webhook.mjs <url>

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const destino = process.env.BOT_LOCAL_URL ?? "http://127.0.0.1:3000";

if (!token || !secret) {
  console.error("Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET en .env.local.");
  process.exit(1);
}

const api = (metodo, body) =>
  fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {})
  }).then((r) => r.json());

const salud = await fetch(`${destino}/api/health`)
  .then((r) => r.text())
  .catch((e) => `ERROR ${e.message}`);

if (!salud.includes("La Candelaria")) {
  console.error(`${destino} no responde como La Candelaria: ${salud.slice(0, 100)}`);
  console.error("Levanta el dev server, o pasa el puerto con BOT_LOCAL_URL.");
  process.exit(1);
}

// getUpdates y el webhook son excluyentes: mientras haya webhook registrado,
// Telegram se guarda los mensajes para el y getUpdates devuelve un error.
const info = (await api("getWebhookInfo")).result ?? {};

if (info.url) {
  console.log(`Quitando el webhook (${info.url}) para poder hacer polling.`);
  await api("deleteWebhook", { drop_pending_updates: false });
}

const me = (await api("getMe")).result ?? {};
console.log(`Escuchando como ${me.first_name} (@${me.username}). Ctrl+C para cortar.\n`);

let offset = 0;
let cortando = false;

process.on("SIGINT", () => {
  cortando = true;
  console.log("\nCortando. El webhook quedo sin registrar: usa telegram-set-webhook.mjs cuando lo necesites.");
  process.exit(0);
});

while (!cortando) {
  let updates = [];

  try {
    const r = await api("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] });

    if (!r.ok) {
      console.error(`getUpdates fallo: ${r.description}`);
      continue;
    }

    updates = r.result ?? [];
  } catch (error) {
    console.error(`Error hablando con Telegram: ${error.message}`);
    continue;
  }

  for (const update of updates) {
    // El offset se avanza siempre, incluso si el motor falla: si no, un update
    // que rompe queda en un bucle infinito bloqueando todos los siguientes.
    offset = update.update_id + 1;

    const texto = update.message?.text;

    if (!texto) {
      continue;
    }

    const desde = update.message.from?.first_name ?? "?";
    const t0 = Date.now();

    try {
      const r = await fetch(`${destino}/api/bot/telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-telegram-bot-api-secret-token": secret },
        body: JSON.stringify(update)
      });
      const segundos = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[${desde}] "${texto.slice(0, 50)}" -> ${r.status} en ${segundos}s`);
    } catch (error) {
      console.error(`[${desde}] fallo al inyectar: ${error.message}`);
    }
  }
}
