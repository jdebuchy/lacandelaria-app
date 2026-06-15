export const config = {
  appApiUrl: process.env.APP_API_URL ?? "http://localhost:3000",
  internalApiSecret: process.env.INTERNAL_API_SECRET ?? "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openRouterMaxTokens: Number(process.env.OPENROUTER_MAX_TOKENS ?? 700),
  openRouterModel: process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini",
  port: Number(process.env.PORT ?? 8080),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  whatsappSessionPath: process.env.WHATSAPP_SESSION_PATH ?? "./.wwebjs_auth",
  workerCronTimezone: process.env.WORKER_CRON_TIMEZONE ?? "America/Argentina/Buenos_Aires"
};

export function assertRequiredConfig() {
  const missing = [];

  if (!config.supabaseUrl) missing.push("SUPABASE_URL");
  if (!config.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!config.internalApiSecret) missing.push("INTERNAL_API_SECRET");

  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}
