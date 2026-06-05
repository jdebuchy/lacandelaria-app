import { NextRequest, NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth-shared";
import { createClient } from "@/lib/supabase/server";

function getRedirectOrigin(request: NextRequest, fallbackOrigin: string) {
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (process.env.NODE_ENV !== "development" && forwardedHost) {
    return `https://${forwardedHost}`;
  }

  return fallbackOrigin;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = sanitizeRedirectPath(requestUrl.searchParams.get("next"));
  const redirectOrigin = getRedirectOrigin(request, requestUrl.origin);

  if (!code) {
    return NextResponse.redirect(`${redirectOrigin}/login?reason=not_registered`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("exchangeCodeForSession failed", error);
    return NextResponse.redirect(`${redirectOrigin}/login?reason=not_registered`);
  }

  return NextResponse.redirect(`${redirectOrigin}${nextPath}`);
}
