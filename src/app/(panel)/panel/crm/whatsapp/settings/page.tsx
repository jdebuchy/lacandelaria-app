import { WhatsappCrmNav } from "@/components/whatsapp/whatsapp-crm-nav";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { listWhatsappCommercialSettings } from "@/lib/whatsapp/queries";

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export default async function WhatsappSettingsPage() {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/crm/whatsapp/settings");
  const settings = await listWhatsappCommercialSettings();

  return (
    <main>
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-ink-faint">CRM · WhatsApp</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Configuración comercial
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-ink-soft">
              Contexto estructurado para IA. Precios, stock, zonas y fechas deben venir del ERP/Supabase, no del modelo.
            </p>
          </div>
          <WhatsappCrmNav activeHref="/panel/crm/whatsapp/settings" />
        </div>

        <div className="grid gap-4">
          {settings.length ? (
            settings.map((setting) => (
              <article key={setting.id} className="rounded-card border border-line bg-paper p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-ink">{setting.key}</h2>
                    <p className="mt-1 text-sm text-ink-soft">
                      {setting.requires_human
                        ? "Estas acciones requieren intervención humana."
                        : "Puede usarse como contexto estructurado."}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${
                      setting.requires_human
                        ? "border-warn-line bg-warn-bg text-warn-fg"
                        : "border-accent bg-accent-soft text-accent"
                    }`}
                  >
                    {setting.requires_human ? "Humano" : "Automático"}
                  </span>
                </div>
                <pre className="mt-5 overflow-x-auto rounded-card border border-line bg-paper-muted p-4 text-xs text-ink-soft">
                  {formatJson(setting.value)}
                </pre>
              </article>
            ))
          ) : (
            <div className="rounded-card border border-dashed border-line bg-paper px-5 py-10 text-center text-sm text-ink-faint">
              No hay configuración comercial cargada. Aplicá `supabase/whatsapp_crm.sql`.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
