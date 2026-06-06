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
        className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-emerald-400"
      >
        Programar mensaje
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-3xl rounded-3xl border border-stone-800 bg-stone-950 p-7 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-stone-50">Programar mensaje WhatsApp</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Se guarda en cola. El worker lo envía respetando opt-out, delay y límites.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-stone-500 transition hover:text-stone-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
              <label className="relative grid gap-2 text-sm text-stone-300">
                Cliente
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedCustomer(null);
                  }}
                  className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none focus:border-emerald-400"
                  placeholder="Buscar por nombre, teléfono o Instagram"
                />
                {results.length ? (
                  <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-2xl border border-stone-800 bg-stone-950 shadow-xl">
                    {results.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleSelect(customer)}
                        className="flex w-full items-center justify-between gap-3 border-b border-stone-800 px-4 py-3 text-left text-sm text-stone-300 last:border-b-0 hover:bg-stone-900"
                      >
                        <span>{formatPersonName(customer.first_name, customer.last_name, customer.instagram)}</span>
                        <span className="text-stone-500">{formatWhatsAppPhone(customer.phone)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-stone-300">
                  Tipo
                  <select
                    value={messageType}
                    onChange={(event) => handleMessageTypeChange(event.target.value as (typeof messageTypes)[number])}
                    className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none focus:border-emerald-400"
                  >
                    {messageTypes.map((type) => (
                      <option key={type} value={type}>
                        {getWhatsappMessageTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm text-stone-300">
                  Programado para
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(event) => setScheduledFor(event.target.value)}
                    className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none focus:border-emerald-400"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm text-stone-300">
                Pedido asociado opcional
                <input
                  value={orderId}
                  onChange={(event) => setOrderId(event.target.value)}
                  className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none focus:border-emerald-400"
                  placeholder="UUID del pedido si querés deduplicar por pedido/tipo"
                />
              </label>

              <label className="grid gap-2 text-sm text-stone-300">
                Mensaje
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={7}
                  className="rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 text-stone-100 outline-none focus:border-emerald-400"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-h-5 text-sm">
                  {feedback ? (
                    <p className={feedback.success ? "text-emerald-300" : "text-rose-300"}>
                      {feedback.message}
                    </p>
                  ) : null}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-stone-700 px-4 py-2 text-sm text-stone-300 transition hover:border-stone-500 hover:text-stone-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pending || !selectedCustomer}
                    className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
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
