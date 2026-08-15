"use client";

import { buildNavigationHref, type DeliveryExecutionStop } from "@/lib/delivery-execution";
import { getDeliveryFailureReasonLabel } from "@/lib/delivery-trips";
import { formatOrderNumber } from "@/lib/orders";
import { formatCurrency } from "@/lib/payments";

type StopListProps = {
  onOpen: (stopId: string) => void;
  stops: DeliveryExecutionStop[];
};

export function stopHtmlId(stopId: string) {
  return `parada-${stopId}`;
}

/**
 * El saldo a la vista depende del metodo esperado, porque con `unknown` el precio en
 * efectivo y por transferencia no son el mismo numero.
 */
export function displayBalance(stop: DeliveryExecutionStop) {
  return stop.paymentMethodExpected === "transfer"
    ? stop.transferPaymentBalanceAmount
    : stop.cashPaymentBalanceAmount;
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m5 13 4 4L19 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function ResolvedStop({
  onOpen,
  stop
}: {
  onOpen: (stopId: string) => void;
  stop: DeliveryExecutionStop;
}) {
  const delivered = stop.deliveryStatus === "delivered";

  return (
    <button
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-stone-900"
      id={stopHtmlId(stop.tripOrderId)}
      onClick={() => onOpen(stop.tripOrderId)}
      type="button"
    >
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-stone-950 ${
          delivered ? "bg-emerald-500" : "bg-rose-500"
        }`}
      >
        {delivered ? <CheckIcon /> : <CrossIcon />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-stone-400 line-through decoration-stone-700">
          {stop.addressLine || stop.addressSummary}
        </span>
        <span className="block truncate text-[13px] text-stone-400">
          {stop.customerName}
          {stop.deliveryFailureReason
            ? ` · ${getDeliveryFailureReasonLabel(stop.deliveryFailureReason)}`
            : ""}
        </span>
      </span>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-stone-400">
        {stop.sequenceNumber}
      </span>
    </button>
  );
}

function PendingStop({
  onOpen,
  stop
}: {
  onOpen: (stopId: string) => void;
  stop: DeliveryExecutionStop;
}) {
  const balance = displayBalance(stop);
  const isPaid = balance <= 0;

  return (
    <article className="px-4 py-4" id={stopHtmlId(stop.tripOrderId)}>
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-stone-500 text-sm font-bold tabular-nums text-stone-300">
          {stop.sequenceNumber}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-2xl font-bold uppercase leading-tight tracking-tight text-stone-50">
              {stop.addressLine || stop.addressSummary}
            </h3>
            <span className="mt-1 shrink-0 text-sm font-semibold tabular-nums text-stone-400">
              {formatOrderNumber(stop.orderNumber)}
            </span>
          </div>
          <p className="mt-1 text-[17px] text-stone-300">{stop.customerName}</p>
          {stop.locality ? <p className="text-sm text-stone-400">{stop.locality}</p> : null}
          {stop.deliveryWindow ? (
            <p className="mt-2 text-sm font-semibold tabular-nums text-sky-300">
              Franja {stop.deliveryWindow}
            </p>
          ) : null}
          {stop.deliveryNotes ? (
            <p className="mt-2 text-sm text-sky-300">⚑ {stop.deliveryNotes}</p>
          ) : null}
          <p className="mt-3">
            {isPaid ? (
              <span className="inline-flex items-center rounded-lg bg-stone-800 px-2.5 py-1 text-sm font-semibold text-stone-300">
                Ya pagó
              </span>
            ) : (
              <span className="inline-flex items-center rounded-lg bg-yellow-400 px-2.5 py-1 text-sm font-bold tabular-nums text-stone-950">
                A cobrar {formatCurrency(balance)}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <a
          className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-stone-500 text-[15px] font-semibold text-stone-100 transition active:bg-stone-800"
          href={buildNavigationHref(stop)}
          rel="noreferrer"
          target="_blank"
        >
          Navegar
        </a>
        <button
          className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-stone-100 text-[15px] font-bold text-stone-950 transition active:bg-white"
          onClick={() => onOpen(stop.tripOrderId)}
          type="button"
        >
          Abrir
        </button>
      </div>
    </article>
  );
}

export function StopList({ onOpen, stops }: StopListProps) {
  if (!stops.length) {
    return (
      <p className="px-4 py-10 text-center text-[15px] text-stone-400">
        Este viaje no tiene paradas.
      </p>
    );
  }

  return (
    <div className="divide-y divide-stone-800">
      {stops.map((stop) =>
        stop.deliveryStatus === "delivered" || stop.deliveryStatus === "failed" ? (
          <ResolvedStop key={stop.tripOrderId} onOpen={onOpen} stop={stop} />
        ) : (
          <PendingStop key={stop.tripOrderId} onOpen={onOpen} stop={stop} />
        )
      )}
    </div>
  );
}
