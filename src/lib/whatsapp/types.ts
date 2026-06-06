import type {
  WhatsappAiIntent,
  WhatsappConversationStatus,
  WhatsappMessageType,
  WhatsappQueueStatus
} from "@/lib/types";

export const WHATSAPP_CONVERSATION_STATUS_LABELS: Record<WhatsappConversationStatus, string> = {
  idle: "Idle",
  satisfaction_followup_sent: "Satisfacción enviada",
  satisfaction_answered: "Satisfacción respondida",
  reactivation_sent: "Recompra enviada",
  interested_in_buying: "Interesado",
  collecting_order_data: "Recolectando datos",
  waiting_for_confirmation: "Esperando confirmación",
  order_created: "Pedido creado",
  needs_human: "Requiere humano",
  opted_out: "Baja solicitada",
  closed: "Cerrada"
};

export const WHATSAPP_MESSAGE_TYPE_LABELS: Record<WhatsappMessageType, string> = {
  satisfaction_check: "Satisfacción",
  reactivation_offer: "Recompra",
  transactional_reply: "Respuesta transaccional",
  order_confirmation: "Confirmación de pedido",
  human_handoff: "Derivación humana",
  opt_out_confirmation: "Confirmación de baja"
};

export const WHATSAPP_QUEUE_STATUS_LABELS: Record<WhatsappQueueStatus, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  sent: "Enviado",
  failed: "Fallido",
  cancelled: "Cancelado"
};

export const WHATSAPP_AI_INTENT_LABELS: Record<WhatsappAiIntent, string> = {
  satisfied: "Satisfecho",
  complaint: "Reclamo",
  buy: "Comprar",
  ask_price: "Pregunta precio",
  ask_delivery: "Pregunta entrega",
  ask_products: "Pregunta productos",
  confirm_order: "Confirma pedido",
  modify_order: "Modifica pedido",
  cancel_order: "Cancela pedido",
  not_interested: "No interesado",
  not_now: "No ahora",
  opt_out: "Baja",
  unknown: "Desconocida"
};

export function getWhatsappStatusLabel(status?: string | null) {
  return WHATSAPP_CONVERSATION_STATUS_LABELS[status as WhatsappConversationStatus] ?? status ?? "-";
}

export function getWhatsappMessageTypeLabel(messageType?: string | null) {
  return WHATSAPP_MESSAGE_TYPE_LABELS[messageType as WhatsappMessageType] ?? messageType ?? "-";
}

export function getWhatsappQueueStatusLabel(status?: string | null) {
  return WHATSAPP_QUEUE_STATUS_LABELS[status as WhatsappQueueStatus] ?? status ?? "-";
}

export function getWhatsappIntentLabel(intent?: string | null) {
  return WHATSAPP_AI_INTENT_LABELS[intent as WhatsappAiIntent] ?? intent ?? "-";
}

export function formatConfidence(confidence?: number | string | null) {
  if (confidence === null || confidence === undefined || confidence === "") {
    return "-";
  }

  const value = Number(confidence);

  if (!Number.isFinite(value)) {
    return "-";
  }

  return `${Math.round(value * 100)}%`;
}
