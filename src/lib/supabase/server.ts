import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { appConfig } from "@/lib/config";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Server Components must not write cookies.
        // Middleware and route handlers are responsible for session refresh writes.
      }
    }
  });
}
