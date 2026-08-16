import { WhatsappCrmNav } from "@/components/whatsapp/whatsapp-crm-nav";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { listWhatsappAutomationSettings } from "@/lib/whatsapp/queries";
import { getWhatsappMessageTypeLabel } from "@/lib/whatsapp/types";

export default async function WhatsappAutomationsPage() {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/crm/whatsapp/automations");
  const settings = await listWhatsappAutomationSettings();

  return (
    <main>
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-body text-ink-faint">CRM · WhatsApp</p>
            <h1 className="mt-2 text-display font-semibold tracking-tight text-ink">
              Automatizaciones
            </h1>
            <p className="mt-2 max-w-3xl text-body text-ink-soft">
              Las automatizaciones se basan en `deliveries.delivered_at`: satisfacción a los 7 días y recompra a los 21 días.
            </p>
          </div>
          <WhatsappCrmNav activeHref="/panel/crm/whatsapp/automations" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {settings.length ? (
            settings.map((setting) => (
              <article key={setting.id} className="rounded-card border border-line bg-paper p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-title font-semibold text-ink">
                      {getWhatsappMessageTypeLabel(setting.message_type)}
                    </h2>
                    <p className="mt-1 text-body text-ink-soft">
                      {setting.days_after_delivered} días después de entrega
                    </p>
                  </div>
                  <span
                    className={`rounded-control border px-3 py-1 text-meta ${
                      setting.active
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-line bg-paper-muted text-ink-soft"
                    }`}
                  >
                    {setting.active ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 text-body sm:grid-cols-3">
                  <div className="rounded-card bg-paper-muted p-3">
                    <p className="text-meta text-ink-faint">Límite diario</p>
                    <p className="mt-1 text-ink">{setting.daily_limit}</p>
                  </div>
                  <div className="rounded-card bg-paper-muted p-3">
                    <p className="text-meta text-ink-faint">Delay mín.</p>
                    <p className="mt-1 text-ink">{setting.random_delay_min_seconds}s</p>
                  </div>
                  <div className="rounded-card bg-paper-muted p-3">
                    <p className="text-meta text-ink-faint">Delay máx.</p>
                    <p className="mt-1 text-ink">{setting.random_delay_max_seconds}s</p>
                  </div>
                </div>

                <div className="mt-5 rounded-card border border-line bg-paper-muted p-4">
                  <p className="text-meta text-ink-faint">Texto actual</p>
                  <p className="mt-3 whitespace-pre-line text-body text-ink-soft">{setting.template_body}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-card border border-dashed border-line bg-paper px-5 py-10 text-center text-body text-ink-faint md:col-span-2">
              No hay automatizaciones configuradas. Aplicá `supabase/whatsapp_crm.sql`.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
