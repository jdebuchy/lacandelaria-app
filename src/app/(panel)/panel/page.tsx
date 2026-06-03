import { ConfirmRequestButton } from "@/components/confirm-request-button";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUSINESS_RULES } from "@/lib/constants";
import { formatWhatsAppPhone } from "@/lib/contact";
import {
  getLogisticsFlowGuidance,
  getLogisticsFlowLabel,
  getLogisticsFlowTone,
  inferLogisticsFlow,
  isActiveLogisticsStatus
} from "@/lib/logistics";

const columns = ["Cliente", "Telefono", "Zona", "Pago esperado", "Estado", "Accion"];

type RelatedCustomer = {
  address?: string | null;
  delivery_notes?: string | null;
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

export default async function BackofficePage() {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel");
  const supabase = createAdminClient();
  const [
    { data: requests },
    { count: pendingCount },
    { count: convertedCount },
    { count: orderCount },
    { data: orders }
  ] =
    await Promise.all([
      supabase
        .from("public_order_requests")
        .select("*")
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
        .from("orders")
        .select(
          `
            id,
            sales_channel,
            reseller_id,
            quantity_boxes,
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
              address,
              neighborhood,
              zone,
              delivery_notes
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
        .limit(24)
    ]);

  const rows = requests ?? [];
  const logisticsOrders = (orders ?? [])
    .map((order) => {
      const customer = takeSingleRelation<RelatedCustomer>(order.customers ?? null);
      const reseller = takeSingleRelation<RelatedReseller>(order.resellers ?? null);
      const flow = inferLogisticsFlow({
        address: customer?.address,
        neighborhood: customer?.neighborhood,
        resellerId: order.reseller_id,
        salesChannel: order.sales_channel,
        zone: order.zone || customer?.zone || reseller?.zone
      });

      return {
        id: order.id,
        customerName: customer?.full_name || "Cliente sin nombre",
        customerPhone: customer?.phone || reseller?.phone || "-",
        deliveryDate: order.delivery_date,
        flow,
        notes: order.notes || customer?.delivery_notes || null,
        paymentMethodExpected: order.payment_method_expected,
        paymentStatus: order.payment_status,
        quantityBoxes: order.quantity_boxes,
        resellerName: reseller?.full_name || null,
        status: order.status,
        zone: order.zone || customer?.zone || customer?.neighborhood || reseller?.zone || reseller?.neighborhood || "-"
      };
    })
    .filter((order) => isActiveLogisticsStatus(order.status));

  const cabaOrders = logisticsOrders.filter((order) => order.flow === "capital_federal");
  const resellerOrders = logisticsOrders.filter((order) => order.flow === "reseller");
  const standardOrders = logisticsOrders.filter((order) => order.flow === "standard");
  const urgentOrders = logisticsOrders.filter(
    (order) => order.status === "confirmed" || order.status === "assigned"
  );

  return (
    <main>
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-12">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-200">
            Centro de operacion
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
            Pedidos, usuarios y operacion diaria
          </h1>
          <p className="max-w-3xl text-base leading-7 text-stone-300">
            Pantalla interna de administracion. Aca se revisan solicitudes, se convierten en
            pedidos, se sigue la operacion y despues se restringe cada modulo segun el rol del
            usuario.
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
            <p className="text-sm text-stone-400">Precio efectivo</p>
            <p className="mt-2 text-xl font-semibold text-rose-300 sm:text-3xl">
              ${BUSINESS_RULES.cashPrice.toLocaleString("es-AR")}
            </p>
          </article>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <a
            href="/panel/orders"
            className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5 transition hover:border-sky-400/40 hover:bg-stone-900"
          >
            <p className="text-base font-semibold text-stone-50">Pedidos</p>
            <p className="mt-2 text-sm text-stone-400">
              Revisar solicitudes publicas y pedidos ya cargados.
            </p>
            <p className="mt-3 text-xs text-sky-400">/panel/orders →</p>
          </a>
          <a
            href="/panel/customers"
            className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5 transition hover:border-sky-400/40 hover:bg-stone-900"
          >
            <p className="text-base font-semibold text-stone-50">Clientes</p>
            <p className="mt-2 text-sm text-stone-400">Listado y búsqueda de clientes registrados.</p>
            <p className="mt-3 text-xs text-sky-400">/panel/customers →</p>
          </a>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-stone-400">Logistica activa</p>
                <h2 className="mt-2 text-2xl font-semibold text-stone-50">Despacho del dia</h2>
              </div>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">
                {logisticsOrders.length} pedidos
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                <p className="text-sm text-amber-200">Capital Federal</p>
                <p className="mt-2 text-3xl font-semibold text-stone-50">{cabaOrders.length}</p>
                <p className="mt-2 text-sm text-stone-300">
                  Requieren mas confirmacion de presencia y contacto rapido.
                </p>
              </div>
              <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
                <p className="text-sm text-sky-200">Revendedora</p>
                <p className="mt-2 text-3xl font-semibold text-stone-50">{resellerOrders.length}</p>
                <p className="mt-2 text-sm text-stone-300">
                  Conviene consolidar cajas y entregar en un solo punto.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <p className="text-sm text-emerald-200">Ruta estandar</p>
                <p className="mt-2 text-3xl font-semibold text-stone-50">{standardOrders.length}</p>
                <p className="mt-2 text-sm text-stone-300">
                  Reparto directo por zona sin reglas especiales.
                </p>
              </div>
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
                <p className="text-sm text-rose-200">Por asignar o salir</p>
                <p className="mt-2 text-3xl font-semibold text-stone-50">{urgentOrders.length}</p>
                <p className="mt-2 text-sm text-stone-300">
                  Confirmados o asignados que todavia no figuran en ruta.
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
            <p className="text-sm uppercase tracking-[0.18em] text-stone-400">Criterio operativo</p>
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl border border-amber-400/20 bg-stone-950/70 p-4">
                <p className="text-base font-semibold text-amber-200">Capital Federal</p>
                <p className="mt-2 text-sm leading-6 text-stone-300">
                  Priorizar mensaje previo, horario acordado y prueba rapida de contacto antes de despachar.
                </p>
              </div>
              <div className="rounded-2xl border border-sky-400/20 bg-stone-950/70 p-4">
                <p className="text-base font-semibold text-sky-200">Revendedora</p>
                <p className="mt-2 text-sm leading-6 text-stone-300">
                  Armar lote por punto de entrega y evitar tratar cada pedido como visita individual.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-stone-950/70 p-4">
                <p className="text-base font-semibold text-emerald-200">Resto de zonas</p>
                <p className="mt-2 text-sm leading-6 text-stone-300">
                  Despachar por cercania y concentrar el seguimiento en entrega y cobranza.
                </p>
              </div>
            </div>
          </article>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-stone-400">Panel logistico</p>
              <h2 className="mt-2 text-2xl font-semibold text-stone-50">Pedidos para operar</h2>
            </div>
            <p className="max-w-xl text-right text-sm text-stone-400">
              La clasificacion es automatica: detecta `Capital Federal` por zona/barrio y `Revendedora`
              por canal o relacion comercial.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {[
              { title: "Capital Federal", items: cabaOrders },
              { title: "Revendedora", items: resellerOrders },
              { title: "Ruta estandar", items: standardOrders }
            ].map((group) => (
              <article key={group.title} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4">
                <div className="flex items-center justify-between gap-3 border-b border-stone-800 px-2 pb-3">
                  <h3 className="text-lg font-semibold text-stone-50">{group.title}</h3>
                  <span className="rounded-full border border-stone-700 bg-stone-950 px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-300">
                    {group.items.length}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {group.items.length ? (
                    group.items.map((order) => {
                      const tone = getLogisticsFlowTone(order.flow);
                      const toneClasses =
                        tone === "amber"
                          ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
                          : tone === "sky"
                            ? "border-sky-400/20 bg-sky-500/10 text-sky-200"
                            : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";

                      return (
                        <div key={order.id} className="rounded-2xl border border-stone-800 bg-stone-950/80 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-stone-50">{order.customerName}</p>
                              <p className="mt-1 text-sm text-stone-400">{order.customerPhone}</p>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-xs ${toneClasses}`}>
                              {getLogisticsFlowLabel(order.flow)}
                            </span>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-2xl bg-stone-900/80 p-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Zona</p>
                              <p className="mt-1 text-stone-200">{order.zone}</p>
                            </div>
                            <div className="rounded-2xl bg-stone-900/80 p-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Estado</p>
                              <p className="mt-1 text-stone-200">{order.status}</p>
                            </div>
                            <div className="rounded-2xl bg-stone-900/80 p-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Cajas</p>
                              <p className="mt-1 text-stone-200">{order.quantityBoxes}</p>
                            </div>
                            <div className="rounded-2xl bg-stone-900/80 p-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Cobranza</p>
                              <p className="mt-1 text-stone-200">{order.paymentStatus}</p>
                            </div>
                          </div>

                          <p className="mt-4 text-sm leading-6 text-stone-300">
                            {getLogisticsFlowGuidance(order.flow)}
                          </p>

                          {order.resellerName ? (
                            <p className="mt-2 text-sm text-sky-300">Revendedora: {order.resellerName}</p>
                          ) : null}

                          {order.deliveryDate ? (
                            <p className="mt-2 text-sm text-stone-400">Fecha prevista: {order.deliveryDate}</p>
                          ) : null}

                          {order.notes ? (
                            <div className="mt-3 rounded-2xl border border-stone-800 bg-stone-900/80 p-3 text-sm text-stone-300">
                              {order.notes}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-stone-800 bg-stone-950/70 px-4 py-6 text-sm text-stone-500">
                      No hay pedidos activos para esta categoria.
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="space-y-3 md:hidden">
          {rows.length ? (
            rows.map((row) => (
              <article
                key={row.id}
                className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-stone-50">{row.full_name}</p>
                    <p className="mt-1 text-sm text-stone-400">{formatWhatsAppPhone(row.phone)}</p>
                  </div>
                  <span className="rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-300">
                    {row.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-stone-950/70 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Zona</p>
                    <p className="mt-1 text-stone-200">{row.zone || row.neighborhood || "-"}</p>
                  </div>
                  <div className="rounded-2xl bg-stone-950/70 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Pago</p>
                    <p className="mt-1 text-stone-200">
                      {row.payment_method_expected === "cash" ? "Efectivo" : "Transferencia"}
                    </p>
                  </div>
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
              Todavia no hay solicitudes publicas.
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
                <div>{row.full_name}</div>
                <div>{formatWhatsAppPhone(row.phone)}</div>
                <div>{row.zone || row.neighborhood || "-"}</div>
                <div>{row.payment_method_expected === "cash" ? "Efectivo" : "Transferencia"}</div>
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
            <div className="px-4 py-6 text-sm text-stone-400">Todavia no hay solicitudes publicas.</div>
          )}
        </div>
      </section>
    </main>
  );
}
