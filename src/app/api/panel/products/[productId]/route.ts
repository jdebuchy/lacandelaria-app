import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import {
  getProductCatalogDbErrorMessage,
  productFamilyMutationSchema,
  syncCatalogFamily
} from "@/lib/products";
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
  const parsed = productFamilyMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Producto invalido." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { familyId, error } = await syncCatalogFamily(supabase, parsed.data, parsedParams.data.productId);

  if (error || !familyId) {
    if (error) {
      console.error("product family update failed", error);
    }

    const status = error?.code === "23505" ? 409 : 500;
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

export async function DELETE(
  _request: Request,
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

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("product_families")
    .delete()
    .eq("id", parsedParams.data.productId);

  if (error) {
    console.error("product family delete failed", error);

    if (error.code === "23503") {
      return NextResponse.json(
        {
          success: false,
          message: "No se puede borrar el producto porque tiene pedidos o composiciones asociadas."
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "No se pudo borrar el producto." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Producto borrado correctamente."
  });
}
