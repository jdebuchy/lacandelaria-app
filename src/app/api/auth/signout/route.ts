import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
    { status: 303 }
  );
  const supabase = createServerClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("signOut failed", error);
  }

  return response;
}
