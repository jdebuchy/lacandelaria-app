import { notFound } from "next/navigation";
import { ManualOrderForm, type CustomerMatch } from "@/components/manual-order-form";
import { EMPTY_STRUCTURED_ADDRESS } from "@/lib/address";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { canEditOrder, getOrderStatusLabel } from "@/lib/delivery-trips";
import { loadCatalog } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderItemInput } from "@/lib/types";

type Params = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function EditOrderPage(context: Params) {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/orders");
  const { orderId } = await context.params;
  const supabase = createAdminClient();

  const [{ data: products }, { data: order }, { data: activeTripOrder }] = await Promise.all([
    loadCatalog(supabase, {
      onlyActiveFamilies: true,
      onlySellableVariants: true,
      onlyActiveVariants: true
    }),
    supabase
      .from("orders")
      .select(
        `
          id,
          status,
          payment_method_expected,
          delivery_date,
          delivery_window_start,
          delivery_window_end,
          notes,
          customers (
            id,
            first_name,
            last_name,
            phone,
            instagram,
            address_kind,
            address_line_1,
            address_line_2,
            gated_community_name,
            locality,
            administrative_area_level_1,
            postal_code,
            google_place_id,
            google_place_label,
            address_source,
            delivery_area,
            delivery_notes
          ),
          order_items (
            product_id,
            quantity
          )
        `
      )
      .eq("id", orderId)
      .single(),
    supabase
      .from("delivery_trip_orders")
      .select(
        `
          delivery_trip_id,
          delivery_trips (
            id,
            scheduled_date,
            status
          )
        `
      )
      .eq("order_id", orderId)
      .is("released_at", null)
      .limit(1)
      .maybeSingle()
  ]);

  if (!order) {
    notFound();
  }

  const customerRelation = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  const customer = customerRelation
    ? ({
        id: String(customerRelation.id),
        first_name: String(customerRelation.first_name ?? ""),
        last_name: typeof customerRelation.last_name === "string" ? customerRelation.last_name : null,
        phone: typeof customerRelation.phone === "string" ? customerRelation.phone : null,
        instagram: typeof customerRelation.instagram === "string" ? customerRelation.instagram : null,
        address_kind: customerRelation.address_kind === "gated" ? "gated" : "standard",
        address_line_1:
          typeof customerRelation.address_line_1 === "string" ? customerRelation.address_line_1 : null,
        address_line_2:
          typeof customerRelation.address_line_2 === "string" ? customerRelation.address_line_2 : null,
        gated_community_name:
          typeof customerRelation.gated_community_name === "string"
            ? customerRelation.gated_community_name
            : null,
        locality: typeof customerRelation.locality === "string" ? customerRelation.locality : null,
        administrative_area_level_1:
          typeof customerRelation.administrative_area_level_1 === "string"
            ? customerRelation.administrative_area_level_1
            : null,
        postal_code: typeof customerRelation.postal_code === "string" ? customerRelation.postal_code : null,
        google_place_id:
          typeof customerRelation.google_place_id === "string" ? customerRelation.google_place_id : null,
        google_place_label:
          typeof customerRelation.google_place_label === "string"
            ? customerRelation.google_place_label
            : null,
        address_source:
          customerRelation.address_source === "google_places" ? "google_places" : "manual",
        delivery_area:
          typeof customerRelation.delivery_area === "string" ? customerRelation.delivery_area : null,
        delivery_notes:
          typeof customerRelation.delivery_notes === "string" ? customerRelation.delivery_notes : null
      } satisfies CustomerMatch)
    : null;

  const items = ((order.order_items ?? []) as Array<{ product_id: string; quantity: number }>).map(
    (item) =>
      ({
        productId: item.product_id,
        quantity: Number(item.quantity)
      }) satisfies OrderItemInput
  );

  const tripRelation = Array.isArray(activeTripOrder?.delivery_trips)
    ? activeTripOrder?.delivery_trips[0]
    : activeTripOrder?.delivery_trips;
  const orderIsEditable = canEditOrder(order.status, Boolean(activeTripOrder?.delivery_trip_id));

  return (
    <main>
      <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
            Editar pedido
          </h1>
        </div>

        {!orderIsEditable ? (
          <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-6 text-sm text-amber-100">
            <p className="font-medium">Este pedido no se puede editar.</p>
            <p className="mt-2 text-amber-200/90">
              Estado actual: {getOrderStatusLabel(order.status)}.
              {tripRelation
                ? ` Está asignado al viaje del ${new Date(tripRelation.scheduled_date).toLocaleDateString("es-AR")}.`
                : ""}
            </p>
          </div>
        ) : (
          <ManualOrderForm
            mode="edit"
            orderId={orderId}
            products={products ?? []}
            initialData={{
              customer,
              firstName: customer?.first_name ?? "",
              lastName: customer?.last_name ?? "",
              phone: customer?.phone ?? "",
              instagram: customer?.instagram ?? "",
              address: customer
                ? {
                    addressKind: customer.address_kind,
                    addressLine1: customer.address_line_1 ?? "",
                    addressLine2: customer.address_line_2 ?? "",
                    gatedCommunityName: customer.gated_community_name ?? "",
                    locality: customer.locality ?? "",
                    administrativeAreaLevel1: customer.administrative_area_level_1 ?? "",
                    postalCode: customer.postal_code ?? "",
                    googlePlaceId: customer.google_place_id ?? "",
                    googlePlaceLabel: customer.google_place_label ?? "",
                    addressSource: customer.address_source ?? "manual"
                  }
                : EMPTY_STRUCTURED_ADDRESS,
              deliveryNotes: customer?.delivery_notes ?? "",
              items,
              paymentMethodExpected: order.payment_method_expected === "transfer" ? "transfer" : "cash",
              deliveryDate: typeof order.delivery_date === "string" ? order.delivery_date : "",
              deliveryWindowStart:
                typeof order.delivery_window_start === "string" ? order.delivery_window_start : "",
              deliveryWindowEnd:
                typeof order.delivery_window_end === "string" ? order.delivery_window_end : "",
              notes: typeof order.notes === "string" ? order.notes : ""
            }}
          />
        )}
      </section>
    </main>
  );
}
