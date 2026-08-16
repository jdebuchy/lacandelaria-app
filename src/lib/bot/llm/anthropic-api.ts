import { botConfig } from "@/lib/config";
import type { LlmProvider, LlmRequest, LlmResult } from "./types";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

type AnthropicResponse = {
  model?: string;
  stop_reason?: string;
  stop_details?: { category?: string | null } | null;
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

// effort y el thinking adaptativo no existen en Haiku 4.5: mandarlos devuelve 400.
function supportsEffort(model: string) {
  return !model.includes("haiku");
}

export function createAnthropicProvider(): LlmProvider {
  return {
    name: "anthropic-api",
    async complete(request: LlmRequest): Promise<LlmResult> {
      if (!botConfig.anthropicApiKey) {
        throw new Error("Falta ANTHROPIC_API_KEY para el proveedor anthropic-api.");
      }

      const model = botConfig.llmModel;

      const body: Record<string, unknown> = {
        model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: [{ role: "user", content: request.user }]
      };

      const outputConfig: Record<string, unknown> = {};

      if (request.jsonSchema) {
        outputConfig.format = { type: "json_schema", schema: request.jsonSchema };
      }

      if (supportsEffort(model)) {
        // Clasificar una intencion no necesita razonamiento profundo, y el
        // effort bajo recorta latencia y tokens sin perder precision aca.
        outputConfig.effort = "low";
      }

      if (Object.keys(outputConfig).length > 0) {
        body.output_config = outputConfig;
      }

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "x-api-key": botConfig.anthropicApiKey,
          "anthropic-version": API_VERSION,
          "content-type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Anthropic respondio ${response.status}: ${await response.text()}`);
      }

      const payload = (await response.json()) as AnthropicResponse;

      // Los clasificadores de seguridad pueden declinar con HTTP 200 y content
      // vacio. Devolvemos texto vacio a proposito: parseAnalysis cae en su
      // fallback y el motor deriva a humano, que es lo que corresponde.
      if (payload.stop_reason === "refusal") {
        return {
          text: "",
          provider: "anthropic-api",
          model: payload.model ?? model,
          inputTokens: payload.usage?.input_tokens ?? null,
          outputTokens: payload.usage?.output_tokens ?? null
        };
      }

      const text = (payload.content ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("");

      return {
        text,
        provider: "anthropic-api",
        model: payload.model ?? model,
        inputTokens: payload.usage?.input_tokens ?? null,
        outputTokens: payload.usage?.output_tokens ?? null
      };
    }
  };
}
