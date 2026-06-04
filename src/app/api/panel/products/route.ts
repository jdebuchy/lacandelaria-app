import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import {
  getProductCatalogDbErrorMessage,
  mapProductRow,
  PRODUCT_SELECT_COLUMNS,
  productMutationSchema,
  productSchema
} from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_ONLY = ["admin"] as const;

export async function GET() {
  const authResult = await requireApiRole(ADMIN_ONLY);

  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(`${PRODUCT_SELECT_COLUMNS}, created_at`)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("products load failed", error);
    return NextResponse.json(
      { success: false, message: getProductCatalogDbErrorMessage(error, "load") },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    products: (data ?? []).map((row) => {
      const parsed = productSchema.parse(row);
      return {
        id: parsed.id,
        name: parsed.name,
        slug: parsed.slug,
        description: parsed.description ?? null,
        salesUnitLabel: mapProductRow(parsed).salesUnitLabel,
        cashPrice: Number(parsed.cash_price),
        transferPrice: Number(parsed.transfer_price),
        active: parsed.active,
        displayOrder: parsed.display_order
      };
    })
  });
}

export async function POST(request: Request) {
  const authResult = await requireApiRole(ADMIN_ONLY);

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = productMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Producto invalido." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: parsed.data.name.trim(),
      slug: parsed.data.slug.trim(),
      description: parsed.data.description?.trim() || null,
      sales_unit_label: parsed.data.salesUnitLabel.trim(),
      cash_price: parsed.data.cashPrice,
      transfer_price: parsed.data.transferPrice,
      active: parsed.data.active,
      display_order: parsed.data.displayOrder
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error) {
      console.error("product create failed", error);
    }

    const status = error?.code === "23505" ? 409 : 500;
    return NextResponse.json(
      { success: false, message: getProductCatalogDbErrorMessage(error, "create") },
      { status }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Producto creado correctamente.",
    productId: data.id
  });
}
