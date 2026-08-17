import { estadoDelDraft, hydrateOrderDraft } from "./order-draft";
import { mensajeParaRetomar } from "./summary";
import { isGreetingOnly, normalizar as normalize, palabrasDe } from "./text";
import type { ConversationState, GateDecision } from "./types";

export const GATE_DEFAULTS = {
  // Defensa contra bucles, no contra clientes activos. Estaba en 5, heredado del
  // worker de WhatsApp, donde protegia del baneo de whatsapp-web.js y no del
  // costo. Coordinar un pedido real (cantidad, direccion, horario, pago) pasa
  // cinco intercambios facil, y al pasarse la conversacion quedaba escalada a
  // humano en la mitad de la compra.
  maxAutoRepliesPerHour: 20,
  maxLlmCallsPerDay: 30,
  maxTextLength: 1500,
  maxStrikes: 3,
  // Ventana corta a proposito. La idempotencia real la da el indice unico sobre
  // external_message_id; esto solo ataja el doble toque accidental. Con 120s,
  // un cliente que saluda dos veces porque no le contestaron quedaba ignorado,
  // que es exactamente lo peor que se le puede hacer a alguien que ya espera.
  // Del cliente impaciente se ocupa el limite de respuestas por hora, no esto.
  duplicateWindowSeconds: 15
};

// Estas respuestas salen sin pasar por el modelo, asi que llevan la voz de Cande
// escrita a mano: son las unicas que el cliente puede recibir con el LLM apagado.
export const CANNED_REPLIES = {
  notAllowed:
    "Hola! Soy Cande, de Paltas La Candelaria. Todavía estoy en pruebas por acá. Escribinos por WhatsApp y te atendemos.",
  offTopic:
    "Soy Cande, de Paltas La Candelaria. Por acá te ayudo con pedidos de paltas: precios, cantidades y entregas. Contame qué necesitás.",
  budgetExhausted: "Recibimos tus mensajes. En un rato te contesta alguien del equipo.",
  greeting: "Hola! Soy Cande, de Paltas La Candelaria. Contame qué necesitás y te ayudo con tu pedido."
};

// Saludar por el nombre es la regla que mas separa al equipo de un bot, medida
// sobre 1104 respuestas reales. El saludo es la unica respuesta que sale sin
// pasar por el modelo, asi que si no la aplica aca, no la aplica en ningun lado.
//
// Y si el cliente dejo un pedido a medias hace mas de un dia, el saludo es el
// momento de ofrecerlo. Sale igual de barato: el texto es deterministico, no lo
// redacta el modelo.
export function buildGreeting(conversation: ConversationState | null, now: string) {
  const draft = hydrateOrderDraft(conversation?.draftOrder);

  if (estadoDelDraft(draft, now) === "sugerencia") {
    return mensajeParaRetomar(draft, "sugerencia");
  }

  return draft.nombre
    ? `Hola ${draft.nombre}! Contame qué necesitás y te ayudo con tu pedido.`
    : CANNED_REPLIES.greeting;
}

// Se reexporta porque los tests del gate y varios llamadores lo usan desde aca
// desde antes de que la forma del mensaje viviera en su propio modulo.
export { isGreetingOnly };

// Estados en los que el cliente esta armando un pedido: ahi cualquier texto es
// relevante (una direccion, un horario, un "dale") y no puede frenarlo el lexico.
const ORDER_IN_PROGRESS_STATUSES = new Set([
  "collecting_order_data",
  "waiting_for_confirmation",
  "interested_in_buying"
]);

const DOMAIN_LEXICON = [
  "palta", "paltas", "cajon", "cajones", "caja", "cajas", "kilo", "kilos", "kg",
  "precio", "precios", "cuanto", "cuestan", "cuesta", "sale", "salen", "vale", "valen",
  "pedido", "pedidos", "pedir", "encargar", "encargo", "comprar", "compra", "quiero",
  "entrega", "entregan", "envio", "envios", "reparto", "llega", "llegan", "traer",
  "efectivo", "transferencia", "pago", "pagar", "plata",
  "candelaria", "premium", "maduras", "madura", "verde", "verdes",
  "stock", "hay", "zona", "direccion", "domicilio", "horario"
];

const DOMAIN_LEXICON_SET = new Set(DOMAIN_LEXICON);

export function hasDomainSignal(text: string) {
  return palabrasDe(text).some((word) => DOMAIN_LEXICON_SET.has(word));
}

