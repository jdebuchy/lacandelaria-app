import { analyzeIncomingMessage } from "./ai/analyzeIncomingMessage.js";
import { applyConversationRules } from "./conversationEngine.js";
import { normalizeWhatsappPhone, phonesMatch } from "./phone.js";
import { sendWhatsappMessage } from "./whatsappClient.js";
import { supabase } from "./supabase.js";

async function findOrCreateCustomer(phone) {
  const { data: exactMatch } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone, whatsapp_phone, whatsapp_opt_in, whatsapp_opt_out_at")
    .or(`phone.eq.${phone},whatsapp_phone.eq.${phone}`)
    .limit(1)
    .maybeSingle();

  if (exactMatch) {
    return exactMatch;
  }

  const { data: candidates, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone, whatsapp_phone, whatsapp_opt_in, whatsapp_opt_out_at")
    .or("phone.not.is.null,whatsapp_phone.not.is.null")
    .limit(500);

  if (error) {
    throw error;
  }

  return (candidates ?? []).find((customer) => phonesMatch(customer.whatsapp_phone || customer.phone, phone)) ?? null;
}

async function findOrCreateConversation({ customer, phone }) {
  const { data: exactExisting, error: existingError } = await supabase
    .from("whatsapp_conversations")
    .select("id, customer_id, phone, status, current_intent, ai_confidence, draft_order, requires_human")
    .eq("phone", phone)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  let existing = exactExisting;

  if (!existing) {
    const { data: candidateConversations, error: candidatesError } = await supabase
      .from("whatsapp_conversations")
      .select("id, customer_id, phone, status, current_intent, ai_confidence, draft_order, requires_human")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (candidatesError) {
      throw candidatesError;
    }

    existing = (candidateConversations ?? []).find((conversation) => phonesMatch(conversation.phone, phone)) ?? null;
  }

  if (existing) {
    if (!existing.customer_id && customer?.id) {
      await supabase
        .from("whatsapp_conversations")
        .update({
          customer_id: customer.id,
          phone,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
      existing.customer_id = customer.id;
      existing.phone = phone;
    }

    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from("whatsapp_conversations")
    .insert({
      customer_id: customer?.id ?? null,
      phone,
      status: "idle"
    })
    .select("id, customer_id, phone, status, current_intent, ai_confidence, draft_order, requires_human")
    .single();

  if (createError) {
    throw createError;
  }

  return created;
}

async function loadCommercialContext() {
  const { data } = await supabase
    .from("whatsapp_commercial_settings")
    .select("key, value, requires_human");

  return data ?? [];
}

async function loadRecentMessages(conversationId) {
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("direction, message_type, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (data ?? []).reverse();
}

async function resolveMessagePhone(message) {
  const candidates = [];

  try {
    const contact = await message.getContact();
    candidates.push(contact?.number, contact?.id?.user, contact?.id?._serialized);
  } catch (error) {
    console.warn("Could not resolve WhatsApp contact for inbound message.", error);
  }

  candidates.push(message.from, message.author, message.id?.remote, message.id?._serialized);

  for (const candidate of candidates) {
    const phone = normalizeWhatsappPhone(candidate);

    if (phone) {
      return phone;
    }
  }

  return "";
}

export async function handleIncomingMessage(message) {
  if (message.fromMe || message.isStatus) {
    return;
  }

  const phone = await resolveMessagePhone(message);

  if (!phone) {
    return;
  }

  const body = String(message.body ?? "").trim();

  if (!body) {
    return;
  }

  const customer = await findOrCreateCustomer(phone);
  const conversation = await findOrCreateConversation({ customer, phone });
  const now = new Date().toISOString();

  const { data: inbound, error: inboundError } = await supabase
    .from("whatsapp_messages")
    .insert({
      conversation_id: conversation.id,
      customer_id: conversation.customer_id,
      direction: "inbound",
      message_type: "transactional_reply",
      body,
      raw_payload: {
        author: message.author ?? null,
        from: message.from,
        id: message.id?._serialized ?? null,
        timestamp: message.timestamp ?? null
      }
    })
    .select("id")
    .single();

  if (inboundError) {
    throw inboundError;
  }

  await supabase
    .from("whatsapp_conversations")
    .update({
      last_inbound_at: now,
      updated_at: now
    })
    .eq("id", conversation.id);

  if (customer?.whatsapp_opt_in === false || customer?.whatsapp_opt_out_at) {
    return;
  }

  const [commercialContext, recentMessages] = await Promise.all([
    loadCommercialContext(),
    loadRecentMessages(conversation.id)
  ]);

  let analysis;

  try {
    analysis = await analyzeIncomingMessage({
      commercialContext,
      conversation,
      messageBody: body,
      recentMessages
    });
  } catch (error) {
    await supabase
      .from("whatsapp_conversations")
      .update({
        requires_human: true,
        status: "needs_human",
        updated_at: new Date().toISOString()
      })
      .eq("id", conversation.id);
    console.error("AI analysis failed", error);
    return;
  }

  await supabase
    .from("whatsapp_messages")
    .update({
      ai_confidence: analysis.confidence,
      ai_intent: analysis.intent
    })
    .eq("id", inbound.id);

  await applyConversationRules({
    analysis,
    conversation,
    inboundMessageId: inbound.id,
    sendReply: async (replyBody, messageType, orderId = null) => {
      await new Promise((resolve) => setTimeout(resolve, 2500 + Math.random() * 4500));
      await sendWhatsappMessage(message.from, replyBody);
      const sentAt = new Date().toISOString();
      await supabase.from("whatsapp_messages").insert({
        conversation_id: conversation.id,
        customer_id: conversation.customer_id,
        order_id: orderId,
        direction: "outbound",
        message_type: messageType,
        body: replyBody
      });
      await supabase
        .from("whatsapp_conversations")
        .update({
          last_outbound_at: sentAt,
          updated_at: sentAt
        })
        .eq("id", conversation.id);
    }
  });
}
