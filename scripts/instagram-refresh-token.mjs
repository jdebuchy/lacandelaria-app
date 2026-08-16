// Refresca el token de larga duracion de Instagram y avisa cuando le queda poco.
//
// Los tokens IGAA duran 60 dias. El anterior vencio el 06-08-2026 sin que nadie
// lo renovara y la ingesta de DMs se corto en silencio: no hay error visible,
// simplemente dejan de entrar mensajes. Correr esto cada 30 dias (o desde un cron)
// evita que vuelva a pasar.
//
// Importante: solo se puede refrescar un token VIVO. Si ya vencio, hay que
// generar uno nuevo a mano desde el panel de Meta:
//   developers.facebook.com/apps -> Instagram -> API setup with Instagram login
//
// Uso: node --env-file=.env.local scripts/instagram-refresh-token.mjs

import { writeFileSync } from "node:fs";

const token = process.env.META_PAGE_ACCESS_TOKEN;

if (!token) {
  console.error("Falta META_PAGE_ACCESS_TOKEN.");
  process.exit(1);
}

if (!token.startsWith("IGAA")) {
  console.error("El token no parece de Instagram Login (deberia empezar con IGAA).");
  console.error("Si empieza con EAA es un Page Access Token de Facebook y va por otra API.");
  process.exit(1);
}

const estado = await fetch(
  `https://graph.instagram.com/v23.0/me?fields=id,username&access_token=${token}`
).then((r) => r.json());

if (estado.error) {
  console.error(`El token actual no sirve: ${estado.error.message}`);
  console.error("\nGenera uno nuevo en:");
  console.error("  developers.facebook.com/apps -> tu app -> Instagram -> API setup with Instagram login");
  console.error("  seccion 'Generate access tokens', boton al lado de la cuenta");
  process.exit(1);
}

console.log(`Token valido para @${estado.username} (${estado.id}).`);

const refrescado = await fetch(
  `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`
).then((r) => r.json());

if (refrescado.error) {
  console.error(`No pude refrescarlo: ${refrescado.error.message}`);
  process.exit(1);
}

const dias = Math.round((refrescado.expires_in ?? 0) / 86400);
const vence = new Date(Date.now() + (refrescado.expires_in ?? 0) * 1000);

console.log(`\nToken nuevo, vence en ${dias} dias (${vence.toLocaleDateString("es-AR")}).`);

// El token va a un archivo gitignoreado, no a stdout: la salida de una terminal
// termina en logs, en el historial y en transcripts de agentes. Un secreto
// impreso hay que tratarlo como filtrado.
const destino = ".tmp-instagram-token.txt";
writeFileSync(destino, `META_PAGE_ACCESS_TOKEN="${refrescado.access_token}"\n`);

console.log(`\nEscrito en ${destino} (gitignoreado).`);
console.log("Copialo a .env.local y a Railway, y despues borra ese archivo.");
console.log("\nVolve a correr esto antes de esa fecha, o la ingesta se corta sin avisar.");
