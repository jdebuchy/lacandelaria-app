import { DateText } from "@/components/ui/date-text";
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

export default async function WhatsappQueuePage() {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/crm/whatsapp/queue");
  const rows = await listWhatsappQueue();

  return (
    <main>
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-body text-ink-faint">CRM · WhatsApp</p>
              <h1 className="mt-2 text-display font-semibold tracking-tight text-ink">
                Cola de mensajes
              </h1>
            </div>
            <ManualWhatsappMessageButton />
          </div>
          <WhatsappCrmNav activeHref="/panel/crm/whatsapp/queue" />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {["pending", "sent", "failed", "cancelled"].map((status) => (
            <article key={status} className="rounded-card border border-line bg-paper p-5">
              <p className="text-body text-ink-soft">{getWhatsappQueueStatusLabel(status)}</p>
              <p className="mt-2 text-title font-semibold text-ink">
                {rows.filter((row) => row.status === status).length}
              </p>
            </article>
          ))}
        </div>

        <section className="overflow-hidden rounded-card border border-line bg-paper">
          <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr_1fr_1fr_1.2fr] border-b border-line bg-paper px-5 py-3 text-meta text-ink-soft max-lg:hidden">
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
                  className="grid gap-3 border-b border-line px-5 py-4 text-body text-ink-soft last:border-b-0 lg:grid-cols-[1.1fr_1fr_1fr_1fr_1fr_1fr_1.2fr]"
                >
                  <div>{getWhatsappMessageTypeLabel(row.message_type)}</div>
                  <div>{customerName}</div>
                  <div>{formatWhatsAppPhone(row.phone)}</div>
                  <div>{getWhatsappQueueStatusLabel(row.status)}</div>
                  <div><DateText value={row.scheduled_for} withTime /></div>
                  <div><DateText value={row.sent_at} withTime /></div>
                  <div className="text-danger-fg">{row.last_error ?? "-"}</div>
                </article>
              );
            })
          ) : (
            <div className="px-5 py-10 text-center text-body text-ink-faint">
              No hay mensajes en cola.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
