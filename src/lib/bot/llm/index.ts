import { botConfig } from "@/lib/config";
import { createAnthropicProvider } from "./anthropic-api";
import { createClaudeCliProvider } from "./claude-cli";
import { createOpenRouterProvider } from "./openrouter";
import type { LlmProvider } from "./types";

export type { LlmProvider, LlmRequest, LlmResult } from "./types";

export function getLlmProvider(): LlmProvider {
  switch (botConfig.llmProvider) {
    case "claude-cli":
      return createClaudeCliProvider();
    case "anthropic-api":
      return createAnthropicProvider();
    case "openrouter":
      return createOpenRouterProvider();
    default:
      throw new Error(`BOT_LLM_PROVIDER desconocido: ${botConfig.llmProvider}`);
  }
}
