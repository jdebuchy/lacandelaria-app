// Trae las conversaciones de Instagram con la Graph API (inbound Y outbound) y
// las exporta anonimizadas, para destilar de ahi el tono con el que responde el
// equipo. Las tablas instagram_* solo tienen mensajes entrantes, porque el worker
// descarta los echoes: el tono esta justamente en las respuestas que faltan.
//
// Escribe a un .tmp-*.json (gitignoreado) en vez de tocar la base: el repo es
// publico y esto son conversaciones de clientes reales.
//
// Uso: node --env-file=.env.local scripts/instagram-export-conversations.mjs [--crudo]
//      --crudo exporta sin anonimizar (para revisar; nunca lo commitees)

import { writeFileSync } from "node:fs";

const token = process.env.META_PAGE_ACCESS_TOKEN;
const V = "v23.0";
const anonimizar = !process.argv.includes("--crudo");

if (!token) {
  console.error("Falta META_PAGE_ACCESS_TOKEN.");
  process.exit(1);
}

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
  console.error("Corre scripts/instagram-refresh-token.mjs o genera uno nuevo en el panel de Meta.");
  process.exit(1);
}

console.log(`Cuenta: @${yo.username} (${yo.id})\n`);

// Ninguna anonimizacion por regex es completa. Esto saca lo evidente; la revision
// final la tiene que hacer una persona antes de que estos textos vayan a ningun lado.
function limpiar(texto, nombreCliente) {
  if (!anonimizar || !texto) {
    return texto ?? "";
  }

  let t = texto;

  if (nombreCliente) {
    t = t.replaceAll(new RegExp(nombreCliente.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[cliente]");
  }

  return t
    .replace(/@[A-Za-z0-9._]{2,}/g, "[usuario]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/(?:\+?54\s?)?(?:9\s?)?(?:11|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{4}/g, "[telefono]")
    .replace(/\b(?:calle|av\.?|avenida|ruta)\s+[^\n,.]{3,40}/gi, "[direccion]")
    .replace(/\b\d{1,5}\s?(?:piso|depto|dpto|timbre)\b[^\n,.]{0,20}/gi, "[direccion]");
}

// Tope de paginas: si la API devuelve un `next` que nunca se agota, el loop se
// come la cuenta de rate limit sin que nadie se entere. Subilo si hace falta.
const MAX_PAGINAS = Number(process.env.IG_MAX_PAGINAS ?? 10);

const sufijo = anonimizar ? "anon" : "crudo";
const jsonPath = `.tmp-instagram-${sufijo}.json`;
const txtPath = `.tmp-instagram-${sufijo}.txt`;

const conversaciones = [];
let paginas = 0;

function guardar() {
  writeFileSync(jsonPath, JSON.stringify(conversaciones, null, 2));

  const legible = conversaciones
    .map(
      (c) =>
        `--- ${c.id} (${c.actualizada?.slice(0, 10)}) ---\n` +
        c.mensajes.map((m) => `${m.de === "equipo" ? "EQUIPO " : "cliente"}: ${m.texto}`).join("\n")
    )
    .join("\n\n");

  writeFileSync(txtPath, legible);
}
let pagina = await g("me/conversations", { fields: "id,updated_time", limit: "50" });

if (pagina.error) {
  console.error(`No pude listar conversaciones: ${pagina.error.message}`);
  console.error("Revisa que la app tenga instagram_business_manage_messages.");
  process.exit(1);
}

while (pagina?.data?.length && paginas < MAX_PAGINAS) {
  paginas++;
  console.log(`pagina ${paginas}: ${pagina.data.length} conversaciones`);

  for (const conv of pagina.data) {
    const detalle = await g(conv.id, {
      fields: "messages.limit(100){id,from,to,message,created_time}"
    });

    const mensajes = (detalle.messages?.data ?? [])
      .filter((m) => m.message)
      .reverse();

    if (!mensajes.length) {
      continue;
    }

    const cliente = mensajes.find((m) => m.from?.id !== IGID)?.from;

    conversaciones.push({
      id: anonimizar ? `conv_${conversaciones.length + 1}` : conv.id,
      actualizada: conv.updated_time,
      cliente: anonimizar ? "[cliente]" : (cliente?.username ?? cliente?.id ?? "?"),
      mensajes: mensajes.map((m) => ({
        de: m.from?.id === IGID ? "equipo" : "cliente",
        texto: limpiar(m.message, anonimizar ? cliente?.username : null),
        fecha: m.created_time
      }))
    });

    // Una linea cada 10, no un \r: corriendo en background el retorno de carro
    // nunca se vuelca al log y parece que el script murio.
    if (conversaciones.length % 10 === 0) {
      console.log(`  ${conversaciones.length} conversaciones, ${conversaciones.reduce((n, c) => n + c.mensajes.length, 0)} mensajes`);
    }
  }

  // Guardado al cierre de cada pagina: la corrida anterior se corto a los 10
  // minutos sin haber escrito un solo byte y se perdio todo. Mejor tener las
  // primeras 50 conversaciones en disco que 500 en memoria.
  guardar();
  console.log(`  guardado parcial: ${conversaciones.length} conversaciones en disco`);

  pagina = pagina.paging?.next ? await fetch(pagina.paging.next).then((r) => r.json()) : null;
}

if (paginas >= MAX_PAGINAS && pagina?.data?.length) {
  console.log(`\nCorte en ${MAX_PAGINAS} paginas. Sube IG_MAX_PAGINAS si necesitas mas.`);
}

const salientes = conversaciones.flatMap((c) => c.mensajes).filter((m) => m.de === "equipo");
const entrantes = conversaciones.flatMap((c) => c.mensajes).filter((m) => m.de === "cliente");

console.log(`\n\n${conversaciones.length} conversaciones`);
console.log(`  ${entrantes.length} mensajes de clientes`);
console.log(`  ${salientes.length} respuestas del equipo  <- el tono esta aca`);

guardar();

console.log(`\nEscrito:\n  ${jsonPath}\n  ${txtPath}  <- lee este para revisar la anonimizacion`);

if (anonimizar) {
  console.log("\nRevisa el .txt antes de usarlo: ningun regex atrapa todo.");
}
