import Link from "next/link";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatPersonName } from "@/lib/contact";
import {
  listInstagramConversations,
  listInstagramMessagesByConversation
} from "@/lib/instagram/queries";
import type { InstagramConversationRow } from "@/lib/instagram/queries";
import {
  getInstagramMessageTypeLabel,
  getInstagramStatusLabel
} from "@/lib/instagram/types";

type SearchParams = Promise<{ conversationId?: string }>;

function takeSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getCustomerName(conversation: InstagramConversationRow) {
  const customer = takeSingleRelation(conversation.customers);

  if (customer) {
    return formatPersonName(customer.first_name, customer.last_name, customer.instagram);
  }

  return conversation.instagram_username
    ? `@${conversation.instagram_username}`
    : `IG ${conversation.instagram_scoped_user_id.slice(-6)}`;
}

function getLatestMessage(conversation: InstagramConversationRow) {
  return conversation.instagram_messages?.[0]?.text || getInstagramStatusLabel(conversation.status);
}

function getReferralValue(referral: unknown, key: string) {
  if (!referral || typeof referral !== "object") {
    return null;
  }

  const value = (referral as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function getCampaignLabel(conversation: InstagramConversationRow) {
  return (
    conversation.campaign_id ||
    getReferralValue(conversation.referral, "campaign_id") ||
    getReferralValue(conversation.referral, "source") ||
    "Sin campana"
  );
}

function formatTime(value?: string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
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

export default async function InstagramInboxPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/crm/instagram");
  const { conversationId } = await searchParams;
  const conversations = await listInstagramConversations(100);
  const selectedConversation =
    conversations.find((conversation) => conversation.id === conversationId) ?? conversations[0] ?? null;
  const messages = selectedConversation
    ? await listInstagramMessagesByConversation(selectedConversation.id)
    : [];

  return (
    <main>
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-body text-ink-faint">CRM</p>
              <h1 className="mt-2 text-display font-semibold tracking-tight text-ink">
                Instagram Ads Inbox
              </h1>
              <p className="mt-2 max-w-3xl text-body text-ink-soft">
                Bandeja de DMs iniciados por usuarios desde Instagram Direct y campanas Click to Message.
                Fase 1 guarda webhooks y mensajes entrantes; no envia respuestas ni automatizaciones.
              </p>
            </div>
            <Link
              href="/panel/crm/whatsapp"
              className="inline-flex h-11 items-center justify-center rounded-control border border-line px-4 text-body font-medium text-ink transition hover:border-line-strong hover:text-ink"
            >
              Ver WhatsApp
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 text-body">
            <Link
              href="/panel/crm/whatsapp"
              className="rounded-control border border-line px-4 py-2 text-ink-soft transition hover:border-line hover:text-ink"
            >
              WhatsApp
            </Link>
            <Link
              href="/panel/crm/instagram"
              className="rounded-control border border-line bg-paper-raised px-4 py-2 text-ink"
            >
              Instagram
            </Link>
          </div>
        </div>

        <section className="grid min-h-[680px] overflow-hidden rounded-control-4xl border border-line bg-paper-muted shadow-2xl shadow-black/20 lg:grid-cols-[390px_1fr]">
          <aside className="flex min-h-0 flex-col border-b border-line bg-paper-muted lg:border-b-0 lg:border-r">
            <div className="border-b border-line p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-title font-semibold text-ink">Instagram</p>
                  <p className="mt-1 text-meta text-ink-faint">
                    {conversations.length} conversaciones · {conversations.filter((row) => row.status === "human_needed").length} humanas
                  </p>
                </div>
                <span className="rounded-control border border-line bg-paper px-3 py-1.5 text-meta text-ink-soft">
                  Solo lectura
                </span>
              </div>

              <div className="mt-5 flex h-12 items-center gap-3 rounded-control bg-paper px-4 text-body text-ink-faint">
                <span aria-hidden="true">#</span>
                <span>Campanas y mensajes entrantes</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-body">
                <span className="rounded-control border border-line bg-paper-raised px-4 py-2 text-ink">
                  Todas
                </span>
                <span className="rounded-control border border-line px-4 py-2 text-ink-soft">
                  Nuevas {conversations.filter((row) => row.status === "new").length}
                </span>
                <span className="rounded-control border border-line px-4 py-2 text-ink-soft">
                  Automatizacion off
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {conversations.length ? (
                conversations.map((conversation) => {
                  const isActive = selectedConversation?.id === conversation.id;

                  return (
                    <Link
                      key={conversation.id}
                      href={`/panel/crm/instagram?conversationId=${conversation.id}`}
                      className={`grid grid-cols-[3.5rem_1fr_auto] gap-3 border-b border-line px-4 py-4 transition ${
                        isActive ? "bg-paper" : "hover:bg-paper"
                      }`}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-paper-raised text-body font-semibold text-ink">
                        {getCustomerName(conversation).replace(/^@/, "").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-body font-semibold text-ink">
                            {getCustomerName(conversation)}
                          </p>
                          {conversation.status === "human_needed" ? (
                            <span className="rounded-control bg-danger-bg px-2 py-0.5 text-meta text-danger-fg">
                              Humano
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-body text-ink-faint">
                          {getLatestMessage(conversation)}
                        </p>
                        <p className="mt-1 truncate text-meta text-ink-faint">
                          {getInstagramStatusLabel(conversation.status)} · {getCampaignLabel(conversation)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-meta text-ink-faint">
                          {formatTime(conversation.last_message_at || conversation.updated_at)}
                        </p>
                        {!conversation.automation_enabled ? (
                          <span className="mt-2 inline-flex rounded-control border border-line px-2 py-0.5 text-meta text-ink-faint">
                            IA off
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="px-6 py-12 text-center text-body text-ink-faint">
                  Todavia no hay conversaciones. Cuando Meta envie un DM por webhook, va a aparecer aca.
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col bg-paper">
            {selectedConversation ? (
              <>
                <header className="flex items-center justify-between gap-3 border-b border-line bg-paper-muted px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper-raised text-body font-semibold text-ink">
                      {getCustomerName(selectedConversation).replace(/^@/, "").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{getCustomerName(selectedConversation)}</p>
                      <p className="mt-0.5 truncate text-meta text-ink-faint">
                        {selectedConversation.instagram_scoped_user_id} · {getInstagramStatusLabel(selectedConversation.status)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-meta">
                    {selectedConversation.customer_id ? (
                      <Link
                        href={`/panel/customers/${selectedConversation.customer_id}`}
                        className="rounded-control border border-line px-3 py-1.5 text-ink-soft transition hover:border-line hover:text-ink"
                      >
                        Ver cliente
                      </Link>
                    ) : null}
                    <span className="rounded-control border border-line bg-paper-raised px-3 py-1.5 text-ink">
                      {getCampaignLabel(selectedConversation)}
                    </span>
                  </div>
                </header>

                <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_320px]">
                  <div className="min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.08),transparent_30%),linear-gradient(135deg,rgba(28,25,23,0.94),rgba(12,10,9,0.96))] px-4 py-6">
                    <div className="mx-auto flex max-w-3xl flex-col gap-3">
                      {messages.length ? (
                        messages.map((message) => {
                          const outbound = message.direction === "outbound";

                          return (
                            <article
                              key={message.id}
                              className={`max-w-[82%] rounded-card px-4 py-3 text-body shadow-lg ${
                                outbound
                                  ? "ml-auto rounded-br-control bg-accent text-white shadow-ink/10"
                                  : "mr-auto rounded-bl-control bg-paper-raised text-ink shadow-black/20"
                              }`}
                            >
                              <p className="whitespace-pre-line">
                                {message.text || (message.message_type === "attachment" ? "Mensaje con adjunto" : "Sin texto")}
                              </p>
                              <div className={`mt-2 flex flex-wrap items-center justify-end gap-2 text-meta ${
                                outbound ? "text-ink" : "text-ink-faint"
                              }`}>
                                <span>{getInstagramMessageTypeLabel(message.message_type)}</span>
                                <span>{formatDateTime(message.created_at)}</span>
                              </div>
                            </article>
                          );
                        })
                      ) : (
                        <div className="mx-auto mt-24 max-w-md rounded-card border border-dashed border-line bg-paper px-6 py-8 text-center">
                          <p className="text-title font-semibold text-ink">Sin mensajes guardados</p>
                          <p className="mt-2 text-body text-ink-faint">
                            La conversacion existe, pero todavia no hay mensajes inbound asociados.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <aside className="border-t border-line bg-paper-muted p-5 lg:border-l lg:border-t-0">
                    <h2 className="text-body font-semibold text-ink-faint">
                      Lead
                    </h2>
                    <dl className="mt-5 space-y-4 text-body">
                      <div>
                        <dt className="text-ink-faint">Estado</dt>
                        <dd className="mt-1 text-ink">{getInstagramStatusLabel(selectedConversation.status)}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-faint">Campana</dt>
                        <dd className="mt-1 wrap-break-word text-ink">{getCampaignLabel(selectedConversation)}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-faint">Ad set</dt>
                        <dd className="mt-1 wrap-break-word text-ink">{selectedConversation.adset_id || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-faint">Ad</dt>
                        <dd className="mt-1 wrap-break-word text-ink">{selectedConversation.ad_id || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-faint">Ultimo inbound</dt>
                        <dd className="mt-1 text-ink">{formatDateTime(selectedConversation.last_inbound_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-faint">Automatizacion</dt>
                        <dd className="mt-1 text-ink">
                          {selectedConversation.automation_enabled ? "Habilitada" : "Apagada"}
                        </dd>
                      </div>
                    </dl>
                  </aside>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="max-w-md rounded-card border border-dashed border-line bg-paper px-6 py-8 text-center">
                  <p className="text-title font-semibold text-ink">Instagram Ads Inbox listo</p>
                  <p className="mt-2 text-body text-ink-faint">
                    Configura el webhook de Meta para empezar a recibir conversaciones iniciadas por usuarios.
                  </p>
                </div>
              </div>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}
