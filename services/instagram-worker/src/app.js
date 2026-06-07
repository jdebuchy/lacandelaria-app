import express from "express";
import { assertRequiredConfig, config } from "./config.js";
import { verifyMetaSignature } from "./metaSignature.js";
import { processMetaWebhook } from "./webhookProcessor.js";

assertRequiredConfig();

const app = express();

app.use(express.json({
  limit: "2mb",
  verify: (request, _response, buffer) => {
    request.rawBody = buffer;
  }
}));

app.get("/health", (_request, response) => {
  response.json({
    automationEnabled: config.enableInstagramAutomation,
    ok: true,
    service: "instagram-worker"
  });
});

app.get("/webhooks/meta", (request, response) => {
  const mode = request.query["hub.mode"];
  const token = request.query["hub.verify_token"];
  const challenge = request.query["hub.challenge"];

  if (mode === "subscribe" && token === config.metaVerifyToken && typeof challenge === "string") {
    response.status(200).send(challenge);
    return;
  }

  response.status(403).send("Forbidden");
});

app.post("/webhooks/meta", async (request, response, next) => {
  try {
    if (!verifyMetaSignature(request)) {
      response.status(401).json({ success: false, message: "Invalid Meta signature." });
      return;
    }

    const result = await processMetaWebhook({
      body: request.body,
      headers: request.headers
    });

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({
    success: false,
    message: error instanceof Error ? error.message : "Instagram worker error."
  });
});

const server = app.listen(config.port, () => {
  console.log(`Instagram worker listening on ${config.port}`);
});

function shutdown(signal) {
  console.log(`Instagram worker received ${signal}. Closing server.`);
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
