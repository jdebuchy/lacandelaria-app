import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerDetailTabs, normalizeCustomerDetailTab } from "@/components/customer-detail-tabs";
import { formatStructuredAddressLine, formatStructuredAddressSummary } from "@/lib/address";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatPersonName, formatWhatsAppPhone } from "@/lib/contact";
import { getCustomerDetail, listOrdersByCustomer } from "@/lib/customers/queries";
import { getOrderStatusLabel, canEditOrder } from "@/lib/delivery-trips";
import { buildPaymentSummary, formatCurrency, getPaymentMethodLabel, getPaymentStatusLabel } from "@/lib/payments";
import { formatItemsSummary } from "@/lib/products";
import { listWhatsappConversationsByCustomer, listWhatsappMessagesByCustomer } from "@/lib/whatsapp/queries";
import {
  formatConfidence,
  getWhatsappIntentLabel,
  getWhatsappMessageTypeLabel,
  getWhatsappStatusLabel
} from "@/lib/whatsapp/types";

type Params = Promise<{ customerId: string }>;
type SearchParams = Promise<{ tab?: string }>;

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

function getSalesChannelLabel(channel: string) {
  switch (channel) {
    case "internal":
      return "Interno";
    case "public_form":
      return "Formulario";
    case "reseller":
      return "Revendedor";
    case "whatsapp_ai":
      return "WhatsApp IA";
    default:
      return channel;
  }
}

