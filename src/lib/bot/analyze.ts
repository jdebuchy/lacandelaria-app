import { z } from "zod";
import { BOT_INTENTS, type BotAnalysis } from "./types";

// Portado tal cual desde services/whatsapp-worker/src/ai/analyzeIncomingMessage.js:
// los modelos devuelven variantes del mismo intent y sin este mapa caen en unknown.
const INTENT_ALIASES: Record<string, string> = {
  delivery_inquiry: "ask_delivery",
  price: "ask_price",
  price_inquiry: "ask_price",
  product_inquiry: "ask_products",
  products_inquiry: "ask_products",
  purchase: "buy",
  purchase_intent: "buy",
  reorder: "buy",
  unsubscribe: "opt_out"
};

export const analysisSchema = z.object({
  can_create_order: z.boolean().default(false),
  confidence: z.number().min(0).max(1),
  extracted: z
    .object({
      customer_name: z.string().nullable().optional(),
      delivery_address: z.string().nullable().optional(),
      delivery_zone: z.string().nullable().optional(),
      free_text_notes: z.string().nullable().optional(),
      payment_method: z.string().nullable().optional(),
      preferred_delivery_date: z.string().nullable().optional(),
      preferred_delivery_time: z.string().nullable().optional(),
      product_name: z.string().nullable().optional(),
      quantity: z.number().nullable().optional(),
      wants_same_address: z.boolean().nullable().optional(),
      wants_same_order: z.boolean().nullable().optional()
    })
    .default({}),
  intent: z.enum(BOT_INTENTS),
  missing_fields: z.array(z.string()).default([]),
  should_handoff_to_human: z.boolean().default(false),
  suggested_reply: z.string().default("")
});

// Schema JSON para output_config.format en los proveedores que lo soportan.
// Sin restricciones numericas ni de longitud, que structured outputs no admite.
export const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: [...BOT_INTENTS] },
    confidence: { type: "number" },
    // Enumeradas explicitamente: con un objeto libre, el modelo devuelve
    // extracted vacio y el bot vuelve a preguntar datos que el cliente ya dio.
    extracted: {
      type: "object",
      properties: {
        customer_name: { type: "string" },
        delivery_address: { type: "string" },
        delivery_zone: { type: "string" },
        payment_method: { type: "string" },
        product_name: { type: "string" },
        quantity: { type: "number" },
        preferred_delivery_date: { type: "string" },
        preferred_delivery_time: { type: "string" },
        free_text_notes: { type: "string" }
      },
      additionalProperties: false
    },
    missing_fields: { type: "array", items: { type: "string" } },
    should_handoff_to_human: { type: "boolean" },
    suggested_reply: { type: "string" },
    can_create_order: { type: "boolean" }
  },
  required: [
    "intent",
    "confidence",
    "extracted",
    "missing_fields",
    "should_handoff_to_human",
    "suggested_reply",
    "can_create_order"
  ],
  additionalProperties: false
} as const;

export const BOT_SYSTEM_PROMPT = `Sos Cande, el asistente de Paltas La Candelaria.

Hablás en español rioplatense, de vos, con calidez y sin vueltas. Escribís bien: con acentos y con mayúscula al empezar cada oración. El tono es informal, la ortografía no. La única licencia son los signos de apertura, que no se usan: se escribe 'Cómo estás?', nunca '¿Cómo estás?'. Cande es la marca abreviada, no una persona: no te inventes una vida, un turno de trabajo ni un lugar donde estas. Si el cliente pregunta si sos un bot, una persona, o con quien esta hablando, deci la verdad de una: sos un asistente automatico de Paltas La Candelaria y podes pasarlo con alguien del equipo. Nunca afirmes ser una persona.

El negocio vende cajas de paltas premium de 4kg y, de forma complementaria, algunos frutos secos.

Tu trabajo es interpretar mensajes de clientes existentes para medir satisfaccion, detectar interes de recompra, tomar pedidos simples y derivar a humano cuando corresponda.

No sos un chatbot generalista. No inventes precios, stock, zonas, fechas de entrega, descuentos ni condiciones comerciales. Usa solamente el contexto estructurado provisto por el sistema. No prometas entregas si no estan disponibles en el contexto. No ofrezcas compensaciones ante reclamos. No insistas si el cliente no quiere comprar. Si el cliente pide baja, marca opt_out. Si hay ambiguedad o baja confianza, pedi una aclaracion breve o deriva a humano. Antes de crear un pedido debe existir confirmacion explicita del cliente.

Responde unicamente JSON valido con: intent, confidence, extracted, missing_fields, should_handoff_to_human, suggested_reply, can_create_order.

En "extracted" va todo dato concreto que aparezca en la conversacion, aunque el cliente lo haya dicho varios mensajes antes. Es lo unico que se guarda entre mensajes: lo que no pongas aca se pierde y se lo terminas preguntando de nuevo. Campos:
- customer_name: nombre del cliente
- delivery_address: calle y numero, tal como los dijo
- delivery_zone: localidad o barrio
- payment_method: "cash" o "transfer"
- product_name: que producto quiere
- quantity: cuantas unidades, como numero
- preferred_delivery_date, preferred_delivery_time: cuando quiere recibirlo
- free_text_notes: cualquier indicacion de entrega (timbre, piso, horario)

Si un dato no aparece, omiti el campo. No inventes ninguno.

El bloque "ya_confirmado" trae lo que el cliente ya dio y quedo guardado. Nunca vuelvas a pedir algo que este ahi: para el cliente es como si no lo estuvieras escuchando. Si la direccion figura confirmada, dala por buena y segui con lo que falte.

El campo intent debe ser exactamente uno de estos valores: ${BOT_INTENTS.join(", ")}.`;

