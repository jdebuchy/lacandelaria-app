import { botConfig } from "@/lib/config";
import { getPlaceAutocompleteSuggestions, getPlaceDetails } from "@/lib/google-places";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ANALYSIS_JSON_SCHEMA,
  buildAnalysisPrompt,
  buildSystemPrompt,
  parseAnalysis
} from "./analyze";
import {
  EMPTY_ADDRESS_DRAFT,
  buildAddressQuestion,
  nextAddressGap,
  pickSuggestion,
  type AddressDraft
} from "./address";
import { deriveCapabilities } from "./capabilities";
import { telegramAdapter } from "./channels/telegram";
import type { ChannelAdapter } from "./channels/types";
import {
  bumpOffTopicStrike,
  countLlmCall,
  ensureConversation,
  loadCommercialContext,
  loadConversationState,
  loadRecentMessages,
  loadToneGuide,
  markCustomerOptOut,
  markNeedsHuman,
  recordInbound,
  recordLlmUsage,
  recordOutbound,
  resetOffTopicStrikes,
  updateConversationStatus
} from "./conversations";
import { ENGINE_DEFAULTS, decideNextAction } from "./engine";
import { GATE_DEFAULTS, evaluateGate, truncateForLlm } from "./gate";
import { getLlmProvider } from "./llm";
import type { InboundMessage } from "./types";

const MUTE_HOURS_AFTER_STRIKES = 12;

const ADAPTERS: Record<string, ChannelAdapter> = {
  telegram: telegramAdapter
};

// Mantiene el "escribiendo..." vivo mientras corre el modelo, que tarda mucho mas
// que los 5 segundos que dura el indicador. Devuelve la funcion para cortarlo.
function keepTyping(adapter: ChannelAdapter, threadId: string) {
  if (!adapter.sendTyping) {
    return () => {};
  }

  const enviar = () => {
    // Si el indicador falla no pasa nada: es cosmetico y no puede tumbar el turno.
    adapter.sendTyping?.(threadId).catch(() => {});
  };

  enviar();
  const timer = setInterval(enviar, 4000);

  return () => clearInterval(timer);
}

// Resuelve la direccion contra Google solo cuando hace falta: si el cliente
// escribio algo que Places identifica sin dudas, se acepta callado. Cada consulta
// se factura, y preguntar de mas en un chat cansa.
async function resolverDireccion(draft: AddressDraft, texto: string): Promise<AddressDraft> {
  const sugerencias = await getPlaceAutocompleteSuggestions(texto).catch(() => []);
  const elegida = pickSuggestion(texto, sugerencias);

  if (elegida.tipo !== "clara") {
    return { ...draft, texto, intentos: draft.intentos + 1 };
  }

  const detalle = await getPlaceDetails(elegida.sugerencia.placeId).catch(() => null);

  if (!detalle) {
    return { ...draft, texto, intentos: draft.intentos + 1 };
  }

  return {
    ...draft,
    texto,
    googlePlaceId: detalle.googlePlaceId,
    etiqueta: detalle.displayLabel,
    addressKind: detalle.suggestedAddressKind,
    gatedCommunityName: detalle.gatedCommunityName || draft.gatedCommunityName
  };
}

// El aviso lo lee una persona en el telefono, no un log: motivo en castellano,
// sin ids crudos ni payloads. Lo que hace falta para decidir si abrir el panel.
const MOTIVOS: Record<string, string> = {
  complaint: "un reclamo",
  ask_price: "una consulta de precios",
  ask_delivery: "una consulta de entrega",
  ask_products: "una consulta de catalogo",
  low_confidence: "un mensaje que no entendio",
  model_requested: "un caso que prefiere no resolver solo",
  rate_limited: "demasiados mensajes seguidos",
  confirm_without_draft: "una confirmacion sin pedido armado",
  order_ready: "un pedido listo para cargar"
};

// Lo unico que ve el cliente al derivar. Sin motivos ni jerga interna: saber que
// el bot "no entendio" o que hubo "demasiados mensajes" no le sirve de nada y
// suena a maquina rota. Solo necesita saber que alguien lo va a atender.
const DESPEDIDA_HANDOFF = "dale, ya le paso tu mensaje al equipo y te contactan en un rato";

