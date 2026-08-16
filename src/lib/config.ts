export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "Paltas La Candelaria",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  internalApiSecret: process.env.INTERNAL_API_SECRET ?? "",
  whatsappWorkerUrl: process.env.WHATSAPP_WORKER_URL ?? ""
};

export function hasSupabaseEnv() {
  return Boolean(appConfig.supabaseUrl && appConfig.supabaseAnonKey);
}

export const botConfig = {
  llmProvider: process.env.BOT_LLM_PROVIDER ?? "claude-cli",
  llmModel: process.env.BOT_LLM_MODEL ?? "claude-opus-5",
  // En Opus 5 el thinking esta activo por defecto y max_tokens acota thinking
  // mas respuesta juntos: con los 700 que usaba el worker, la respuesta se
  // truncaba a la mitad.
  llmMaxTokens: Number(process.env.BOT_LLM_MAX_TOKENS ?? 2000),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  claudeCliPath: process.env.CLAUDE_CLI_PATH ?? "claude",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
  telegramAdminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID ?? "",
  // Lista vacia significa produccion: el gate no filtra a nadie.
  telegramAllowedChatIds: (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
};