// El tono sale de commercial_settings (key tone_guide), destilado de las
// respuestas reales del equipo. Si no esta cargado, el bot usa el prompt base:
// suena correcto pero generico, que es como sonaba antes de medir nada.
export function buildSystemPrompt(toneGuide: Record<string, unknown> | null) {
  if (!toneGuide) {
    return BOT_SYSTEM_PROMPT;
  }

  const reglas = Array.isArray(toneGuide.reglas) ? toneGuide.reglas : [];
  const evitar = Array.isArray(toneGuide.evitar) ? toneGuide.evitar : [];
  const ejemplos = Array.isArray(toneGuide.ejemplos) ? toneGuide.ejemplos : [];

  if (!reglas.length && !ejemplos.length) {
    return BOT_SYSTEM_PROMPT;
  }

  const partes = [BOT_SYSTEM_PROMPT, "", "COMO ESCRIBE EL EQUIPO DE PALTAS LA CANDELARIA"];

  if (reglas.length) {
    partes.push("", ...reglas.map((r) => `- ${r}`));
  }

  if (evitar.length) {
    partes.push("", "Evita:", ...evitar.map((r) => `- ${r}`));
  }

  // Los ejemplos son la senal mas fuerte de un prompt: el modelo copia su largo,
  // su registro y su estructura. Van al final y son pocos a proposito.
  if (ejemplos.length) {
    partes.push("", "Ejemplos reales del equipo (imita este largo y este registro):");

    for (const ejemplo of ejemplos as Array<{ cliente?: string; equipo?: string }>) {
      if (ejemplo.cliente && ejemplo.equipo) {
        partes.push(`  Cliente: ${ejemplo.cliente}`, `  Equipo: ${ejemplo.equipo}`, "");
      }
    }
  }

  return partes.join("\n");
}

export type AnalysisPromptInput = {
  commercialContext: Record<string, unknown>;
  conversationStatus: string;
  messageBody: string;
  recentMessages: Array<{ direction: string; body: string }>;
  // Lo que ya se confirmo del pedido. Sin esto el modelo no sabe que la
  // direccion ya esta tomada y la vuelve a pedir al final, cuando el cliente
  // ya la dio y hasta eligio entre las opciones de Google.
  confirmado?: Record<string, unknown> | null;
};

export function buildAnalysisPrompt(input: AnalysisPromptInput) {
  return JSON.stringify({
    commercial_context: input.commercialContext,
    conversation: { status: input.conversationStatus },
    ya_confirmado: input.confirmado ?? {},
    message: input.messageBody,
    recent_messages: input.recentMessages
  });
}

function extractJson(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

// Ante cualquier duda derivamos a humano: es mas barato molestar a Jose que
// contestarle cualquier cosa a un cliente.
const FALLBACK_ANALYSIS: BotAnalysis = {
  intent: "unknown",
  confidence: 0,
  extracted: {},
  missingFields: [],
  shouldHandoffToHuman: true,
  suggestedReply: "",
  canCreateOrder: false
};

export function parseAnalysis(raw: string): BotAnalysis {
  const parsed = extractJson(raw);

  if (!parsed || typeof parsed !== "object") {
    return FALLBACK_ANALYSIS;
  }

  const source = parsed as Record<string, unknown>;
  const intent = source.intent;

  const normalized = {
    ...source,
    intent: typeof intent === "string" ? INTENT_ALIASES[intent] ?? intent : intent
  };

  const result = analysisSchema.safeParse(normalized);

  if (!result.success) {
    return FALLBACK_ANALYSIS;
  }

  return {
    intent: result.data.intent,
    confidence: result.data.confidence,
    extracted: result.data.extracted as Record<string, unknown>,
    missingFields: result.data.missing_fields,
    shouldHandoffToHuman: result.data.should_handoff_to_human,
    suggestedReply: result.data.suggested_reply,
    canCreateOrder: result.data.can_create_order
  };
}
