export type ChannelId = "whatsapp" | "telegram";

export const BOT_INTENTS = [
  "satisfied",
  "complaint",
  "buy",
  "ask_price",
  "ask_delivery",
  "ask_products",
  "confirm_order",
  "modify_order",
  "cancel_order",
  "not_interested",
  "not_now",
  "opt_out",
  "unknown"
] as const;

export type BotIntent = (typeof BOT_INTENTS)[number];

export type InboundMessage = {
  channel: ChannelId;
  threadId: string;
  text: string;
  externalMessageId: string | null;
  senderName: string | null;
  raw: unknown;
  // Simulacion: procesa el mensaje y registra todo, pero no lo manda al canal.
  // Un bot no puede escribir haciendose pasar por el cliente, asi que sin esto
  // el chat de pruebas queda con respuestas sueltas, sin la pregunta que las
  // provoco, y encima mezcladas con las conversaciones de prueba a mano.
  simulated?: boolean;
};

export type OutboundMessage = {
  channel: ChannelId;
  threadId: string;
  body: string;
};

// Estado ya cargado desde la DB. El motor no hace IO: recibe esto y decide.
export type ConversationState = {
  id: string;
  channel: ChannelId;
  threadId: string;
  customerId: string | null;
  status: string;
  requiresHuman: boolean;
  botMutedUntil: string | null;
  offTopicStrikes: number;
  llmCallsToday: number;
  llmCallsDate: string | null;
  draftOrder: Record<string, unknown> | null;
  outboundLastHour: number;
  lastInboundText: string | null;
  lastInboundAt: string | null;
  optedOut: boolean;
};

export type GateDecision =
  | { action: "allow" }
  | { action: "ignore"; reason: string }
  | { action: "canned_reply"; reason: string; body: string; countsAsStrike: boolean }
  | { action: "handoff"; reason: string };

export type BotAnalysis = {
  intent: BotIntent;
  confidence: number;
  extracted: Record<string, unknown>;
  missingFields: string[];
  shouldHandoffToHuman: boolean;
  suggestedReply: string;
  canCreateOrder: boolean;
};

export type BotAction =
  | { type: "reply"; body: string; messageType: string; nextStatus: string }
  | { type: "confirm_draft"; body: string; draftOrder: Record<string, unknown> }
  | { type: "create_order"; body: string; confirmedPayload: Record<string, unknown> }
  | { type: "opt_out"; body: string }
  | { type: "handoff"; reason: string }
  | { type: "close"; nextStatus: string };