function isBlank(text: string) {
  // Sin letras ni digitos no hay nada que interpretar: emojis, puntuacion, vacio.
  return !/[\p{L}\p{N}]/u.test(text);
}

// "En curso" tiene fecha de vencimiento. Antes bastaba con que draft_order no
// estuviera vacio, asi que un "hola" sobre un pedido de la semana pasada saltaba
// el saludo y se iba derecho al modelo, como si la charla nunca se hubiera
// cortado.
function hasOrderInProgress(conversation: ConversationState | null, now: string) {
  if (!conversation) {
    return false;
  }

  const estado = estadoDelDraft(hydrateOrderDraft(conversation.draftOrder), now);

  if (estado === "activo" || estado === "dormido") {
    return true;
  }

  // El status por si solo no alcanza cuando el draft ya es una sugerencia: una
  // conversacion vieja se queda en collecting_order_data para siempre.
  return estado !== "sugerencia" && ORDER_IN_PROGRESS_STATUSES.has(conversation.status);
}

function secondsBetween(from: string, to: string) {
  return (new Date(to).getTime() - new Date(from).getTime()) / 1000;
}

export type GateInput = {
  now: string;
  threadId: string;
  text: string;
  conversation: ConversationState | null;
  allowedThreadIds: string[];
  maxAutoRepliesPerHour: number;
  maxLlmCallsPerDay: number;
  maxTextLength: number;
  maxStrikes: number;
  duplicateWindowSeconds: number;
};

export function evaluateGate(input: GateInput): GateDecision {
  const { conversation, now, text } = input;

  // Una allowlist vacia significa produccion: no filtra a nadie.
  if (input.allowedThreadIds.length > 0 && !input.allowedThreadIds.includes(input.threadId)) {
    return {
      action: "canned_reply",
      reason: "not_allowed",
      body: CANNED_REPLIES.notAllowed,
      countsAsStrike: false
    };
  }

  if (isBlank(text)) {
    return { action: "ignore", reason: "empty" };
  }

  if (conversation) {
    if (conversation.optedOut) {
      return { action: "ignore", reason: "opted_out" };
    }

    if (
      conversation.botMutedUntil &&
      new Date(conversation.botMutedUntil).getTime() > new Date(now).getTime()
    ) {
      return { action: "ignore", reason: "muted" };
    }

    if (conversation.requiresHuman) {
      return { action: "ignore", reason: "needs_human" };
    }

    if (conversation.outboundLastHour >= input.maxAutoRepliesPerHour) {
      return { action: "handoff", reason: "rate_limited" };
    }

    const budgetDate = now.slice(0, 10);
    const spentToday = conversation.llmCallsDate === budgetDate ? conversation.llmCallsToday : 0;

    if (spentToday >= input.maxLlmCallsPerDay) {
      return {
        action: "canned_reply",
        reason: "budget_exhausted",
        body: CANNED_REPLIES.budgetExhausted,
        countsAsStrike: false
      };
    }

    if (
      conversation.lastInboundText &&
      conversation.lastInboundAt &&
      normalize(conversation.lastInboundText) === normalize(text) &&
      secondsBetween(conversation.lastInboundAt, now) <= input.duplicateWindowSeconds
    ) {
      return { action: "ignore", reason: "duplicate" };
    }
  }

  if (hasOrderInProgress(conversation, now)) {
    return { action: "allow" };
  }

  // Va antes del chequeo de dominio: "hola" no tiene palabras del negocio, pero
  // tampoco es off topic, y mandarlo al modelo terminaba derivando a humano.
  if (isGreetingOnly(text)) {
    return {
      action: "canned_reply",
      reason: "greeting",
      body: buildGreeting(conversation, now),
      countsAsStrike: false
    };
  }

  // El filtro por vocabulario se saco a proposito. Sobre 343 mensajes reales de
  // clientes, marcaba como fuera de tema al 63%: "De una", "Gracias",
  // "Todo buenos aires?" y cualquiera coordinando una entrega. El gasto lo
  // contienen el limite por hora y el presupuesto diario, que son medidas que no
  // dependen de adivinar de que esta hablando la persona.
  return { action: "allow" };
}

export function truncateForLlm(text: string, maxTextLength: number) {
  return text.length <= maxTextLength ? text : text.slice(0, maxTextLength);
}
