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
      setAll(cookiesToSet) {
        // In Server Components, Next.js exposes a read-only cookie store.
        // Session refresh writes are handled by middleware and route handlers.
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {}
      }
    }
  });
}