async function avisarAlCliente(
  supabase: ReturnType<typeof createAdminClient>,
  adapter: ChannelAdapter,
  inbound: InboundMessage,
  conversationId: string,
  now: string
) {
  await adapter.send(inbound.threadId, DESPEDIDA_HANDOFF);
  await recordOutbound(
    supabase,
    conversationId,
    inbound.channel,
    DESPEDIDA_HANDOFF,
    "human_handoff",
    now
  );
}

function avisoDeHandoff(motivo: string, quien: string | null, ultimoMensaje: string) {
  const razon = MOTIVOS[motivo] ?? "algo que no pudo resolver";
  const nombre = quien ? ` de ${quien}` : "";

  return `Cande te paso una conversacion${nombre}: ${razon}.\n\n"${ultimoMensaje.slice(0, 140)}"`;
}

async function notifyAdmin(text: string) {
  if (!botConfig.telegramAdminChatId) {
    return;
  }

  try {
    await telegramAdapter.send(botConfig.telegramAdminChatId, text);
  } catch {
    // Un aviso perdido no puede tumbar el manejo del mensaje del cliente.
  }
}

export async function handleInboundMessage(inbound: InboundMessage) {
  const adapter = ADAPTERS[inbound.channel];

  if (!adapter) {
    throw new Error(`Canal sin adaptador: ${inbound.channel}`);
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const isTest = botConfig.telegramAllowedChatIds.length > 0;

  const existing = await loadConversationState(supabase, inbound.channel, inbound.threadId, now);

  const gate = evaluateGate({
    now,
    threadId: inbound.threadId,
    text: inbound.text,
    conversation: existing,
    allowedThreadIds: inbound.channel === "telegram" ? botConfig.telegramAllowedChatIds : [],
    ...GATE_DEFAULTS
  });

  // La allowlist corta antes de escribir nada: un desconocido no deja rastro
  // en la base ni consume presupuesto.
  if (gate.action === "canned_reply" && gate.reason === "not_allowed") {
    await adapter.send(inbound.threadId, gate.body);
    return;
  }

  const conversationId = existing?.id ?? (await ensureConversation(supabase, inbound, now, isTest));
  const isNew = await recordInbound(supabase, conversationId, inbound, now);

  if (!isNew) {
    return;
  }

  if (gate.action === "ignore") {
    return;
  }

  if (gate.action === "handoff") {
    await markNeedsHuman(supabase, conversationId, gate.reason, now);
    await avisarAlCliente(supabase, adapter, inbound, conversationId, now);
    await notifyAdmin(avisoDeHandoff(gate.reason, inbound.senderName, inbound.text));
    return;
  }

  if (gate.action === "canned_reply") {
    await adapter.send(inbound.threadId, gate.body);
    await recordOutbound(supabase, conversationId, inbound.channel, gate.body, "canned_reply", now);

    if (gate.countsAsStrike && existing) {
      await bumpOffTopicStrike(
        supabase,
        existing,
        now,
        GATE_DEFAULTS.maxStrikes,
        MUTE_HOURS_AFTER_STRIKES
      );
    }

    return;
  }

  const conversation =
    existing ?? (await loadConversationState(supabase, inbound.channel, inbound.threadId, now));

  if (!conversation) {
    throw new Error("La conversacion desaparecio entre el insert y la lectura.");
  }

  const [commercialContext, recentMessages, toneGuide] = await Promise.all([
    loadCommercialContext(supabase),
    loadRecentMessages(supabase, conversationId),
    loadToneGuide(supabase)
  ]);

  const provider = getLlmProvider();
  const dejarDeEscribir = keepTyping(adapter, inbound.threadId);

  let result;

  try {
    result = await provider.complete({
      system: buildSystemPrompt(toneGuide),
      user: buildAnalysisPrompt({
        commercialContext,
        conversationStatus: conversation.status,
        messageBody: truncateForLlm(inbound.text, GATE_DEFAULTS.maxTextLength),
        recentMessages
      }),
      maxTokens: botConfig.llmMaxTokens,
      jsonSchema: ANALYSIS_JSON_SCHEMA as unknown as Record<string, unknown>
    });
  } finally {
    dejarDeEscribir();
  }

  await Promise.all([
    countLlmCall(supabase, conversation, now),
    recordLlmUsage(supabase, conversationId, result)
  ]);

  const analysis = parseAnalysis(result.text);

  // Recoleccion de direccion. Corre antes del motor y solo cuando el modelo
  // extrajo algo: si hay un dato pendiente, la pregunta por ese dato le gana a
  // la respuesta generica del modelo, que tiende a pedir todo junto.
  const draftPrevio = (conversation.draftOrder?.direccion as AddressDraft | undefined) ?? EMPTY_ADDRESS_DRAFT;
  const direccionDicha = typeof analysis.extracted.delivery_address === "string"
    ? analysis.extracted.delivery_address.trim()
    : "";

  let direccion = draftPrevio;

  if (direccionDicha && direccionDicha !== draftPrevio.texto) {
    direccion = await resolverDireccion(draftPrevio, direccionDicha);
  }

  const huecoDireccion = direccion.texto ? nextAddressGap(direccion) : null;

  if (huecoDireccion) {
    const pregunta = buildAddressQuestion(huecoDireccion, direccion);

    await updateConversationStatus(
      supabase,
      conversationId,
      {
        status: "collecting_order_data",
        current_intent: analysis.intent,
        ai_confidence: analysis.confidence,
        draft_order: { ...(conversation.draftOrder ?? {}), direccion }
      },
      now
    );
    await adapter.send(inbound.threadId, pregunta);
    await recordOutbound(supabase, conversationId, inbound.channel, pregunta, "transactional_reply", now);
    return;
  }

  if (direccion !== draftPrevio) {
    await updateConversationStatus(
      supabase,
      conversationId,
      { draft_order: { ...(conversation.draftOrder ?? {}), direccion } },
      now
    );
  }

  const action = decideNextAction({
    analysis,
    conversation,
    // El pedido repetido y la creacion real llegan en la Fase 5, junto con el upsell.
    repeatOrder: null,
    capabilities: deriveCapabilities(commercialContext),
    ...ENGINE_DEFAULTS
  });

  if (action.type === "handoff") {
    await markNeedsHuman(supabase, conversationId, action.reason, now);
    await avisarAlCliente(supabase, adapter, inbound, conversationId, now);
    await notifyAdmin(avisoDeHandoff(action.reason, inbound.senderName, inbound.text));
    return;
  }

  if (action.type === "close") {
    await updateConversationStatus(
      supabase,
      conversationId,
      {
        status: action.nextStatus,
        current_intent: analysis.intent,
        ai_confidence: analysis.confidence
      },
      now
    );
    return;
  }

  if (action.type === "opt_out") {
    if (conversation.customerId) {
      await markCustomerOptOut(supabase, conversation.customerId, now);
    }

    await updateConversationStatus(supabase, conversationId, { status: "opted_out" }, now);
    await adapter.send(inbound.threadId, action.body);
    await recordOutbound(
      supabase,
      conversationId,
      inbound.channel,
      action.body,
      "opt_out_confirmation",
      now
    );
    return;
  }

  if (action.type === "confirm_draft") {
    await updateConversationStatus(
      supabase,
      conversationId,
      {
        status: "waiting_for_confirmation",
        current_intent: analysis.intent,
        ai_confidence: analysis.confidence,
        draft_order: action.draftOrder
      },
      now
    );
    await adapter.send(inbound.threadId, action.body);
    await recordOutbound(
      supabase,
      conversationId,
      inbound.channel,
      action.body,
      "transactional_reply",
      now
    );
    return;
  }

  if (action.type === "create_order") {
    // La creacion real contra /api/internal/whatsapp/orders llega en la Fase 5.
    // Hasta entonces derivamos a una persona en vez de perder el pedido.
    await markNeedsHuman(supabase, conversationId, "order_ready", now);
    await avisarAlCliente(supabase, adapter, inbound, conversationId, now);
    await notifyAdmin(avisoDeHandoff("order_ready", inbound.senderName, inbound.text));
    return;
  }

  await resetOffTopicStrikes(supabase, conversationId, now);
  await updateConversationStatus(
    supabase,
    conversationId,
    {
      status: action.nextStatus,
      current_intent: analysis.intent,
      ai_confidence: analysis.confidence
    },
    now
  );
  await adapter.send(inbound.threadId, action.body);
  await recordOutbound(
    supabase,
    conversationId,
    inbound.channel,
    action.body,
    action.messageType,
    now
  );
}
