import { botConfig } from "@/lib/config";
import type { LlmProvider, LlmRequest, LlmResult } from "./types";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";

type OpenRouterResponse = {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export function createOpenRouterProvider(): LlmProvider {
  return {
    name: "openrouter",
    async complete(request: LlmRequest): Promise<LlmResult> {
      if (!botConfig.openRouterApiKey) {
        throw new Error("Falta OPENROUTER_API_KEY para el proveedor openrouter.");
      }

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botConfig.openRouterApiKey}`,
          "Content-Type": "application/json",
          "X-Title": "Paltas La Candelaria Bot"
        },
        body: JSON.stringify({
          model: botConfig.llmModel,
          temperature: 0.1,
          max_tokens: request.maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter respondio ${response.status}: ${await response.text()}`);
      }

      const payload = (await response.json()) as OpenRouterResponse;

      return {
        text: payload.choices?.[0]?.message?.content ?? "",
        provider: "openrouter",
        model: payload.model ?? botConfig.llmModel,
        inputTokens: payload.usage?.prompt_tokens ?? null,
        outputTokens: payload.usage?.completion_tokens ?? null
      };
    }
  };
}
