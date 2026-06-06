import { createAdminClient } from "@/lib/supabase/admin";

export type WhatsappConversationRow = {
  id: string;
  customer_id: string | null;
  phone: string;
  status: string;
  current_intent: string | null;
  ai_confidence: number | string | null;
  draft_order: unknown;
  requires_human: boolean;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  created_at: string;
  updated_at: string;
  customers?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    whatsapp_phone?: string | null;
  } | Array<{
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    whatsapp_phone?: string | null;
  }> | null;
  whatsapp_messages?: Array<{
    body: string;
    created_at: string;
    direction: string;
    message_type: string;
  }> | null;
};

export type WhatsappQueueRow = {
  id: string;
  customer_id: string | null;
  order_id: string | null;
  message_type: string;
  status: string;
  scheduled_for: string;
  phone: string;
  body: string;
  attempts: number;
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  customers?: {
    first_name?: string | null;
    last_name?: string | null;
  } | Array<{
    first_name?: string | null;
    last_name?: string | null;
  }> | null;
};

export type WhatsappAutomationSettingRow = {
  id: string;
  message_type: string;
  active: boolean;
  days_after_delivered: number;
  daily_limit: number;
  random_delay_min_seconds: number;
  random_delay_max_seconds: number;
  template_body: string;
  updated_at: string;
};

export type WhatsappCommercialSettingRow = {
  id: string;
  key: string;
  value: unknown;
  requires_human: boolean;
  updated_at: string;
};

export type WhatsappMessageRow = {
  id: string;
  conversation_id: string | null;
  customer_id: string | null;
  order_id: string | null;
  direction: string;
  message_type: string;
  body: string;
  ai_intent: string | null;
  ai_confidence: number | string | null;
  raw_payload: unknown;
  created_at: string;
};

function isMissingWhatsappTable(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return error.code === "42P01" || error.code === "42703" || error.message?.includes("schema cache");
}

export async function listWhatsappConversations(limit = 50) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select(
      `
        id,
        customer_id,
        phone,
        status,
        current_intent,
        ai_confidence,
        draft_order,
        requires_human,
        last_inbound_at,
        last_outbound_at,
        created_at,
        updated_at,
        customers (
          first_name,
          last_name,
          phone,
          whatsapp_phone
        ),
        whatsapp_messages (
          body,
          created_at,
          direction,
          message_type
        )
      `
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (isMissingWhatsappTable(error)) {
    return [] as WhatsappConversationRow[];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as WhatsappConversationRow[];
}

export async function listWhatsappQueue(limit = 100) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_message_queue")
    .select(
      `
        id,
        customer_id,
        order_id,
        message_type,
        status,
        scheduled_for,
        phone,
        body,
        attempts,
        sent_at,
        last_error,
        created_at,
        updated_at,
        customers (
          first_name,
          last_name
        )
      `
    )
    .order("scheduled_for", { ascending: false })
    .limit(limit);

  if (isMissingWhatsappTable(error)) {
    return [] as WhatsappQueueRow[];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as WhatsappQueueRow[];
}

export async function listWhatsappAutomationSettings() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_automation_settings")
    .select("id, message_type, active, days_after_delivered, daily_limit, random_delay_min_seconds, random_delay_max_seconds, template_body, updated_at")
    .order("days_after_delivered", { ascending: true });

  if (isMissingWhatsappTable(error)) {
    return [] as WhatsappAutomationSettingRow[];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as WhatsappAutomationSettingRow[];
}

export async function listWhatsappCommercialSettings() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_commercial_settings")
    .select("id, key, value, requires_human, updated_at")
    .order("key", { ascending: true });

  if (isMissingWhatsappTable(error)) {
    return [] as WhatsappCommercialSettingRow[];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as WhatsappCommercialSettingRow[];
}

export async function listWhatsappConversationsByCustomer(customerId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select("id, customer_id, phone, status, current_intent, ai_confidence, draft_order, requires_human, last_inbound_at, last_outbound_at, created_at, updated_at")
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false });

  if (isMissingWhatsappTable(error)) {
    return [] as WhatsappConversationRow[];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as WhatsappConversationRow[];
}

export async function listWhatsappMessagesByCustomer(customerId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id, conversation_id, customer_id, order_id, direction, message_type, body, ai_intent, ai_confidence, raw_payload, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (isMissingWhatsappTable(error)) {
    return [] as WhatsappMessageRow[];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as WhatsappMessageRow[];
}

export async function listWhatsappMessagesByConversation(conversationId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id, conversation_id, customer_id, order_id, direction, message_type, body, ai_intent, ai_confidence, raw_payload, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (isMissingWhatsappTable(error)) {
    return [] as WhatsappMessageRow[];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as WhatsappMessageRow[];
}
