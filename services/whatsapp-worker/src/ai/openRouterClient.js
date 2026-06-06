import { config } from "../config.js";

export async function callOpenRouter(messages) {
  if (!config.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": config.appApiUrl,
      "X-Title": "Paltas La Candelaria WhatsApp Worker"
    },
    body: JSON.stringify({
      max_tokens: config.openRouterMaxTokens,
      messages,
      model: config.openRouterModel,
      response_format: { type: "json_object" },
      temperature: 0.1
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenRouter returned empty content.");
  }

  return JSON.parse(content);
}
