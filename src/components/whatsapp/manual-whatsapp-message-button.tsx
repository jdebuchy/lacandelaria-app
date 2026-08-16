"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatPersonName, formatWhatsAppPhone } from "@/lib/contact";
import { getWhatsappMessageTypeLabel } from "@/lib/whatsapp/types";

type CustomerSearchResult = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  instagram?: string | null;
};

const messageTypes = [
  "satisfaction_check",
  "reactivation_offer",
  "transactional_reply",
  "order_confirmation",
  "human_handoff",
  "opt_out_confirmation"
] as const;

const defaultBodies: Record<(typeof messageTypes)[number], string> = {
  satisfaction_check:
    "Hola {nombre}! Soy de Paltas La Candelaria 🥑\n\nQueríamos saber cómo te fue con la caja de paltas premium de 4kg que recibiste la semana pasada.\n\n¿Llegaron bien? ¿Estaban en el punto que esperabas?",
  reactivation_offer:
    "Hola {nombre}! Ya pasaron unas semanas desde tu última caja de paltas premium 🥑\n\nEsta semana volvemos a tomar pedidos de cajas de 4kg. ¿Querés que te reserve una?",
  transactional_reply: "Hola {nombre}! Te escribimos de Paltas La Candelaria.",
  order_confirmation: "Hola {nombre}! Te compartimos el resumen del pedido para confirmar.",
  human_handoff: "Hola {nombre}! Te escribe una persona del equipo de Paltas La Candelaria.",
  opt_out_confirmation: "Listo, ya registramos tu baja para no enviarte más mensajes por WhatsApp."
};

function applyCustomerName(template: string, customer: CustomerSearchResult | null) {
  const name = customer?.first_name || customer?.last_name || "";
  return template.replaceAll("{nombre}", name || "!");
}

export function ManualWhatsappMessageButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [messageType, setMessageType] = useState<(typeof messageTypes)[number]>("transactional_reply");
  const [body, setBody] = useState(defaultBodies.transactional_reply);
  const [scheduledFor, setScheduledFor] = useState("");
  const [orderId, setOrderId] = useState("");
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (query.trim().length < 2 || selectedCustomer) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/panel/customers/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { customers: CustomerSearchResult[] };
        setResults(payload.customers);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query, selectedCustomer]);

  function handleOpen() {
    setOpen(true);
    setFeedback(null);
  }

  function handleSelect(customer: CustomerSearchResult) {
    setSelectedCustomer(customer);
    setQuery(formatPersonName(customer.first_name, customer.last_name, customer.instagram));
    setBody(applyCustomerName(defaultBodies[messageType], customer));
    setResults([]);
  }

  function handleMessageTypeChange(value: (typeof messageTypes)[number]) {
    setMessageType(value);
    setBody(applyCustomerName(defaultBodies[value], selectedCustomer));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback(null);

    const response = await fetch("/api/panel/crm/whatsapp/manual-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        customerId: selectedCustomer?.id ?? "",
        messageType,
        orderId,
        scheduledFor
      })
    });

    const result = (await response.json()) as { success: boolean; message: string };
    setPending(false);
    setFeedback(result);

    if (response.ok && result.success) {
      window.location.reload();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex h-11 items-center justify-center rounded-control bg-accent px-4 text-body font-medium text-accent-fg transition hover:bg-accent"
      >
        Programar mensaje
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
          <div className="my-8 w-full max-w-3xl rounded-card border border-line bg-paper-muted p-7 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-title font-semibold text-ink">Programar mensaje WhatsApp</h2>
                <p className="mt-1 text-body text-ink-faint">
                  Se guarda en cola. El worker lo envía respetando opt-out, delay y límites.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-ink-faint transition hover:text-ink-soft"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
              <label className="relative grid gap-2 text-body text-ink-soft">
                Cliente
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedCustomer(null);
                  }}
                  className="h-11 rounded-control border border-line bg-paper-muted px-4 text-ink outline-hidden focus:border-accent"
                  placeholder="Buscar por nombre, teléfono o Instagram"
                />
                {results.length ? (
                  <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-card border border-line bg-paper-muted shadow-xl">
                    {results.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleSelect(customer)}
                        className="flex w-full items-center justify-between gap-3 border-b border-line px-4 py-3 text-left text-body text-ink-soft last:border-b-0 hover:bg-paper"
                      >
                        <span>{formatPersonName(customer.first_name, customer.last_name, customer.instagram)}</span>
                        <span className="text-ink-faint">{formatWhatsAppPhone(customer.phone)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-body text-ink-soft">
                  Tipo
                  <select
                    value={messageType}
                    onChange={(event) => handleMessageTypeChange(event.target.value as (typeof messageTypes)[number])}
                    className="h-11 rounded-control border border-line bg-paper-muted px-4 text-ink outline-hidden focus:border-accent"
                  >
                    {messageTypes.map((type) => (
                      <option key={type} value={type}>
                        {getWhatsappMessageTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-body text-ink-soft">
                  Programado para
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(event) => setScheduledFor(event.target.value)}
                    className="h-11 rounded-control border border-line bg-paper-muted px-4 text-ink outline-hidden focus:border-accent"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-body text-ink-soft">
                Pedido asociado opcional
                <input
                  value={orderId}
                  onChange={(event) => setOrderId(event.target.value)}
                  className="h-11 rounded-control border border-line bg-paper-muted px-4 text-ink outline-hidden focus:border-accent"
                  placeholder="UUID del pedido si querés deduplicar por pedido/tipo"
                />
              </label>

              <label className="grid gap-2 text-body text-ink-soft">
                Mensaje
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={7}
                  className="rounded-control border border-line bg-paper-muted px-4 py-3 text-ink outline-hidden focus:border-accent"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-h-5 text-body">
                  {feedback ? (
                    <p className={feedback.success ? "text-accent" : "text-danger-fg"}>
                      {feedback.message}
                    </p>
                  ) : null}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-control border border-line px-4 py-2 text-body text-ink-soft transition hover:border-line-strong hover:text-ink"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pending || !selectedCustomer}
                    className="rounded-control bg-accent px-4 py-2 text-body font-medium text-accent-fg transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pending ? "Programando..." : "Guardar en cola"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
