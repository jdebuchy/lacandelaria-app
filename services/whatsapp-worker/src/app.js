import express from "express";
import { assertRequiredConfig, config } from "./config.js";
import { buildDailyQueue } from "./queueBuilder.js";
import { handleIncomingMessage } from "./incomingMessageHandler.js";
import { initializeWhatsappClient, getWhatsappStatus, sendWhatsappMessage } from "./whatsappClient.js";
import { processQueue } from "./queueProcessor.js";
import { startScheduler } from "./scheduler.js";
import { supabase } from "./supabase.js";
import { toWhatsappChatId } from "./phone.js";

assertRequiredConfig();

const app = express();
app.use(express.json({ limit: "1mb" }));

function requireInternalSecret(request, response, next) {
  const provided = request.header("x-internal-api-secret") ?? "";

  if (!config.internalApiSecret || provided !== config.internalApiSecret) {
    response.status(401).json({ success: false, message: "Unauthorized." });
    return;
  }

  next();
}

app.get("/health", (_, response) => {
  response.json({
    ok: true,
    service: "whatsapp-worker",
    whatsapp: getWhatsappStatus()
  });
});

app.post("/admin/build-daily-queue", requireInternalSecret, async (_, response, next) => {
  try {
    response.json(await buildDailyQueue());
  } catch (error) {
    next(error);
  }
});

app.post("/admin/process-queue", requireInternalSecret, async (request, response, next) => {
  try {
    response.json(await processQueue({ limit: Number(request.body?.limit ?? 1) }));
  } catch (error) {
    next(error);
  }
});

async function queueSummaryHandler(_, response, next) {
  try {
    const { data, error } = await supabase
      .from("whatsapp_message_queue")
      .select("status, message_type");

    if (error) throw error;

    response.json({
      success: true,
      summary: (data ?? []).reduce((acc, row) => {
        const key = `${row.status}:${row.message_type}`;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {})
    });
  } catch (error) {
    next(error);
  }
}

app.get("/admin/queue-summary", requireInternalSecret, queueSummaryHandler);
app.post("/admin/queue-summary", requireInternalSecret, queueSummaryHandler);

app.get("/admin/conversations", requireInternalSecret, async (_, response, next) => {
  try {
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    response.json({ conversations: data ?? [], success: true });
  } catch (error) {
    next(error);
  }
});

app.post("/admin/conversations/:conversationId/take-over", requireInternalSecret, async (request, response, next) => {
  try {
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({
        requires_human: true,
        status: "needs_human",
        updated_at: new Date().toISOString()
      })
      .eq("id", request.params.conversationId);

    if (error) throw error;
    response.json({ success: true, message: "Conversation assigned to human." });
  } catch (error) {
    next(error);
  }
});

app.post("/admin/conversations/:conversationId/send-message", requireInternalSecret, async (request, response, next) => {
  try {
    const body = String(request.body?.body ?? "").trim();

    if (!body) {
      response.status(400).json({ success: false, message: "Body is required." });
      return;
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("whatsapp_conversations")
      .select("id, customer_id, phone")
      .eq("id", request.params.conversationId)
      .single();

    if (conversationError) throw conversationError;

    await sendWhatsappMessage(toWhatsappChatId(conversation.phone), body);
    const sentAt = new Date().toISOString();
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      customer_id: conversation.customer_id,
      direction: "outbound",
      message_type: "human_handoff",
      body
    });
    await supabase
      .from("whatsapp_conversations")
      .update({ last_outbound_at: sentAt, updated_at: sentAt })
      .eq("id", conversation.id);

    response.json({ success: true, message: "Message sent." });
  } catch (error) {
    next(error);
  }
});

app.post("/admin/messages/:messageId/cancel", requireInternalSecret, async (request, response, next) => {
  try {
    const { error } = await supabase
      .from("whatsapp_message_queue")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString()
      })
      .eq("id", request.params.messageId)
      .in("status", ["pending", "failed"]);

    if (error) throw error;
    response.json({ success: true, message: "Message cancelled." });
  } catch (error) {
    next(error);
  }
});

app.post("/admin/messages/:messageId/retry", requireInternalSecret, async (request, response, next) => {
  try {
    const { error } = await supabase
      .from("whatsapp_message_queue")
      .update({
        last_error: null,
        status: "pending",
        updated_at: new Date().toISOString()
      })
      .eq("id", request.params.messageId)
      .eq("status", "failed");

    if (error) throw error;
    response.json({ success: true, message: "Message queued for retry." });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({
    success: false,
    message: error instanceof Error ? error.message : "Unexpected worker error."
  });
});

app.listen(config.port, () => {
  console.log(`WhatsApp worker listening on ${config.port}`);
});

initializeWhatsappClient(handleIncomingMessage)
  .then(() => {
    startScheduler();
  })
  .catch((error) => {
    console.error("WhatsApp initialization failed", error);
  });
