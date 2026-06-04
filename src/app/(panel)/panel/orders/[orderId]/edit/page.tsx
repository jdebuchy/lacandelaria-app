import { notFound } from "next/navigation";
import { ManualOrderForm, type CustomerMatch } from "@/components/manual-order-form";
import { EMPTY_STRUCTURED_ADDRESS } from "@/lib/address";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderItemInput, Product } from "@/lib/types";

function mapProducts(rows: Array<Record<string, unknown>>): Product[] {
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: typeof row.description === "string" ? row.description : null,
    salesUnitLabel: String(row.sales_unit_label),
    cashPrice: Number(row.cash_price),
    transferPrice: Number(row.transfer_price),
    active: Boolean(row.active),
    displayOrder: Number(row.display_order ?? 0)
  }));
}

type Params = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function EditOrderPage(context: Params) {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/orders");
  const { orderId } = await context.params;
  const supabase = createAdminClient();

  const [{ data: products }, { data: order }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, slug, description, sales_unit_label, cash_price, transfer_price, active, display_order")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("orders")
      .select(
        `
          id,
          payment_method_expected,
          delivery_date,
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
      .single()
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

  return (
    <main>
      <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
            Editar pedido
          </h1>
        </div>

        <ManualOrderForm
          mode="edit"
          orderId={orderId}
          products={mapProducts(products ?? [])}
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
            notes: typeof order.notes === "string" ? order.notes : ""
          }}
        />
      </section>
    </main>
  );
}
