import express from "express";
import { assertRequiredConfig, config, getMissingConfig } from "./config.js";
import { verifyMetaSignature } from "./metaSignature.js";
import { processMetaWebhook } from "./webhookProcessor.js";

const app = express();

app.use(express.json({
  limit: "2mb",
  verify: (request, _response, buffer) => {
    request.rawBody = buffer;
  }
}));

app.get("/health", (_request, response) => {
  const missingConfig = getMissingConfig();

  response.json({
    automationEnabled: config.enableInstagramAutomation,
    missingConfig,
    ok: true,
    ready: missingConfig.length === 0,
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

  if (!config.metaVerifyToken) {
    response.status(500).send("Missing META_VERIFY_TOKEN");
    return;
  }

  response.status(403).send("Forbidden");
});

app.post("/webhooks/meta", async (request, response, next) => {
  try {
    assertRequiredConfig();

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
