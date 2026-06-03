import { NextResponse } from "next/server";
import { APP_NAME } from "@/lib/constants";
import { hasSupabaseEnv } from "@/lib/config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: APP_NAME,
    supabaseConfigured: hasSupabaseEnv()
  });
}
