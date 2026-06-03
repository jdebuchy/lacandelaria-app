import { NextRequest, NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth-shared";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = sanitizeRedirectPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?reason=not_registered", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("exchangeCodeForSession failed", error);
    return NextResponse.redirect(new URL("/login?reason=not_registered", request.url));
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
