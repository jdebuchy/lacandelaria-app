import { ConfirmRequestButton } from "@/components/confirm-request-button";
import { formatStructuredAddressSummary } from "@/lib/address";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatPersonName, formatWhatsAppPhone } from "@/lib/contact";
import { formatItemsSummary } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";

const columns = ["Cliente", "Telefono", "Ítems", "Pago esperado", "Estado", "Acción"];

type RequestItem = {
  product_name_snapshot: string;
  sales_unit_label_snapshot: string;
  quantity: number;
};

type RelatedCustomer = {
  address_kind?: "standard" | "gated" | null;
  address_line_1?: string | null;
  administrative_area_level_1?: string | null;
  delivery_notes?: string | null;
  delivery_area?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  gated_community_name?: string | null;
  locality?: string | null;
  phone?: string | null;
};

type RelatedReseller = {
  full_name?: string | null;
  phone?: string | null;
};

type RelatedOrderItem = {
  product_name_snapshot: string;
  sales_unit_label_snapshot: string;
  quantity: number;
};

function takeSingleRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function BackofficePage() {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel");
  const supabase = createAdminClient();
  const [
    { data: requests },
    { count: pendingCount },
    { count: convertedCount },
    { count: orderCount },
    { count: productCount },
    { data: orders }
  ] = await Promise.all([
    supabase
      .from("public_order_requests")
      .select(
        `
          *,
          public_order_request_items (
            product_name_snapshot,
            sales_unit_label_snapshot,
            quantity
          )
        `
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("public_order_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("public_order_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "converted"),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase
      .from("product_variants")
      .select("*", { count: "exact", head: true })
      .eq("active", true)
      .eq("visibility", "sellable"),
    supabase
      .from("orders")
      .select(
        `
          id,
          items_count,
          total_amount,
          payment_method_expected,
          payment_status,
          status,
          delivery_date,
          delivery_area,
          notes,
          customers (
            first_name,
            last_name,
            phone,
            address_kind,
            address_line_1,
            locality,
            administrative_area_level_1,
            gated_community_name,
            delivery_area,
            delivery_notes
          ),
          resellers (
            full_name,
            phone
          ),
          order_items (
            product_name_snapshot,
            sales_unit_label_snapshot,
            quantity
          )
        `
      )
      .order("created_at", { ascending: false })
      .limit(12)
  ]);

  const rows = requests ?? [];
  const logisticsOrders = (orders ?? []).map((order) => {
    const customer = takeSingleRelation<RelatedCustomer>(order.customers ?? null);
    const reseller = takeSingleRelation<RelatedReseller>(order.resellers ?? null);
    const items = (order.order_items ?? []) as RelatedOrderItem[];

    return {
      id: order.id,
      customerName: customer
        ? formatPersonName(customer.first_name, customer.last_name)
        : reseller?.full_name || "Cliente sin nombre",
      customerPhone: customer?.phone || reseller?.phone || "-",
      deliveryDate: order.delivery_date,
      notes: order.notes || customer?.delivery_notes || null,
      paymentMethodExpected: order.payment_method_expected,
      paymentStatus: order.payment_status,
      itemsCount: Number(order.items_count ?? 0),
      itemsSummary: formatItemsSummary(items),
      resellerName: reseller?.full_name || null,
      status: order.status,
      totalAmount: Number(order.total_amount ?? 0),
      deliveryArea: order.delivery_area || customer?.delivery_area || "pending_review",
      addressSummary: customer
        ? formatStructuredAddressSummary({
            addressKind: customer.address_kind ?? "standard",
            addressLine1: customer.address_line_1 ?? "",
            gatedCommunityName: customer.gated_community_name ?? "",
            locality: customer.locality ?? ""
          })
        : "-"
    };
  });

  return (
    <main>
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-12">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-200">
            Centro de operación
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
            Pedidos, catálogo y operación diaria
          </h1>
          <p className="max-w-3xl text-base leading-7 text-stone-300">
            Vista interna para revisar solicitudes públicas, monitorear pedidos y validar que el
            catálogo multi-producto esté listo para vender.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Por confirmar</p>
            <p className="mt-2 text-2xl font-semibold text-amber-300 sm:text-3xl">{pendingCount ?? 0}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Solicitudes convertidas</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300 sm:text-3xl">{convertedCount ?? 0}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Pedidos internos</p>
            <p className="mt-2 text-2xl font-semibold text-sky-300 sm:text-3xl">{orderCount ?? 0}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Productos activos</p>
            <p className="mt-2 text-2xl font-semibold text-rose-300 sm:text-3xl">{productCount ?? 0}</p>
          </article>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {logisticsOrders.map((order) => (
            <article key={order.id} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-stone-50">{order.customerName}</p>
                  <p className="mt-1 text-sm text-stone-400">{order.customerPhone}</p>
                </div>
                <span className="rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-300">
                  {order.status}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="rounded-2xl bg-stone-950/80 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Ítems</p>
                  <p className="mt-1 text-stone-200">{order.itemsSummary}</p>
                </div>
                <div className="rounded-2xl bg-stone-950/80 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Total</p>
                  <p className="mt-1 text-stone-200">${order.totalAmount.toLocaleString("es-AR")}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-stone-500">{order.addressSummary}</p>
            </article>
          ))}
        </section>

        <div className="space-y-3 md:hidden">
          {rows.length ? (
            rows.map((row) => (
              <article key={row.id} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-stone-50">
                      {formatPersonName(row.first_name, row.last_name)}
                    </p>
                    <p className="mt-1 text-sm text-stone-400">{formatWhatsAppPhone(row.phone)}</p>
                  </div>
                  <span className="rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-300">
                    {row.status}
                  </span>
                </div>
                <div className="mt-4 rounded-2xl bg-stone-950/70 p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Ítems</p>
                  <p className="mt-1 text-stone-200">
                    {formatItemsSummary((row.public_order_request_items ?? []) as RequestItem[])}
                  </p>
                </div>
                <div className="mt-4">
                  <ConfirmRequestButton
                    requestId={row.id}
                    disabled={row.status === "converted" || Boolean(row.converted_order_id)}
                    disabledLabel="Ya confirmado"
                  />
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-6 text-sm text-stone-400">
              Todavía no hay solicitudes públicas.
            </div>
          )}
        </div>

        <div className="hidden overflow-hidden rounded-3xl border border-stone-800 bg-stone-900/70 md:block">
          <div className="grid grid-cols-6 border-b border-stone-800 bg-stone-900 px-4 py-3 text-xs uppercase tracking-[0.18em] text-stone-400">
            {columns.map((column) => (
              <div key={column}>{column}</div>
            ))}
          </div>
          {rows.length ? (
            rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-6 border-b border-stone-800 px-4 py-4 text-sm text-stone-300 last:border-b-0"
              >
                <div>{formatPersonName(row.first_name, row.last_name)}</div>
                <div>{formatWhatsAppPhone(row.phone)}</div>
                <div>{formatItemsSummary((row.public_order_request_items ?? []) as RequestItem[])}</div>
                <div>
                  {row.payment_method_expected === "cash"
                    ? "Efectivo"
                    : row.payment_method_expected === "transfer"
                      ? "Transferencia"
                      : "No definido"}
                </div>
                <div>{row.status}</div>
                <div>
                  <ConfirmRequestButton
                    requestId={row.id}
                    disabled={row.status === "converted" || Boolean(row.converted_order_id)}
                    disabledLabel="Ya confirmado"
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-stone-400">Todavía no hay solicitudes públicas.</div>
          )}
        </div>
      </section>
    </main>
  );
}
