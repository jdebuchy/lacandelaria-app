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
            <p className="text-sm uppercase tracking-[0.24em] text-stone-500">CRM · WhatsApp</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
              Automatizaciones
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-stone-400">
              Las automatizaciones se basan en `deliveries.delivered_at`: satisfacción a los 7 días y recompra a los 21 días.
            </p>
          </div>
          <WhatsappCrmNav activeHref="/panel/crm/whatsapp/automations" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {settings.length ? (
            settings.map((setting) => (
              <article key={setting.id} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-stone-50">
                      {getWhatsappMessageTypeLabel(setting.message_type)}
                    </h2>
                    <p className="mt-1 text-sm text-stone-400">
                      {setting.days_after_delivered} días después de entrega
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${
                      setting.active
                        ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                        : "border-stone-700 bg-stone-950 text-stone-400"
                    }`}
                  >
                    {setting.active ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-2xl bg-stone-950/70 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Límite diario</p>
                    <p className="mt-1 text-stone-100">{setting.daily_limit}</p>
                  </div>
                  <div className="rounded-2xl bg-stone-950/70 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Delay mín.</p>
                    <p className="mt-1 text-stone-100">{setting.random_delay_min_seconds}s</p>
                  </div>
                  <div className="rounded-2xl bg-stone-950/70 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Delay máx.</p>
                    <p className="mt-1 text-stone-100">{setting.random_delay_max_seconds}s</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Texto actual</p>
                  <p className="mt-3 whitespace-pre-line text-sm text-stone-300">{setting.template_body}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/70 px-5 py-10 text-center text-sm text-stone-500 md:col-span-2">
              No hay automatizaciones configuradas. Aplicá `supabase/whatsapp_crm.sql`.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
