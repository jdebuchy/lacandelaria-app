import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth-shared";
import { appConfig } from "@/lib/config";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = sanitizeRedirectPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?reason=not_registered", request.url));
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url));
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

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("exchangeCodeForSession failed", error);
    return NextResponse.redirect(new URL("/login?reason=not_registered", request.url));
  }

  return response;
}
