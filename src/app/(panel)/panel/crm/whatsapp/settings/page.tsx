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
            <p className="text-sm uppercase tracking-[0.24em] text-stone-500">CRM · WhatsApp</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
              Configuración comercial
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-stone-400">
              Contexto estructurado para IA. Precios, stock, zonas y fechas deben venir del ERP/Supabase, no del modelo.
            </p>
          </div>
          <WhatsappCrmNav activeHref="/panel/crm/whatsapp/settings" />
        </div>

        <div className="grid gap-4">
          {settings.length ? (
            settings.map((setting) => (
              <article key={setting.id} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-stone-50">{setting.key}</h2>
                    <p className="mt-1 text-sm text-stone-400">
                      {setting.requires_human
                        ? "Estas acciones requieren intervención humana."
                        : "Puede usarse como contexto estructurado."}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${
                      setting.requires_human
                        ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
                        : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    {setting.requires_human ? "Humano" : "Automático"}
                  </span>
                </div>
                <pre className="mt-5 overflow-x-auto rounded-2xl border border-stone-800 bg-stone-950/80 p-4 text-xs text-stone-300">
                  {formatJson(setting.value)}
                </pre>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/70 px-5 py-10 text-center text-sm text-stone-500">
              No hay configuración comercial cargada. Aplicá `supabase/whatsapp_crm.sql`.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
