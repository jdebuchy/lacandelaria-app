import { z } from "zod";
import { callOpenRouter } from "./openRouterClient.js";

const analysisSchema = z.object({
  can_create_order: z.boolean().default(false),
  confidence: z.number().min(0).max(1),
  extracted: z.object({
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
  }).default({}),
  intent: z.enum([
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
  ]),
  missing_fields: z.array(z.string()).default([]),
  should_handoff_to_human: z.boolean().default(false),
  suggested_reply: z.string().default("")
});

const SYSTEM_PROMPT = `Sos un asistente transaccional para Paltas La Candelaria.

El negocio vende cajas de paltas premium de 4kg y, de forma complementaria, algunos frutos secos.

Tu trabajo es interpretar mensajes de clientes existentes para medir satisfacción, detectar interés de recompra, tomar pedidos simples y derivar a humano cuando corresponda.

No sos un chatbot generalista. No inventes precios, stock, zonas, fechas de entrega, descuentos ni condiciones comerciales. Usá solamente el contexto estructurado provisto por el sistema. No prometas entregas si no están disponibles en el contexto. No ofrezcas compensaciones ante reclamos. No insistas si el cliente no quiere comprar. Si el cliente pide baja, marcá opt_out. Si hay ambigüedad o baja confianza, pedí una aclaración breve o derivá a humano. Antes de crear un pedido debe existir confirmación explícita del cliente.

Respondé únicamente JSON válido con: intent, confidence, extracted, missing_fields, should_handoff_to_human, suggested_reply, can_create_order.`;

export async function analyzeIncomingMessage({ commercialContext, conversation, messageBody, recentMessages }) {
  const raw = await callOpenRouter([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        commercial_context: commercialContext,
        conversation,
        message: messageBody,
        recent_messages: recentMessages
      })
    }
  ]);

  return analysisSchema.parse(raw);
}
