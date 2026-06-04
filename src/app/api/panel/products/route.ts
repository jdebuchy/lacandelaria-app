import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import {
  getProductCatalogDbErrorMessage,
  loadCatalog,
  productFamilyMutationSchema,
  syncCatalogFamily
} from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_ONLY = ["admin"] as const;

export async function GET() {
  const authResult = await requireApiRole(ADMIN_ONLY);

  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = createAdminClient();
  const { data, error } = await loadCatalog(supabase);

  if (error) {
    console.error("products load failed", error);
    return NextResponse.json(
      { success: false, message: getProductCatalogDbErrorMessage(error, "load") },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    products: data ?? []
  });
}

export async function POST(request: Request) {
  const authResult = await requireApiRole(ADMIN_ONLY);

  if ("error" in authResult) {
    return authResult.error;
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
  const { familyId, error } = await syncCatalogFamily(supabase, parsed.data);

  if (error || !familyId) {
    if (error) {
      console.error("product family create failed", error);
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
    productId: familyId
  });
}
