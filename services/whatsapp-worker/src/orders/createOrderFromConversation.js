import { config } from "../config.js";

export async function createOrderFromConversation({ conversationId, confirmedPayload, idempotencyKey }) {
  const response = await fetch(`${config.appApiUrl}/api/internal/whatsapp/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-api-secret": config.internalApiSecret
    },
    body: JSON.stringify({
      ...confirmedPayload,
      conversationId,
      idempotencyKey
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message ?? `Order API failed with ${response.status}`);
  }

  return payload;
}
