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
    "Hola! Soy Cande, de Paltas La Candelaria. Todavia estoy en pruebas por aca. Escribinos por WhatsApp y te atendemos.",
  offTopic:
    "Soy Cande, de Paltas La Candelaria. Por aca te ayudo con pedidos de paltas: precios, cantidades y entregas. Contame que necesitas.",
  budgetExhausted: "Recibimos tus mensajes. En un rato te contesta alguien del equipo.",
  greeting: "Hola! Soy Cande, de Paltas La Candelaria. Contame que necesitas y te ayudo con tu pedido."
};

// Un saludo pelado no le da al modelo con que trabajar: devuelve baja confianza
// y eso derivaba la conversacion a humano en el primer mensaje. Como casi toda
// conversacion real arranca con "hola", lo contestamos nosotros y esperamos.
const GREETINGS = new Set([
  "hola", "holaa", "holaaa", "buenas", "buen", "buenos", "dia", "dias", "tarde",
  "tardes", "noche", "noches", "hey", "ey", "que", "tal", "como", "estas", "andas",
  "saludos", "hi", "hello", "ola", "holis", "buenass"
]);

export function isGreetingOnly(text: string) {
  const words = normalize(text).split(/[^a-z0-9]+/).filter(Boolean);

  return words.length > 0 && words.length <= 4 && words.every((word) => GREETINGS.has(word));
}

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

function normalize(text: string) {
  // Los combining marks van escapados: escritos literales, un editor o un
  // copy-paste los reordena y el regex deja de matchear sin que nadie lo note.
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function hasDomainSignal(text: string) {
  const words = normalize(text).split(/[^a-z0-9]+/).filter(Boolean);
  return words.some((word) => DOMAIN_LEXICON_SET.has(word));
}

function isBlank(text: string) {
  // Sin letras ni digitos no hay nada que interpretar: emojis, puntuacion, vacio.
  return !/[\p{L}\p{N}]/u.test(text);
}

function hasOrderInProgress(conversation: ConversationState | null) {
  if (!conversation) {
    return false;
  }

  if (ORDER_IN_PROGRESS_STATUSES.has(conversation.status)) {
    return true;
  }

  return Boolean(conversation.draftOrder && Object.keys(conversation.draftOrder).length > 0);
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

  if (hasOrderInProgress(conversation)) {
    return { action: "allow" };
  }

  // Va antes del chequeo de dominio: "hola" no tiene palabras del negocio, pero
  // tampoco es off topic, y mandarlo al modelo terminaba derivando a humano.
  if (isGreetingOnly(text)) {
    return {
      action: "canned_reply",
      reason: "greeting",
      body: CANNED_REPLIES.greeting,
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
