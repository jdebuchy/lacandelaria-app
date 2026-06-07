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
              <p className="text-sm uppercase tracking-[0.24em] text-stone-500">CRM</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
                Instagram Ads Inbox
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-stone-400">
                Bandeja de DMs iniciados por usuarios desde Instagram Direct y campanas Click to Message.
                Fase 1 guarda webhooks y mensajes entrantes; no envia respuestas ni automatizaciones.
              </p>
            </div>
            <Link
              href="/panel/crm/whatsapp"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-700 px-4 text-sm font-medium text-stone-200 transition hover:border-stone-500 hover:text-stone-50"
            >
              Ver WhatsApp
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/panel/crm/whatsapp"
              className="rounded-full border border-stone-800 px-4 py-2 text-stone-400 transition hover:border-stone-600 hover:text-stone-100"
            >
              WhatsApp
            </Link>
            <Link
              href="/panel/crm/instagram"
              className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-fuchsia-100"
            >
              Instagram
            </Link>
          </div>
        </div>

        <section className="grid min-h-[680px] overflow-hidden rounded-[2rem] border border-stone-800 bg-stone-950 shadow-2xl shadow-black/20 lg:grid-cols-[390px_1fr]">
          <aside className="flex min-h-0 flex-col border-b border-stone-800 bg-stone-950 lg:border-b-0 lg:border-r">
            <div className="border-b border-stone-800 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold text-fuchsia-300">Instagram</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {conversations.length} conversaciones · {conversations.filter((row) => row.status === "human_needed").length} humanas
                  </p>
                </div>
                <span className="rounded-full border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs text-stone-400">
                  Solo lectura
                </span>
              </div>

              <div className="mt-5 flex h-12 items-center gap-3 rounded-full bg-stone-900 px-4 text-sm text-stone-500">
                <span aria-hidden="true">#</span>
                <span>Campanas y mensajes entrantes</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-fuchsia-100">
                  Todas
                </span>
                <span className="rounded-full border border-stone-800 px-4 py-2 text-stone-400">
                  Nuevas {conversations.filter((row) => row.status === "new").length}
                </span>
                <span className="rounded-full border border-stone-800 px-4 py-2 text-stone-400">
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
                      className={`grid grid-cols-[3.5rem_1fr_auto] gap-3 border-b border-stone-900 px-4 py-4 transition ${
                        isActive ? "bg-stone-900" : "hover:bg-stone-900/70"
                      }`}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-fuchsia-500/15 text-sm font-semibold text-fuchsia-100">
                        {getCustomerName(conversation).replace(/^@/, "").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-stone-100">
                            {getCustomerName(conversation)}
                          </p>
                          {conversation.status === "human_needed" ? (
                            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] text-rose-200">
                              Humano
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-sm text-stone-500">
                          {getLatestMessage(conversation)}
                        </p>
                        <p className="mt-1 truncate text-xs text-stone-600">
                          {getInstagramStatusLabel(conversation.status)} · {getCampaignLabel(conversation)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-stone-500">
                          {formatTime(conversation.last_message_at || conversation.updated_at)}
                        </p>
                        {!conversation.automation_enabled ? (
                          <span className="mt-2 inline-flex rounded-full border border-stone-800 px-2 py-0.5 text-[10px] text-stone-500">
                            IA off
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="px-6 py-12 text-center text-sm text-stone-500">
                  Todavia no hay conversaciones. Cuando Meta envie un DM por webhook, va a aparecer aca.
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col bg-stone-900/40">
            {selectedConversation ? (
              <>
                <header className="flex items-center justify-between gap-3 border-b border-stone-800 bg-stone-950/95 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/15 text-sm font-semibold text-fuchsia-100">
                      {getCustomerName(selectedConversation).replace(/^@/, "").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-stone-50">{getCustomerName(selectedConversation)}</p>
                      <p className="mt-0.5 truncate text-xs text-stone-500">
                        {selectedConversation.instagram_scoped_user_id} · {getInstagramStatusLabel(selectedConversation.status)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {selectedConversation.customer_id ? (
                      <Link
                        href={`/panel/customers/${selectedConversation.customer_id}`}
                        className="rounded-full border border-stone-800 px-3 py-1.5 text-stone-300 transition hover:border-stone-600 hover:text-stone-50"
                      >
                        Ver cliente
                      </Link>
                    ) : null}
                    <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1.5 text-fuchsia-100">
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
                              className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-lg ${
                                outbound
                                  ? "ml-auto rounded-br-md bg-fuchsia-600 text-white shadow-fuchsia-950/20"
                                  : "mr-auto rounded-bl-md bg-stone-800 text-stone-100 shadow-black/20"
                              }`}
                            >
                              <p className="whitespace-pre-line">
                                {message.text || (message.message_type === "attachment" ? "Mensaje con adjunto" : "Sin texto")}
                              </p>
                              <div className={`mt-2 flex flex-wrap items-center justify-end gap-2 text-[11px] ${
                                outbound ? "text-fuchsia-100/80" : "text-stone-500"
                              }`}>
                                <span>{getInstagramMessageTypeLabel(message.message_type)}</span>
                                <span>{formatDateTime(message.created_at)}</span>
                              </div>
                            </article>
                          );
                        })
                      ) : (
                        <div className="mx-auto mt-24 max-w-md rounded-3xl border border-dashed border-stone-800 bg-stone-900/70 px-6 py-8 text-center">
                          <p className="text-lg font-semibold text-stone-100">Sin mensajes guardados</p>
                          <p className="mt-2 text-sm text-stone-500">
                            La conversacion existe, pero todavia no hay mensajes inbound asociados.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <aside className="border-t border-stone-800 bg-stone-950 p-5 lg:border-l lg:border-t-0">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
                      Lead
                    </h2>
                    <dl className="mt-5 space-y-4 text-sm">
                      <div>
                        <dt className="text-stone-500">Estado</dt>
                        <dd className="mt-1 text-stone-100">{getInstagramStatusLabel(selectedConversation.status)}</dd>
                      </div>
                      <div>
                        <dt className="text-stone-500">Campana</dt>
                        <dd className="mt-1 break-words text-stone-100">{getCampaignLabel(selectedConversation)}</dd>
                      </div>
                      <div>
                        <dt className="text-stone-500">Ad set</dt>
                        <dd className="mt-1 break-words text-stone-100">{selectedConversation.adset_id || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-stone-500">Ad</dt>
                        <dd className="mt-1 break-words text-stone-100">{selectedConversation.ad_id || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-stone-500">Ultimo inbound</dt>
                        <dd className="mt-1 text-stone-100">{formatDateTime(selectedConversation.last_inbound_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-stone-500">Automatizacion</dt>
                        <dd className="mt-1 text-stone-100">
                          {selectedConversation.automation_enabled ? "Habilitada" : "Apagada"}
                        </dd>
                      </div>
                    </dl>
                  </aside>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="max-w-md rounded-3xl border border-dashed border-stone-800 bg-stone-900/70 px-6 py-8 text-center">
                  <p className="text-lg font-semibold text-stone-100">Instagram Ads Inbox listo</p>
                  <p className="mt-2 text-sm text-stone-500">
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
