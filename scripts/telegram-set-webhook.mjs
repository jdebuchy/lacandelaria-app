// Registra el webhook de Telegram contra la URL publica del tunel de desarrollo.
// Uso: node --env-file=.env.local scripts/telegram-set-webhook.mjs https://mi-tunel.trycloudflare.com

const [, , baseUrl] = process.argv;

if (!baseUrl) {
  console.error("Uso: node --env-file=.env.local scripts/telegram-set-webhook.mjs <url-publica>");
  process.exit(1);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || !secret) {
  console.error("Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET en .env.local.");
  process.exit(1);
}

const base = baseUrl.replace(/\/$/, "");

// Registrar el webhook contra una URL que no llega a la app deja al bot mudo sin
// ningun error visible: Telegram acepta cualquier URL que responda. Por eso primero
// confirmamos que del otro lado esta La Candelaria y no otro servicio del mismo equipo.
const salud = await fetch(`${base}/api/health`)
  .then((r) => r.text())
  .catch((e) => `ERROR ${e.message}`);

if (!salud.includes("La Candelaria")) {
  console.error(`La URL no responde como La Candelaria: ${salud.slice(0, 120)}`);
  console.error("Revisa que el tunel apunte al puerto del dev server y volve a intentar.");
  process.exit(1);
}

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: `${base}/api/bot/telegram`,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true
  })
});

console.log(JSON.stringify(await response.json(), null, 2));
