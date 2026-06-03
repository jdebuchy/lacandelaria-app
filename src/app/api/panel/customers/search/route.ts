import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  const safeQ = q.replace(/[,()]/g, "");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, phone, address, neighborhood, zone, delivery_notes")
    .or(`full_name.ilike.%${safeQ}%,phone.ilike.%${safeQ}%`)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("customer search failed", error);
    return NextResponse.json({ customers: [] }, { status: 500 });
  }

  return NextResponse.json({ customers: data ?? [] });
}
