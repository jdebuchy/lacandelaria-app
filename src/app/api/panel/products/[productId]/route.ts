import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { getProductCatalogDbErrorMessage, productMutationSchema } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_ONLY = ["admin"] as const;

const paramsSchema = z.object({
  productId: z.string().uuid()
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ productId: string }> }
) {
  const authResult = await requireApiRole(ADMIN_ONLY);

  if ("error" in authResult) {
    return authResult.error;
  }

  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json(
      { success: false, message: "Producto invalido." },
      { status: 400 }
    );
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
  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name.trim(),
      slug: parsed.data.slug.trim(),
      description: parsed.data.description?.trim() || null,
      sales_unit_label: parsed.data.salesUnitLabel.trim(),
      cash_price: parsed.data.cashPrice,
      transfer_price: parsed.data.transferPrice,
      active: parsed.data.active,
      display_order: parsed.data.displayOrder
    })
    .eq("id", parsedParams.data.productId);

  if (error) {
    console.error("product update failed", error);

    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json(
      { success: false, message: getProductCatalogDbErrorMessage(error, "update") },
      { status }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Producto actualizado correctamente."
  });
}
