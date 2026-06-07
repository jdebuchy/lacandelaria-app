import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

if (!config.supabaseUrl) {
  throw new Error("Missing required Instagram worker config: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
}

if (!config.supabaseServiceRoleKey) {
  throw new Error("Missing required Instagram worker config: SUPABASE_SERVICE_ROLE_KEY");
}

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: {
    persistSession: false
  }
});
