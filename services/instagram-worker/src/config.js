export const config = {
  enableInstagramAutomation: process.env.ENABLE_INSTAGRAM_AUTOMATION === "true",
  metaAppId: process.env.META_APP_ID ?? "",
  metaAppSecret: process.env.META_APP_SECRET ?? "",
  metaGraphApiVersion: process.env.META_GRAPH_API_VERSION ?? "v23.0",
  metaInstagramAccountId: process.env.META_INSTAGRAM_ACCOUNT_ID ?? "",
  metaPageAccessToken: process.env.META_PAGE_ACCESS_TOKEN ?? "",
  metaVerifyToken: process.env.META_VERIFY_TOKEN ?? "",
  port: Number(process.env.PORT ?? 8080),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
};

export function assertRequiredConfig() {
  const missing = [];

  for (const key of ["metaAppSecret", "metaVerifyToken", "supabaseServiceRoleKey", "supabaseUrl"]) {
    if (!config[key]) {
      missing.push(key);
    }
  }

  if (missing.length) {
    throw new Error(`Missing required Instagram worker config: ${missing.join(", ")}`);
  }
}
