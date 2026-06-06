import { toWhatsappChatId } from "./phone.js";
import { sendWhatsappMessage } from "./whatsappClient.js";
import { supabase } from "./supabase.js";

function randomDelay(minSeconds, maxSeconds) {
  const min = Math.max(0, Number(minSeconds ?? 45));
  const max = Math.max(min, Number(maxSeconds ?? 180));
  return Math.floor((min + Math.random() * (max - min)) * 1000);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getDailyLimit(messageType) {
  const { data } = await supabase
    .from("whatsapp_automation_settings")
    .select("daily_limit, random_delay_min_seconds, random_delay_max_seconds")
    .eq("message_type", messageType)
    .maybeSingle();

  return {
    dailyLimit: Number(data?.daily_limit ?? 40),
    delayMax: Number(data?.random_delay_max_seconds ?? 180),
    delayMin: Number(data?.random_delay_min_seconds ?? 45)
  };
}

async function sentTodayCount(messageType) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("whatsapp_message_queue")
    .select("*", { count: "exact", head: true })
    .eq("message_type", messageType)
    .eq("status", "sent")
    .gte("sent_at", since.toISOString());

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function customerCanReceive(customerId) {
  if (!customerId) {
    return false;
  }

  const { data, error } = await supabase
    .from("customers")
    .select("whatsapp_opt_in, whatsapp_opt_out_at")
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data && data.whatsapp_opt_in !== false && !data.whatsapp_opt_out_at);
}

export async function processQueue({ limit = 1 } = {}) {
  const { data: rows, error } = await supabase
    .from("whatsapp_message_queue")
    .select("id, customer_id, message_type, phone, body, attempts")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  const results = [];

  for (const row of rows ?? []) {
    const { data: claimed, error: claimError } = await supabase
      .from("whatsapp_message_queue")
      .update({
        attempts: Number(row.attempts ?? 0) + 1,
        status: "processing",
        updated_at: new Date().toISOString()
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (claimError) {
      throw claimError;
    }

    if (!claimed) {
      continue;
    }

    try {
      const limits = await getDailyLimit(row.message_type);
      const sentCount = await sentTodayCount(row.message_type);

      if (sentCount >= limits.dailyLimit) {
        await supabase
          .from("whatsapp_message_queue")
          .update({ status: "pending", updated_at: new Date().toISOString() })
          .eq("id", row.id);
        results.push({ id: row.id, status: "deferred_daily_limit" });
        continue;
      }

      if (!(await customerCanReceive(row.customer_id))) {
        await supabase
          .from("whatsapp_message_queue")
          .update({
            last_error: "Customer opted out or cannot receive WhatsApp.",
            status: "cancelled",
            updated_at: new Date().toISOString()
          })
          .eq("id", row.id);
        results.push({ id: row.id, status: "cancelled_opt_out" });
        continue;
      }

      await wait(randomDelay(limits.delayMin, limits.delayMax));
      const chatId = toWhatsappChatId(row.phone);
      await sendWhatsappMessage(chatId, row.body);
      const sentAt = new Date().toISOString();

      await supabase
        .from("whatsapp_message_queue")
        .update({
          last_error: null,
          sent_at: sentAt,
          status: "sent",
          updated_at: sentAt
        })
        .eq("id", row.id);

      let { data: conversation } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("phone", row.phone)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!conversation?.id) {
        const { data: createdConversation } = await supabase
          .from("whatsapp_conversations")
          .insert({
            customer_id: row.customer_id,
            phone: row.phone,
            status:
              row.message_type === "satisfaction_check"
                ? "satisfaction_followup_sent"
                : row.message_type === "reactivation_offer"
                  ? "reactivation_sent"
                  : "idle",
            last_outbound_at: sentAt
          })
          .select("id")
          .single();
        conversation = createdConversation;
      }

      await supabase.from("whatsapp_messages").insert({
        conversation_id: conversation?.id ?? null,
        customer_id: row.customer_id,
        direction: "outbound",
        message_type: row.message_type,
        body: row.body,
        raw_payload: { queue_id: row.id }
      });

      if (conversation?.id) {
        await supabase
          .from("whatsapp_conversations")
          .update({
            last_outbound_at: sentAt,
            updated_at: sentAt
          })
          .eq("id", conversation.id);
      }

      results.push({ id: row.id, status: "sent" });
    } catch (sendError) {
      await supabase
        .from("whatsapp_message_queue")
        .update({
          last_error: sendError instanceof Error ? sendError.message : "Unknown send error.",
          status: "failed",
          updated_at: new Date().toISOString()
        })
        .eq("id", row.id);
      results.push({ id: row.id, status: "failed" });
    }
  }

  return {
    processed: results.length,
    results,
    success: true
  };
}
