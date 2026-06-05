import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getRedirectOrigin(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (process.env.NODE_ENV !== "development" && forwardedHost) {
    return `https://${forwardedHost}`;
  }

  return requestUrl.origin;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("signOut failed", error);
  }

  return NextResponse.redirect(`${getRedirectOrigin(request)}/login`, {
    status: 303
  });
}
