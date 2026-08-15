import Link from "next/link";
import { WhatsappChatComposer } from "@/components/whatsapp/whatsapp-chat-composer";
import { WhatsappCrmNav } from "@/components/whatsapp/whatsapp-crm-nav";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatPersonName, formatWhatsAppPhone } from "@/lib/contact";
import {
  listWhatsappConversations,
  listWhatsappMessagesByConversation
} from "@/lib/whatsapp/queries";
import type { WhatsappConversationRow } from "@/lib/whatsapp/queries";
import {
  formatConfidence,
  getWhatsappIntentLabel,
  getWhatsappMessageTypeLabel,
  getWhatsappStatusLabel
} from "@/lib/whatsapp/types";

type SearchParams = Promise<{ conversationId?: string }>;

function takeSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getCustomerName(conversation: WhatsappConversationRow) {
  const customer = takeSingleRelation(conversation.customers);
  return customer ? formatPersonName(customer.first_name, customer.last_name) : "Cliente sin asociar";
}

function getConversationPhone(conversation: WhatsappConversationRow) {
  const customer = takeSingleRelation(conversation.customers);
  return customer?.whatsapp_phone || customer?.phone || conversation.phone;
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

export default async function WhatsappInboxPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/crm/whatsapp");
  const { conversationId } = await searchParams;
  const conversations = await listWhatsappConversations(100);
  const selectedConversation =
    conversations.find((conversation) => conversation.id === conversationId) ?? conversations[0] ?? null;
  const messages = selectedConversation
    ? await listWhatsappMessagesByConversation(selectedConversation.id)
    : [];

  return (
    <main>
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-ink-faint">CRM</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                WhatsApp
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-ink-soft">
                Mensajero operativo con IA limitada, schedule y envío directo vía `whatsapp-web.js` cuando el worker está conectado.
              </p>
            </div>
            <Link
              href="/panel/crm/whatsapp/queue"
              className="inline-flex h-11 items-center justify-center rounded-control border border-line px-4 text-sm font-medium text-ink transition hover:border-line-strong hover:text-ink"
            >
              Programar mensaje
            </Link>
          </div>
          <WhatsappCrmNav activeHref="/panel/crm/whatsapp" />
        </div>

        <section className="grid min-h-[680px] overflow-hidden rounded-control-4xl border border-line bg-paper-muted shadow-2xl shadow-black/20 lg:grid-cols-[390px_1fr]">
          <aside className="flex min-h-0 flex-col border-b border-line bg-paper-muted lg:border-b-0 lg:border-r">
            <div className="border-b border-line p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold text-accent">WhatsApp</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {conversations.length} conversaciones · {conversations.filter((row) => row.requires_human).length} humanas
                  </p>
                </div>
                <Link
                  href="/panel/crm/whatsapp/queue"
                  className="flex h-10 w-10 items-center justify-center rounded-card border border-line bg-paper text-lg text-ink-soft transition hover:border-accent hover:text-accent"
                  aria-label="Programar mensaje"
                >
                  +
                </Link>
              </div>

              <div className="mt-5 flex h-12 items-center gap-3 rounded-control bg-paper px-4 text-sm text-ink-faint">
                <span aria-hidden="true">⌕</span>
                <span>Buscar o iniciar chat desde cola</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="rounded-control border border-accent bg-accent-soft px-4 py-2 text-accent">
                  Todas
                </span>
                <span className="rounded-control border border-line px-4 py-2 text-ink-soft">
                  Humano {conversations.filter((row) => row.requires_human).length}
                </span>
                <span className="rounded-control border border-line px-4 py-2 text-ink-soft">
                  Pedido listo {conversations.filter((row) => row.status === "waiting_for_confirmation").length}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {conversations.length ? (
                conversations.map((conversation) => {
                  const latestMessage = conversation.whatsapp_messages?.[0];
                  const isActive = selectedConversation?.id === conversation.id;

                  return (
                    <Link
                      key={conversation.id}
                      href={`/panel/crm/whatsapp?conversationId=${conversation.id}`}
                      className={`grid grid-cols-[3.5rem_1fr_auto] gap-3 border-b border-line px-4 py-4 transition ${
                        isActive ? "bg-paper" : "hover:bg-paper"
                      }`}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                        {getCustomerName(conversation).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-ink">
                            {getCustomerName(conversation)}
                          </p>
                          {conversation.requires_human ? (
                            <span className="rounded-control bg-danger-bg px-2 py-0.5 text-[10px] text-danger-fg">
                              Humano
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-sm text-ink-faint">
                          {latestMessage?.body || getWhatsappStatusLabel(conversation.status)}
                        </p>
                        <p className="mt-1 text-xs text-ink-faint">
                          {getWhatsappIntentLabel(conversation.current_intent)} · {formatConfidence(conversation.ai_confidence)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-ink-faint">
                          {formatTime(conversation.last_inbound_at || conversation.last_outbound_at || conversation.updated_at)}
                        </p>
                        {conversation.status === "waiting_for_confirmation" ? (
                          <span className="mt-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warn-bg px-1.5 text-[11px] font-semibold text-accent-fg">
                            !
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="px-6 py-12 text-center text-sm text-ink-faint">
                  Todavía no hay conversaciones. Podés programar un mensaje manual desde la cola o conectar el worker para recibir respuestas.
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col bg-paper">
            {selectedConversation ? (
              <>
                <header className="flex items-center justify-between gap-3 border-b border-line bg-paper-muted px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                      {getCustomerName(selectedConversation).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{getCustomerName(selectedConversation)}</p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {formatWhatsAppPhone(getConversationPhone(selectedConversation))} · {getWhatsappStatusLabel(selectedConversation.status)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {selectedConversation.customer_id ? (
                      <Link
                        href={`/panel/customers/${selectedConversation.customer_id}?tab=whatsapp`}
                        className="rounded-control border border-line px-3 py-1.5 text-ink-soft transition hover:border-line hover:text-ink"
                      >
                        Ver cliente
                      </Link>
                    ) : null}
                    {selectedConversation.requires_human ? (
                      <span className="rounded-control border border-danger-line bg-danger-bg px-3 py-1.5 text-danger-fg">
                        Requiere humano
                      </span>
                    ) : null}
                  </div>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_30%),linear-gradient(135deg,rgba(28,25,23,0.94),rgba(12,10,9,0.96))] px-4 py-6">
                  <div className="mx-auto flex max-w-3xl flex-col gap-3">
                    {messages.length ? (
                      messages.map((message) => {
                        const outbound = message.direction === "outbound";

                        return (
                          <article
                            key={message.id}
                            className={`max-w-[82%] rounded-card px-4 py-3 text-sm shadow-lg ${
                              outbound
                                ? "ml-auto rounded-br-control bg-accent text-white shadow-ink/10"
                                : "mr-auto rounded-bl-control bg-paper-raised text-ink shadow-black/20"
                            }`}
                          >
                            <p className="whitespace-pre-line">{message.body}</p>
                            <div className={`mt-2 flex flex-wrap items-center justify-end gap-2 text-[11px] ${
                              outbound ? "text-accent" : "text-ink-faint"
                            }`}>
                              <span>{getWhatsappMessageTypeLabel(message.message_type)}</span>
                              <span>{formatDateTime(message.created_at)}</span>
                            </div>
                            {message.ai_intent ? (
                              <p className={`mt-2 text-[11px] ${outbound ? "text-accent" : "text-ink-faint"}`}>
                                IA: {getWhatsappIntentLabel(message.ai_intent)} · {formatConfidence(message.ai_confidence)}
                              </p>
                            ) : null}
                          </article>
                        );
                      })
                    ) : (
                      <div className="mx-auto mt-24 max-w-md rounded-card border border-line bg-paper-muted px-6 py-8 text-center">
                        <p className="text-lg font-semibold text-ink">Sin mensajes todavía</p>
                        <p className="mt-2 text-sm text-ink-faint">
                          Si el worker está conectado, podés escribir abajo para enviar el primer mensaje directo.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <WhatsappChatComposer conversationId={selectedConversation.id} />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="max-w-md rounded-card border border-line bg-paper-muted px-8 py-10 text-center">
                  <p className="text-xl font-semibold text-ink">Seleccioná una conversación</p>
                  <p className="mt-2 text-sm text-ink-faint">
                    Las conversaciones aparecen cuando el worker envía o recibe mensajes. Para iniciar manualmente, programá un mensaje desde la cola.
                  </p>
                  <Link
                    href="/panel/crm/whatsapp/queue"
                    className="mt-5 inline-flex rounded-control bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent"
                  >
                    Ir a cola
                  </Link>
                </div>
              </div>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}
