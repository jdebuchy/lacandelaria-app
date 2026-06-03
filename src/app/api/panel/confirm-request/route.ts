import { NextResponse } from "next/server";
import { z } from "zod";
import { BUSINESS_RULES } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";

const confirmSchema = z.object({
  requestId: z.string().uuid()
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = confirmSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Solicitud invalida." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: publicRequest, error: requestError } = await supabase
    .from("public_order_requests")
    .select("*")
    .eq("id", parsed.data.requestId)
    .single();

  if (requestError || !publicRequest) {
    return NextResponse.json(
      { success: false, message: "No se encontro la solicitud." },
      { status: 404 }
    );
  }

  if (publicRequest.converted_order_id) {
    return NextResponse.json({
      success: true,
      message: "La solicitud ya estaba convertida."
    });
  }

  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", publicRequest.phone)
    .limit(1)
    .maybeSingle();

  let customerId = existingCustomer?.id ?? null;

  if (!customerId) {
    const { data: newCustomer, error: customerError } = await supabase
      .from("customers")
      .insert({
        full_name: publicRequest.full_name,
        phone: publicRequest.phone,
        address: publicRequest.address,
        neighborhood: publicRequest.neighborhood,
        zone: publicRequest.zone,
        source: publicRequest.lead_source
      })
      .select("id")
      .single();

    if (customerError || !newCustomer) {
      console.error("customer insert failed", customerError);
      return NextResponse.json(
        { success: false, message: "No se pudo crear el cliente." },
        { status: 500 }
      );
    }

    customerId = newCustomer.id;
  }

  const unitPrice =
    publicRequest.payment_method_expected === "cash"
      ? BUSINESS_RULES.cashPrice
      : BUSINESS_RULES.transferPrice;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: customerId,
      sales_channel: "public_form",
      quantity_boxes: publicRequest.quantity_boxes,
      unit_price: unitPrice,
      payment_method_expected: publicRequest.payment_method_expected,
      status: "confirmed",
      payment_status: "pending",
      zone: publicRequest.zone,
      notes: publicRequest.notes
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("order insert failed", orderError);
    return NextResponse.json(
      { success: false, message: "No se pudo crear el pedido interno." },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabase
    .from("public_order_requests")
    .update({
      status: "converted",
      converted_order_id: order.id
    })
    .eq("id", publicRequest.id);

  if (updateError) {
    console.error("public request update failed", updateError);
    return NextResponse.json(
      { success: false, message: "Se creo el pedido pero no se pudo cerrar la solicitud." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Solicitud confirmada y convertida en pedido."
  });
}
