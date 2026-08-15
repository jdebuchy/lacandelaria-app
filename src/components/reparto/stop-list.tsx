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
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-paper"
      id={stopHtmlId(stop.tripOrderId)}
      onClick={() => onOpen(stop.tripOrderId)}
      type="button"
    >
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-accent-fg ${
          delivered ? "bg-accent" : "bg-danger-bg"
        }`}
      >
        {delivered ? <CheckIcon /> : <CrossIcon />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink-soft line-through decoration-line">
          {stop.addressLine || stop.addressSummary}
        </span>
        <span className="block truncate text-[13px] text-ink-soft">
          {stop.customerName}
          {stop.deliveryFailureReason
            ? ` · ${getDeliveryFailureReasonLabel(stop.deliveryFailureReason)}`
            : ""}
        </span>
      </span>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-soft">
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
        <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-line-strong text-sm font-bold tabular-nums text-ink-soft">
          {stop.sequenceNumber}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-2xl font-bold uppercase leading-tight tracking-tight text-ink">
              {stop.addressLine || stop.addressSummary}
            </h3>
            <span className="mt-1 shrink-0 text-sm font-semibold tabular-nums text-ink-soft">
              {formatOrderNumber(stop.orderNumber)}
            </span>
          </div>
          <p className="mt-1 text-[17px] text-ink-soft">{stop.customerName}</p>
          {stop.locality ? <p className="text-sm text-ink-soft">{stop.locality}</p> : null}
          {stop.deliveryWindow ? (
            <p className="mt-2 text-sm font-semibold tabular-nums text-info-fg">
              Franja {stop.deliveryWindow}
            </p>
          ) : null}
          {stop.deliveryNotes ? (
            <p className="mt-2 text-sm text-info-fg">⚑ {stop.deliveryNotes}</p>
          ) : null}
          <p className="mt-3">
            {isPaid ? (
              <span className="inline-flex items-center rounded-control bg-paper-raised px-2.5 py-1 text-sm font-semibold text-ink-soft">
                Ya pagó
              </span>
            ) : (
              <span className="inline-flex items-center rounded-control bg-warn-bg px-2.5 py-1 text-sm font-bold tabular-nums text-accent-fg">
                A cobrar {formatCurrency(balance)}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <a
          className="inline-flex h-12 flex-1 items-center justify-center rounded-control border border-line-strong text-[15px] font-semibold text-ink transition active:bg-paper-raised"
          href={buildNavigationHref(stop)}
          rel="noreferrer"
          target="_blank"
        >
          Navegar
        </a>
        <button
          className="inline-flex h-12 flex-1 items-center justify-center rounded-control bg-ink text-[15px] font-bold text-accent-fg transition active:bg-white"
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
      <p className="px-4 py-10 text-center text-[15px] text-ink-soft">
        Este viaje no tiene paradas.
      </p>
    );
  }

  return (
    <div className="divide-y divide-line">
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
