import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

let client = null;

function createSupabaseClient() {
  if (!config.supabaseUrl) {
    throw new Error("Missing required Instagram worker config: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!config.supabaseServiceRoleKey) {
    throw new Error("Missing required Instagram worker config: SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}

export function getSupabase() {
  if (!client) {
    client = createSupabaseClient();
  }

  return client;
}

export const supabase = new Proxy({}, {
  get(_target, property) {
    return getSupabase()[property];
  }
});
