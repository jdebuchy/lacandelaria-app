import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";

export function createAdminClient() {
  return createClient(appConfig.supabaseUrl, appConfig.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
