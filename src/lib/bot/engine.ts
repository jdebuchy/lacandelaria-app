import { canHandleIntent, type BotCapabilities } from "./capabilities";
import type { BotAction, BotAnalysis, ConversationState } from "./types";

export const ENGINE_DEFAULTS = {
  minConfidence: 0.75
};

// Un reclamo va a una persona siempre: no depende de tener datos, sino de que
// alguien se haga cargo.
const ALWAYS_HANDOFF = new Set(["complaint"]);

// Estos dependen del ERP. Se derivan solo si el contexto comercial no alcanza
// para contestarlos; con el catalogo y las zonas cargadas, el bot los resuelve.
const CONTEXT_DEPENDENT = new Set(["ask_price", "ask_delivery", "ask_products"]);

const CLOSING_INTENTS = new Set(["not_interested", "not_now", "cancel_order"]);

const OPT_OUT_BODY = "Listo, ya registramos tu baja para no enviarte más mensajes.";
const ORDER_CREATED_BODY =
  "Tu pedido quedó registrado. Te vamos a contactar si necesitamos coordinar algún detalle.";
const DEFAULT_REPLY = "Gracias por responder. Te seguimos por acá si necesitás algo.";

export type RepeatOrder = {
  payload: Record<string, unknown>;
  summary: { items: string; address: string; paymentMethod: string };
};

export type EngineInput = {
  analysis: BotAnalysis;
  conversation: ConversationState;
  repeatOrder: RepeatOrder | null;
  capabilities: BotCapabilities;
  minConfidence: number;
};

export function shouldHandoff(
  analysis: BotAnalysis,
  minConfidence: number,
  capabilities: BotCapabilities
) {
  if (analysis.shouldHandoffToHuman || analysis.confidence < minConfidence) {
    return true;
  }

  if (ALWAYS_HANDOFF.has(analysis.intent)) {
    return true;
  }

  return CONTEXT_DEPENDENT.has(analysis.intent) && !canHandleIntent(analysis.intent, capabilities);
}

export function decideNextAction(input: EngineInput): BotAction {
  const { analysis, conversation, repeatOrder } = input;

  if (analysis.intent === "opt_out") {
    return { type: "opt_out", body: OPT_OUT_BODY };
  }

  if (shouldHandoff(analysis, input.minConfidence, input.capabilities)) {
    const reason =
      ALWAYS_HANDOFF.has(analysis.intent) || CONTEXT_DEPENDENT.has(analysis.intent)
        ? analysis.intent
        : analysis.shouldHandoffToHuman
          ? "model_requested"
          : "low_confidence";
    return { type: "handoff", reason };
  }

  if (CLOSING_INTENTS.has(analysis.intent)) {
    return { type: "close", nextStatus: "closed" };
  }

  const draftOrder = conversation.draftOrder ?? {};

  if (analysis.intent === "confirm_order") {
    const confirmedPayload = draftOrder.confirmed_payload as Record<string, unknown> | undefined;

    if (!confirmedPayload) {
      return { type: "handoff", reason: "confirm_without_draft" };
    }

    return { type: "create_order", body: ORDER_CREATED_BODY, confirmedPayload };
  }

  if (analysis.intent === "buy" && repeatOrder) {
    const body = [
      "Te puedo repetir el ultimo pedido:",
      "",
      repeatOrder.summary.items,
      `Direccion: ${repeatOrder.summary.address}`,
      `Pago: ${repeatOrder.summary.paymentMethod}`,
      "",
      "Confirmas que registre este pedido?"
    ].join("\n");

    return {
      type: "confirm_draft",
      body,
      draftOrder: {
        ...draftOrder,
        confirmed_payload: repeatOrder.payload,
        summary: repeatOrder.summary
      }
    };
  }

  return {
    type: "reply",
    body: analysis.suggestedReply || DEFAULT_REPLY,
    messageType: "transactional_reply",
    nextStatus: analysis.intent === "buy" ? "collecting_order_data" : "satisfaction_answered"
  };
}
