import express from "express";
import QRCode from "qrcode";
import { assertRequiredConfig, config } from "./config.js";
import { buildDailyQueue } from "./queueBuilder.js";
import { handleIncomingMessage } from "./incomingMessageHandler.js";
import { initializeWhatsappClient, getLatestQr, getWhatsappStatus, sendWhatsappMessage } from "./whatsappClient.js";
import { processQueue } from "./queueProcessor.js";
import { startScheduler } from "./scheduler.js";
import { supabase } from "./supabase.js";
import { toWhatsappChatId } from "./phone.js";

assertRequiredConfig();

const app = express();
app.use(express.json({ limit: "1mb" }));

function requireInternalSecret(request, response, next) {
  const provided = request.header("x-internal-api-secret") ?? request.query.secret ?? "";

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

app.get("/admin/qr", requireInternalSecret, async (_, response, next) => {
  try {
    const qr = getLatestQr();

    if (!qr) {
      response.type("html").send(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>WhatsApp QR</title>
    <style>
      body { align-items: center; background: #f7f4ee; color: #1f1a17; display: grid; font-family: sans-serif; min-height: 100vh; margin: 0; place-items: center; }
      main { background: white; border-radius: 24px; box-shadow: 0 24px 80px rgb(0 0 0 / 12%); max-width: 520px; padding: 40px; text-align: center; }
      code { background: #f0ece3; border-radius: 8px; padding: 4px 8px; }
    </style>
  </head>
  <body>
    <main>
      <h1>No hay QR activo</h1>
      <p>Estado actual: <code>${JSON.stringify(getWhatsappStatus())}</code></p>
      <p>Si WhatsApp todavia no esta listo, redeploya o reinicia el worker y recarga esta pagina.</p>
    </main>
  </body>
</html>`);
      return;
    }

    const svg = await QRCode.toString(qr, {
      errorCorrectionLevel: "M",
      margin: 2,
      type: "svg",
      width: 360
    });

    response.type("html").send(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="45" />
    <title>WhatsApp QR</title>
    <style>
      body { align-items: center; background: #f7f4ee; color: #1f1a17; display: grid; font-family: sans-serif; min-height: 100vh; margin: 0; place-items: center; }
      main { background: white; border-radius: 24px; box-shadow: 0 24px 80px rgb(0 0 0 / 12%); max-width: 520px; padding: 40px; text-align: center; }
      .qr { display: inline-block; margin: 24px 0; }
      .qr svg { height: auto; max-width: 100%; width: 360px; }
      p { color: #5f5852; line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <h1>Escanear WhatsApp</h1>
      <div class="qr">${svg}</div>
      <p>Abrí WhatsApp, Dispositivos vinculados y escaneá este QR. La pagina se actualiza cada 45 segundos porque WhatsApp rota el codigo.</p>
    </main>
  </body>
</html>`);
  } catch (error) {
    next(error);
  }
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

const server = app.listen(config.port, () => {
  console.log(`WhatsApp worker listening on ${config.port}`);
});

function shutdown(signal) {
  console.log(`WhatsApp worker received ${signal}. Closing server.`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exit(1);
      return;
    }

    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

initializeWhatsappClient(handleIncomingMessage)
  .then(() => {
    startScheduler();
  })
  .catch((error) => {
    console.error("WhatsApp initialization failed", error);
  });
