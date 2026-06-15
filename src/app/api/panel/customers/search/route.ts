import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { matchesNormalizedSearchValues } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const authResult = await requireApiRole(PANEL_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  const safeQ = q.replace(/[,()]/g, "");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, first_name, last_name, phone, instagram, address_kind, address_line_1, address_line_2, gated_community_name, locality, administrative_area_level_1, postal_code, google_place_id, google_place_label, address_source, delivery_area, delivery_notes"
    )
    .or(`first_name.ilike.%${safeQ}%,last_name.ilike.%${safeQ}%,phone.ilike.%${safeQ}%,instagram.ilike.%${safeQ}%`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("customer search failed", error);
    return NextResponse.json({ customers: [] }, { status: 500 });
  }

  const customers = (data ?? [])
    .filter((customer) =>
      matchesNormalizedSearchValues(
        [
          customer.first_name,
          customer.last_name,
          `${customer.first_name ?? ""} ${customer.last_name ?? ""}`,
          customer.phone,
          customer.instagram
        ],
        safeQ
      )
    )
    .slice(0, 8);

  if (customers.length === 8 || !safeQ) {
    return NextResponse.json({ customers });
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("customers")
    .select(
      "id, first_name, last_name, phone, instagram, address_kind, address_line_1, address_line_2, gated_community_name, locality, administrative_area_level_1, postal_code, google_place_id, google_place_label, address_source, delivery_area, delivery_notes"
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  if (fallbackError) {
    console.error("customer normalized search failed", fallbackError);
    return NextResponse.json({ customers });
  }

  const seenIds = new Set(customers.map((customer) => customer.id));
  const fallbackCustomers = (fallbackData ?? [])
    .filter((customer) => !seenIds.has(customer.id))
    .filter((customer) =>
      matchesNormalizedSearchValues(
        [
          customer.first_name,
          customer.last_name,
          `${customer.first_name ?? ""} ${customer.last_name ?? ""}`,
          customer.phone,
          customer.instagram
        ],
        safeQ
      )
    );

  return NextResponse.json({ customers: [...customers, ...fallbackCustomers].slice(0, 8) });
}
