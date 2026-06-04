"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buildWhatsAppHref } from "@/lib/contact";
import { getDeliveryStatusLabel } from "@/lib/delivery-trips";
import { DeliveryStatus } from "@/lib/types";

type DriverStop = {
  addressSummary: string;
  customerName: string;
  customerPhone: string;
  deliveryDate: string | null;
  deliveryStatus: DeliveryStatus;
  flowGuidance: string;
  flowLabel: string;
  flowTone: "amber" | "sky" | "emerald";
  id: string;
  notes: string | null;
  orderStatus: string;
  paymentMethodExpected: string;
  paymentStatus: string;
  itemsCount: number;
  itemsSummary: string;
  resellerName: string | null;
  sequenceNumber: number;
  deliveryArea: string;
};

type DriverRouteBoardProps = {
  allowActions?: boolean;
  stops: DriverStop[];
};

type FeedbackByStop = Record<string, string>;

function toneClasses(tone: DriverStop["flowTone"]) {
  switch (tone) {
    case "amber":
      return "border-amber-400/20 bg-amber-500/10 text-amber-200";
    case "sky":
      return "border-sky-400/20 bg-sky-500/10 text-sky-200";
    default:
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  }
}

function statusLabel(status: DeliveryStatus) {
  return getDeliveryStatusLabel(status);
}

async function updateStop(orderId: string, status: DeliveryStatus) {
  const response = await fetch("/api/driver/update-delivery", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ orderId, status })
  });

  return {
    response,
    result: (await response.json()) as { success: boolean; message: string }
  };
}

export function DriverRouteBoard({ stops, allowActions = true }: DriverRouteBoardProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackByStop>({});
  const [pendingStopId, setPendingStopId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleStatusChange(orderId: string, status: DeliveryStatus) {
    setPendingStopId(orderId);
    const { response, result } = await updateStop(orderId, status);

    setFeedback((current) => ({
      ...current,
      [orderId]: result.message
    }));

    setPendingStopId(null);

    if (response.ok) {
      startTransition(() => {
        router.refresh();
      });
    }
  }

  if (!stops.length) {
    return (
      <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/70 px-6 py-10 text-sm text-stone-400">
        No hay pedidos activos para repartir.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {stops.map((stop) => {
        const isUpdating = pendingStopId === stop.id || isPending;
        const whatsappHref = buildWhatsAppHref(
          stop.customerPhone,
          `Hola ${stop.customerName}, te escribimos por tu pedido de La Candelaria.`
        );

        return (
          <article key={stop.id} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-stone-950 px-3 text-sm font-semibold text-stone-200">
                    {stop.sequenceNumber}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-xs ${toneClasses(stop.flowTone)}`}>
                    {stop.flowLabel}
                  </span>
                  <span className="rounded-full border border-stone-700 bg-stone-950 px-3 py-1 text-xs text-stone-300">
                    {statusLabel(stop.deliveryStatus)}
                  </span>
                </div>

                <div>
                  <p className="text-xl font-semibold text-stone-50">{stop.customerName}</p>
                  <p className="mt-1 text-sm text-stone-400">{stop.customerPhone}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-stone-950/80 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Área</p>
                    <p className="mt-1 text-sm text-stone-200">{stop.deliveryArea}</p>
                  </div>
                  <div className="rounded-2xl bg-stone-950/80 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Ítems</p>
                    <p className="mt-1 text-sm text-stone-200">{stop.itemsCount}</p>
                  </div>
                  <div className="rounded-2xl bg-stone-950/80 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Pago</p>
                    <p className="mt-1 text-sm text-stone-200">
                      {stop.paymentMethodExpected === "cash" ? "Efectivo" : "Transferencia"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-stone-950/80 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Cobranza</p>
                    <p className="mt-1 text-sm text-stone-200">{stop.paymentStatus}</p>
                  </div>
                </div>

                <p className="text-sm leading-6 text-stone-300">{stop.flowGuidance}</p>
                <p className="text-sm text-emerald-300">{stop.itemsSummary}</p>
                <p className="text-sm text-stone-500">{stop.addressSummary}</p>

                {stop.resellerName ? (
                  <p className="text-sm text-sky-300">Punto revendedora: {stop.resellerName}</p>
                ) : null}

                {stop.deliveryDate ? (
                  <p className="text-sm text-stone-400">Fecha prevista: {stop.deliveryDate}</p>
                ) : null}

                {stop.notes ? (
                  <div className="rounded-2xl border border-stone-800 bg-stone-950/70 p-3 text-sm text-stone-300">
                    {stop.notes}
                  </div>
                ) : null}
              </div>

              <div className="flex min-w-[240px] flex-col gap-2">
                {whatsappHref ? (
                  <Link
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20"
                  >
                    Escribir al cliente
                  </Link>
                ) : null}
                {allowActions ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(stop.id, "in_route")}
                      disabled={isUpdating}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-sky-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUpdating ? "Guardando..." : "Salir a entrega"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(stop.id, "delivered")}
                      disabled={isUpdating}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUpdating ? "Guardando..." : "Marcar entregado"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(stop.id, "failed")}
                      disabled={isUpdating}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUpdating ? "Guardando..." : "No entregado"}
                    </button>
                  </>
                ) : null}

                <div className="rounded-2xl border border-stone-800 bg-stone-950/80 p-3 text-xs text-stone-400">
                  Estado pedido: {stop.orderStatus}
                </div>

                {feedback[stop.id] ? <p className="text-xs text-stone-400">{feedback[stop.id]}</p> : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