export default async function CustomerDetailPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { customerId } = await params;
  const { tab } = await searchParams;
  const activeTab = normalizeCustomerDetailTab(tab);

  await requirePageRole(PANEL_ALLOWED_ROLES, `/panel/customers/${customerId}`);

  const [customer, orders, conversations, messages] = await Promise.all([
    getCustomerDetail(customerId),
    listOrdersByCustomer(customerId),
    listWhatsappConversationsByCustomer(customerId),
    listWhatsappMessagesByCustomer(customerId)
  ]);

  if (!customer) {
    notFound();
  }

  const customerName = formatPersonName(customer.first_name, customer.last_name, customer.instagram);
  const addressSummary = formatStructuredAddressSummary({
    addressKind: customer.address_kind ?? "standard",
    addressLine1: customer.address_line_1 ?? "",
    gatedCommunityName: customer.gated_community_name ?? "",
    locality: customer.locality ?? ""
  });
  const addressLine = formatStructuredAddressLine({
    addressKind: customer.address_kind ?? "standard",
    addressLine1: customer.address_line_1 ?? "",
    addressLine2: customer.address_line_2 ?? "",
    gatedCommunityName: customer.gated_community_name ?? ""
  });

  return (
    <main>
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4">
          <div>
            <Link href="/panel/customers" className="text-sm text-stone-500 transition hover:text-stone-300">
              ← Volver a clientes
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
              {customerName}
            </h1>
            <p className="mt-2 text-stone-400">{formatWhatsAppPhone(customer.whatsapp_phone || customer.phone)}</p>
          </div>
          <CustomerDetailTabs activeTab={activeTab} customerId={customer.id} />
        </div>

        {activeTab === "profile" ? (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
              <h2 className="text-xl font-semibold text-stone-50">Perfil</h2>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-stone-500">Nombre</dt>
                  <dd className="mt-1 text-stone-100">{customerName}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Instagram</dt>
                  <dd className="mt-1 text-stone-100">{customer.instagram || "-"}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Teléfono</dt>
                  <dd className="mt-1 text-stone-100">{formatWhatsAppPhone(customer.phone)}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Origen</dt>
                  <dd className="mt-1 text-stone-100">{customer.source}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-stone-500">Dirección</dt>
                  <dd className="mt-1 text-stone-100">{addressSummary}</dd>
                  {addressLine ? <dd className="mt-1 text-stone-500">{addressLine}</dd> : null}
                </div>
                <div>
                  <dt className="text-stone-500">Área logística</dt>
                  <dd className="mt-1 text-stone-100">{customer.delivery_area || "-"}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Alta</dt>
                  <dd className="mt-1 text-stone-100">{formatDate(customer.created_at)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-stone-500">Notas de entrega</dt>
                  <dd className="mt-1 text-stone-100">{customer.delivery_notes || "-"}</dd>
                </div>
              </dl>
            </article>

            <article className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
              <h2 className="text-xl font-semibold text-stone-50">WhatsApp</h2>
              <dl className="mt-5 grid gap-4 text-sm">
                <div>
                  <dt className="text-stone-500">Teléfono WhatsApp</dt>
                  <dd className="mt-1 text-stone-100">{formatWhatsAppPhone(customer.whatsapp_phone || customer.phone)}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Opt-in</dt>
                  <dd className={customer.whatsapp_opt_in === false ? "mt-1 text-rose-300" : "mt-1 text-emerald-300"}>
                    {customer.whatsapp_opt_in === false ? "No habilitado" : "Habilitado"}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Baja</dt>
                  <dd className="mt-1 text-stone-100">{formatDateTime(customer.whatsapp_opt_out_at)}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Última interacción</dt>
                  <dd className="mt-1 text-stone-100">{formatDateTime(customer.last_whatsapp_interaction_at)}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Canal preferido</dt>
                  <dd className="mt-1 text-stone-100">{customer.preferred_contact_channel || "-"}</dd>
                </div>
              </dl>
            </article>
          </div>
        ) : null}

        {activeTab === "orders" ? (
          <section className="overflow-hidden rounded-3xl border border-stone-800 bg-stone-900/70">
            {orders.length ? (
              orders.map((order) => {
                const paidAmount = (order.payments ?? [])
                  .filter((payment) => payment.status === "received")
                  .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
                const paymentSummary = buildPaymentSummary(Number(order.total_amount ?? 0), paidAmount);
                const isEditable = canEditOrder(order.status, false);

                return (
                  <article key={order.id} className="border-b border-stone-800 p-5 last:border-b-0">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-stone-50">{formatItemsSummary(order.order_items ?? [])}</p>
                        <p className="mt-1 text-sm text-stone-400">
                          {getSalesChannelLabel(order.sales_channel)} · {getOrderStatusLabel(order.status)} · {formatDate(order.created_at)}
                        </p>
                        <p className="mt-1 text-sm text-stone-500">
                          {getPaymentStatusLabel(paymentSummary.paymentStatus)} · {getPaymentMethodLabel(order.payment_method_expected)}
                        </p>
                      </div>
                      <div className="text-sm sm:text-right">
                        <p className="text-lg font-semibold text-stone-50">{formatCurrency(paymentSummary.totalAmount)}</p>
                        <p className="mt-1 text-stone-500">Saldo {formatCurrency(paymentSummary.balanceAmount)}</p>
                        {isEditable ? (
                          <Link
                            href={`/panel/orders/${order.id}/edit`}
                            className="mt-3 inline-flex rounded-full border border-stone-700 px-3 py-1 text-xs text-stone-200 transition hover:border-stone-500 hover:text-stone-50"
                          >
                            Editar pedido
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="px-5 py-10 text-center text-sm text-stone-500">
                Este cliente todavía no tiene pedidos.
              </div>
            )}
          </section>
        ) : null}

        {activeTab === "whatsapp" ? (
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
              <h2 className="text-xl font-semibold text-stone-50">Conversaciones</h2>
              <div className="mt-5 grid gap-3">
                {conversations.length ? (
                  conversations.map((conversation) => (
                    <article key={conversation.id} className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-stone-100">{getWhatsappStatusLabel(conversation.status)}</p>
                          <p className="mt-1 text-stone-500">{formatDateTime(conversation.updated_at)}</p>
                        </div>
                        {conversation.requires_human ? (
                          <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
                            Humano
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-stone-400">
                        {getWhatsappIntentLabel(conversation.current_intent)} · {formatConfidence(conversation.ai_confidence)}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-stone-800 bg-stone-950/70 px-4 py-8 text-center text-sm text-stone-500">
                    No hay conversaciones asociadas.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
              <h2 className="text-xl font-semibold text-stone-50">Mensajes</h2>
              <div className="mt-5 grid gap-3">
                {messages.length ? (
                  messages.map((message) => (
                    <article
                      key={message.id}
                      className={`rounded-2xl border p-4 text-sm ${
                        message.direction === "inbound"
                          ? "border-sky-400/20 bg-sky-500/10"
                          : "border-emerald-400/20 bg-emerald-500/10"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                          {message.direction === "inbound" ? "Cliente" : "Sistema"} · {getWhatsappMessageTypeLabel(message.message_type)}
                        </p>
                        <p className="text-xs text-stone-500">{formatDateTime(message.created_at)}</p>
                      </div>
                      <p className="mt-3 whitespace-pre-line text-stone-100">{message.body}</p>
                      {message.ai_intent ? (
                        <p className="mt-3 text-xs text-stone-400">
                          IA: {getWhatsappIntentLabel(message.ai_intent)} · {formatConfidence(message.ai_confidence)}
                        </p>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-stone-800 bg-stone-950/70 px-4 py-8 text-center text-sm text-stone-500">
                    No hay mensajes asociados.
                  </p>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
