// Configura el perfil publico de Cande (descripcion, "que puede hacer" y comandos)
// via API, para no ir comando por comando en BotFather.
// Uso: node --env-file=.env.local scripts/telegram-setup-profile.mjs

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("Falta TELEGRAM_BOT_TOKEN en .env.local.");
  process.exit(1);
}

// La descripcion corta aparece en la ficha del bot; la larga, en la pantalla
// vacia antes del primer mensaje, que es donde el cliente decide si escribe.
const SHORT_DESCRIPTION = "Asistente de Paltas La Candelaria. Tomo tu pedido de paltas premium.";

const DESCRIPTION = `Hola! Soy Cande, el asistente de Paltas La Candelaria.

Por aca te tomo el pedido de cajas de paltas premium de 4 kg: cantidades, direccion y forma de pago.

Soy un asistente automatico. Si necesitas algo que no puedo resolver, te paso con alguien del equipo.`;

const COMMANDS = [
  { command: "pedido", description: "Empezar un pedido de paltas" },
  { command: "ayuda", description: "Ver que puedo hacer" },
  { command: "humano", description: "Hablar con alguien del equipo" },
  { command: "baja", description: "Dejar de recibir mensajes" }
];

async function call(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const payload = await response.json();
  console.log(`${method.padEnd(22)} ${payload.ok ? "ok" : "ERROR: " + payload.description}`);
  return payload.ok;
}

const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json());

if (!me.ok) {
  console.error(`El token no es valido: ${me.description}`);
  process.exit(1);
}

console.log(`Bot: ${me.result.first_name} (@${me.result.username})\n`);

await call("setMyShortDescription", { short_description: SHORT_DESCRIPTION });
await call("setMyDescription", { description: DESCRIPTION });
await call("setMyCommands", { commands: COMMANDS });

console.log("\nListo. Los comandos todavia no estan implementados en el motor:");
console.log("por ahora Cande responde a texto libre y los ignora como mensajes normales.");
