import { createAdminClient } from "@/lib/supabase/admin";
import type { ChannelId, ConversationState, InboundMessage } from "./types";

type Client = ReturnType<typeof createAdminClient>;

// Supabase devuelve las relaciones como objeto o como array segun la cardinalidad
// que infiera; el repo resuelve esto igual en las paginas de pedidos.
function takeSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function loadConversationState(
  supabase: Client,
  channel: ChannelId,
  threadId: string,
  now: string
): Promise<ConversationState | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, channel, channel_thread_id, customer_id, status, requires_human, bot_muted_until, off_topic_strikes, llm_calls_today, llm_calls_date, draft_order, last_inbound_text, last_inbound_at, customers ( whatsapp_opt_in )"
    )
    .eq("channel", channel)
    .eq("channel_thread_id", threadId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const since = new Date(new Date(now).getTime() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("conversation_messages")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", data.id)
    .eq("direction", "outbound")
    .gte("created_at", since);

  const customer = takeSingleRelation<{ whatsapp_opt_in?: boolean }>(data.customers);

  return {
    id: data.id,
    channel: data.channel as ChannelId,
    threadId: data.channel_thread_id,
    customerId: data.customer_id,
    status: data.status,
    requiresHuman: data.requires_human,
    botMutedUntil: data.bot_muted_until,
    offTopicStrikes: data.off_topic_strikes,
    llmCallsToday: data.llm_calls_today,
    llmCallsDate: data.llm_calls_date,
    draftOrder: (data.draft_order as Record<string, unknown> | null) ?? null,
    outboundLastHour: count ?? 0,
    lastInboundText: data.last_inbound_text,
    lastInboundAt: data.last_inbound_at,
    optedOut: customer?.whatsapp_opt_in === false
  };
}

export async function ensureConversation(
  supabase: Client,
  inbound: InboundMessage,
  now: string,
  isTest: boolean
) {
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("channel", inbound.channel)
    .eq("channel_thread_id", inbound.threadId)
    .maybeSingle();

  if (data) {
    return data.id as string;
  }

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      channel: inbound.channel,
      channel_thread_id: inbound.threadId,
      status: "idle",
      is_test: isTest,
      created_at: now,
      updated_at: now
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`No se pudo crear la conversacion: ${error?.message}`);
  }

  return created.id as string;
}

// Devuelve false si el mensaje ya estaba registrado. Telegram reintenta el
// webhook ante cualquier respuesta que no sea 200, y sin este chequeo un
// reintento procesaria el mismo mensaje dos veces.
export async function recordInbound(
  supabase: Client,
  conversationId: string,
  inbound: InboundMessage,
  now: string
) {
  const { error } = await supabase.from("conversation_messages").insert({
    conversation_id: conversationId,
    channel: inbound.channel,
    direction: "inbound",
    message_type: "customer_message",
    body: inbound.text,
    external_message_id: inbound.externalMessageId,
    raw_payload: inbound.raw,
    created_at: now
  });

  if (error) {
    if (error.code === "23505") {
      return false;
    }

    throw new Error(`No se pudo registrar el mensaje entrante: ${error.message}`);
  }

  await supabase
    .from("conversations")
    .update({ last_inbound_text: inbound.text, last_inbound_at: now, updated_at: now })
    .eq("id", conversationId);

  return true;
}

export async function recordOutbound(
  supabase: Client,
  conversationId: string,
  channel: ChannelId,
  body: string,
  messageType: string,
  now: string
) {
  await supabase.from("conversation_messages").insert({
    conversation_id: conversationId,
    channel,
    direction: "outbound",
    message_type: messageType,
    body,
    created_at: now
  });

  await supabase
    .from("conversations")
    .update({ last_outbound_at: now, updated_at: now })
    .eq("id", conversationId);
}

export async function bumpOffTopicStrike(
  supabase: Client,
  conversation: ConversationState,
  now: string,
  maxStrikes: number,
  muteHours: number
) {
  const strikes = conversation.offTopicStrikes + 1;
  const mutedUntil =
    strikes >= maxStrikes
      ? new Date(new Date(now).getTime() + muteHours * 60 * 60 * 1000).toISOString()
      : conversation.botMutedUntil;

  await supabase
    .from("conversations")
    .update({ off_topic_strikes: strikes, bot_muted_until: mutedUntil, updated_at: now })
    .eq("id", conversation.id);
}

export async function resetOffTopicStrikes(supabase: Client, conversationId: string, now: string) {
  await supabase
    .from("conversations")
    .update({ off_topic_strikes: 0, updated_at: now })
    .eq("id", conversationId);
}

export async function countLlmCall(
  supabase: Client,
  conversation: ConversationState,
  now: string
) {
  const today = now.slice(0, 10);
  const spent = conversation.llmCallsDate === today ? conversation.llmCallsToday : 0;

  await supabase
    .from("conversations")
    .update({ llm_calls_today: spent + 1, llm_calls_date: today, updated_at: now })
    .eq("id", conversation.id);
}

export async function recordLlmUsage(
  supabase: Client,
  conversationId: string,
  usage: {
    provider: string;
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
  }
) {
  await supabase.from("bot_llm_usage").insert({
    conversation_id: conversationId,
    provider: usage.provider,
    model: usage.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens
  });
}

export async function loadCommercialContext(supabase: Client) {
  const { data } = await supabase
    .from("commercial_settings")
    .select("key, value")
    .eq("key", "catalog_context")
    .maybeSingle();

  return (data?.value as Record<string, unknown>) ?? {};
}

// Las reglas de upsell viven en la misma tabla de settings que el tono y el
// catalogo: son una decision comercial, se cambian sin tocar codigo ni migrar.
export async function loadUpsellRules(supabase: Client) {
  const { data } = await supabase
    .from("commercial_settings")
    .select("value")
    .eq("key", "upsell_rules")
    .maybeSingle();

  return (data?.value as Record<string, unknown> | null) ?? null;
}

export async function loadToneGuide(supabase: Client) {
  const { data } = await supabase
    .from("commercial_settings")
    .select("value")
    .eq("key", "tone_guide")
    .maybeSingle();

  return (data?.value as Record<string, unknown> | null) ?? null;
}

export async function loadRecentMessages(supabase: Client, conversationId: string, limit = 6) {
  const { data } = await supabase
    .from("conversation_messages")
    .select("direction, body")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).reverse().map((row) => ({ direction: row.direction, body: row.body }));
}

export async function markNeedsHuman(
  supabase: Client,
  conversationId: string,
  reason: string,
  now: string
) {
  await supabase
    .from("conversations")
    .update({
      requires_human: true,
      status: "needs_human",
      current_intent: reason,
      updated_at: now
    })
    .eq("id", conversationId);
}

export async function updateConversationStatus(
  supabase: Client,
  conversationId: string,
  patch: Record<string, unknown>,
  now: string
) {
  await supabase
    .from("conversations")
    .update({ ...patch, updated_at: now })
    .eq("id", conversationId);
}

export async function markCustomerOptOut(supabase: Client, customerId: string, now: string) {
  await supabase
    .from("customers")
    .update({ whatsapp_opt_in: false, whatsapp_opt_out_at: now })
    .eq("id", customerId);
}
