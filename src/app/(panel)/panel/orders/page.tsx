import { formatWhatsAppPhone } from "@/lib/contact";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

type RelatedCustomer = {
  full_name?: string | null;
  neighborhood?: string | null;
  phone?: string | null;
  zone?: string | null;
};

type RelatedReseller = {
  full_name?: string | null;
  neighborhood?: string | null;
  phone?: string | null;
  zone?: string | null;
};

function takeSingleRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

function getOrderStatusLabel(status: string) {
  switch (status) {
    case "pending_confirmation":
      return "Pendiente";
    case "confirmed":
      return "Confirmado";
    case "assigned":
      return "Asignado";
    case "in_route":
      return "En ruta";
    case "delivered":
      return "Entregado";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

function getChannelLabel(channel: string) {
  switch (channel) {
    case "public_form":
      return "Formulario";
    case "reseller":
      return "Revendedora";
    case "internal":
      return "Interno";
    default:
      return channel;
  }
}

function getPaymentMethodLabel(method: string) {
  return method === "transfer" ? "Transferencia" : "Efectivo";
}

function getPaymentStatusLabel(status: string) {
  switch (status) {
    case "paid":
      return "Pagado";
    case "partial":
      return "Parcial";
    case "pending":
      return "Pendiente";
    default:
      return status;
  }
}

export default async function OrdersPage() {
  const supabase = createAdminClient();
  const [
    { count: totalOrders },
    { count: pendingOrders },
    { count: inRouteOrders },
    { data: orders }
  ] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_confirmation"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "in_route"),
    supabase
      .from("orders")
      .select(
        `
          id,
          sales_channel,
          quantity_boxes,
          unit_price,
          payment_method_expected,
          payment_status,
          status,
          delivery_date,
          zone,
          notes,
          created_at,
          customers (
            full_name,
            phone,
            neighborhood,
            zone
          ),
          resellers (
            full_name,
            phone,
            neighborhood,
            zone
          )
        `
      )
      .order("created_at", { ascending: false })
  ]);

  const orderRows = (orders ?? []).map((order) => {
    const customer = takeSingleRelation<RelatedCustomer>(order.customers ?? null);
    const reseller = takeSingleRelation<RelatedReseller>(order.resellers ?? null);

    return {
      id: order.id,
      channel: order.sales_channel,
      created_at: order.created_at,
      customerName: customer?.full_name || reseller?.full_name || "Cliente sin nombre",
      customerPhone: customer?.phone || reseller?.phone || "-",
      deliveryDate: order.delivery_date,
      neighborhood: customer?.neighborhood || reseller?.neighborhood || null,
      notes: order.notes,
      paymentMethodExpected: order.payment_method_expected,
      paymentStatus: order.payment_status,
      quantityBoxes: order.quantity_boxes,
      status: order.status,
      totalAmount: Number(order.unit_price) * Number(order.quantity_boxes),
      zone: order.zone || customer?.zone || reseller?.zone || "-"
    };
  });

  return (
    <main>
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
              Pedidos
            </h1>
          </div>
          <Link
            href="/panel/orders/new"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-emerald-400"
          >
            Nuevo pedido
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Pedidos</p>
            <p className="mt-2 text-2xl font-semibold text-amber-300 sm:text-3xl">
              {totalOrders ?? 0}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Pendientes</p>
            <p className="mt-2 text-2xl font-semibold text-sky-300 sm:text-3xl">
              {pendingOrders ?? 0}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">En ruta</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300 sm:text-3xl">
              {inRouteOrders ?? 0}
            </p>
          </article>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-stone-50">Todos los pedidos</h2>
            <span className="text-sm text-stone-500">{orderRows.length}</span>
          </div>

          <div className="hidden overflow-hidden rounded-3xl border border-stone-800 bg-stone-900/70 lg:block">
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_0.9fr_0.8fr_0.9fr_0.8fr] border-b border-stone-800 bg-stone-900 px-4 py-3 text-xs uppercase tracking-[0.18em] text-stone-400">
              <div>Cliente</div>
              <div>Canal</div>
              <div>Zona</div>
              <div>Estado</div>
              <div>Cobranza</div>
              <div>Cajas</div>
              <div>Total</div>
              <div>Alta</div>
            </div>
            {orderRows.length ? (
              orderRows.map((order) => (
                <div
                  key={order.id}
                  className="grid grid-cols-[1.5fr_1fr_1fr_1fr_0.9fr_0.8fr_0.9fr_0.8fr] border-b border-stone-800 px-4 py-4 text-sm text-stone-300 last:border-b-0 hover:bg-stone-900/50"
                >
                  <div>
                    <p className="font-medium text-stone-100">{order.customerName}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {formatWhatsAppPhone(order.customerPhone)}
                    </p>
                  </div>
                  <div>{getChannelLabel(order.channel)}</div>
                  <div>{[order.neighborhood, order.zone].filter(Boolean).join(" · ")}</div>
                  <div>{getOrderStatusLabel(order.status)}</div>
                  <div>
                    <p>{getPaymentStatusLabel(order.paymentStatus)}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {getPaymentMethodLabel(order.paymentMethodExpected)}
                    </p>
                  </div>
                  <div>{order.quantityBoxes}</div>
                  <div>${order.totalAmount.toLocaleString("es-AR")}</div>
                  <div>{formatDate(order.created_at)}</div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-stone-500">
                Todavia no hay pedidos cargados.
              </div>
            )}
          </div>

          <div className="space-y-3 lg:hidden">
            {orderRows.length ? (
              orderRows.map((order) => (
                <article
                  key={order.id}
                  className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-stone-50">{order.customerName}</p>
                      <p className="mt-1 text-sm text-stone-400">
                        {formatWhatsAppPhone(order.customerPhone)}
                      </p>
                    </div>
                    <span className="rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-300">
                      {getChannelLabel(order.channel)}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-stone-300">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Estado</p>
                      <p className="mt-1 text-stone-200">{getOrderStatusLabel(order.status)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Cobranza</p>
                      <p className="mt-1 text-stone-200">{getPaymentStatusLabel(order.paymentStatus)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Zona</p>
                      <p className="mt-1 text-stone-200">
                        {[order.neighborhood, order.zone].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Total</p>
                      <p className="mt-1 text-stone-200">
                        {order.quantityBoxes} caja(s) · ${order.totalAmount.toLocaleString("es-AR")}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/70 px-4 py-8 text-center text-sm text-stone-500">
                Todavia no hay pedidos cargados.
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
