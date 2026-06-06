import { WhatsappCrmNav } from "@/components/whatsapp/whatsapp-crm-nav";
import { ManualWhatsappMessageButton } from "@/components/whatsapp/manual-whatsapp-message-button";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatPersonName, formatWhatsAppPhone } from "@/lib/contact";
import { listWhatsappQueue } from "@/lib/whatsapp/queries";
import { getWhatsappMessageTypeLabel, getWhatsappQueueStatusLabel } from "@/lib/whatsapp/types";

function takeSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
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

export default async function WhatsappQueuePage() {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/crm/whatsapp/queue");
  const rows = await listWhatsappQueue();

  return (
    <main>
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-stone-500">CRM · WhatsApp</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
                Cola de mensajes
              </h1>
            </div>
            <ManualWhatsappMessageButton />
          </div>
          <WhatsappCrmNav activeHref="/panel/crm/whatsapp/queue" />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {["pending", "sent", "failed", "cancelled"].map((status) => (
            <article key={status} className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
              <p className="text-sm text-stone-400">{getWhatsappQueueStatusLabel(status)}</p>
              <p className="mt-2 text-2xl font-semibold text-stone-50">
                {rows.filter((row) => row.status === status).length}
              </p>
            </article>
          ))}
        </div>

        <section className="overflow-hidden rounded-3xl border border-stone-800 bg-stone-900/70">
          <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr_1fr_1fr_1.2fr] border-b border-stone-800 bg-stone-900 px-5 py-3 text-xs uppercase tracking-[0.18em] text-stone-400 max-lg:hidden">
            <div>Tipo</div>
            <div>Cliente</div>
            <div>Teléfono</div>
            <div>Estado</div>
            <div>Programado</div>
            <div>Enviado</div>
            <div>Error</div>
          </div>
          {rows.length ? (
            rows.map((row) => {
              const customer = takeSingleRelation(row.customers);
              const customerName = customer
                ? formatPersonName(customer.first_name, customer.last_name)
                : "Cliente sin asociar";

              return (
                <article
                  key={row.id}
                  className="grid gap-3 border-b border-stone-800 px-5 py-4 text-sm text-stone-300 last:border-b-0 lg:grid-cols-[1.1fr_1fr_1fr_1fr_1fr_1fr_1.2fr]"
                >
                  <div>{getWhatsappMessageTypeLabel(row.message_type)}</div>
                  <div>{customerName}</div>
                  <div>{formatWhatsAppPhone(row.phone)}</div>
                  <div>{getWhatsappQueueStatusLabel(row.status)}</div>
                  <div>{formatDateTime(row.scheduled_for)}</div>
                  <div>{formatDateTime(row.sent_at)}</div>
                  <div className="text-rose-300">{row.last_error ?? "-"}</div>
                </article>
              );
            })
          ) : (
            <div className="px-5 py-10 text-center text-sm text-stone-500">
              No hay mensajes en cola.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
