"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type OrderDeliveryWindowFormProps = {
  initialEnd: string;
  initialStart: string;
  orderId: string;
};

/**
 * La franja de entrega salio del alta porque casi nunca aplica, pero sigue
 * alimentando al optimizador de recorrido cuando el caso lo pide.
 */
export function OrderDeliveryWindowForm({
  initialEnd,
  initialStart,
  orderId
}: OrderDeliveryWindowFormProps) {
  const router = useRouter();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  const isDirty = start !== initialStart || end !== initialEnd;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");

    const response = await fetch(`/api/panel/orders/${orderId}/delivery-window`, {
      body: JSON.stringify({ deliveryWindowEnd: end, deliveryWindowStart: start }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });

    const result = (await response.json()) as { success: boolean; message: string };

    setPending(false);
    setFailed(!response.ok);
    setMessage(result.message);

    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Entregar desde"
          type="time"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          className="h-10 rounded-control border border-line bg-paper-muted px-3 text-sm text-ink outline-hidden focus:border-info-line"
        />
        <span className="text-ink-faint">a</span>
        <input
          aria-label="Entregar hasta"
          type="time"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          className="h-10 rounded-control border border-line bg-paper-muted px-3 text-sm text-ink outline-hidden focus:border-info-line"
        />
        {isDirty ? (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-control border border-line px-3 text-sm text-ink transition hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar"}
          </button>
        ) : null}
      </div>

      {message ? (
        <p className={`text-xs ${failed ? "text-danger-fg" : "text-accent"}`}>{message}</p>
      ) : null}
    </form>
  );
}
