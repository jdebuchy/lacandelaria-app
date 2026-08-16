"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DateInput } from "@/components/date-input";
import { formatDeliveryArea } from "@/lib/address";
import { TripRouteMap } from "@/components/trip-route-map";
import type {
  DeliveryPlanningAvailableOrder,
  DeliveryPlanningDriver,
  DeliveryPlanningStop,
  DeliveryPlanningTrip
} from "@/lib/delivery-planning";
import type { DeliveryRoutePreview } from "@/lib/delivery-routing";
import { getDeliveryTripStatusLabel } from "@/lib/delivery-trips";
import { formatOrderNumber, matchesOrderNumberQuery } from "@/lib/orders";
import { matchesNormalizedSearchValues, normalizeSearchValue } from "@/lib/search";
import { formatDateFriendly as formatDate } from "@/lib/format";
import {
  describeRouteImprovement,
  formatDistanceMeters,
  formatDurationSeconds
} from "@/lib/trip-capacity";

type DeliveryTripPlannerProps = {
  drivers: DeliveryPlanningDriver[];
  initialRoute: DeliveryRoutePreview | null;
  trip: DeliveryPlanningTrip;
};

type ApiResponse = {
  message?: string;
  proposal?: DeliveryRoutePreview;
  route?: DeliveryRoutePreview;
  success: boolean;
};

type RoutingStopPayload = Pick<
  DeliveryPlanningStop,
  | "addressLine1"
  | "administrativeAreaLevel1"
  | "deliveryWindowEnd"
  | "deliveryWindowStart"
  | "googlePlaceId"
  | "locality"
  | "orderId"
  | "sequenceNumber"
>;


function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    currency: "ARS",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatWindow(start: string | null, end: string | null) {
  if (!start || !end) {
    return "Todo el día";
  }

  return `${start} - ${end}`;
}

function reorderStops(stops: DeliveryPlanningStop[], draggedId: string, targetId: string) {
  const sourceIndex = stops.findIndex((stop) => stop.orderId === draggedId);
  const targetIndex = stops.findIndex((stop) => stop.orderId === targetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return stops;
  }

  const nextStops = [...stops];
  const [movedStop] = nextStops.splice(sourceIndex, 1);
  nextStops.splice(targetIndex, 0, movedStop);
  return nextStops;
}

function compareByDateAndName(
  left: { customerName: string; deliveryDate: string | null },
  right: { customerName: string; deliveryDate: string | null }
) {
  const leftDate = left.deliveryDate ?? "9999-12-31";
  const rightDate = right.deliveryDate ?? "9999-12-31";
  return leftDate.localeCompare(rightDate) || left.customerName.localeCompare(right.customerName, "es");
}

export function DeliveryTripPlanner({ drivers, initialRoute, trip }: DeliveryTripPlannerProps) {
  const router = useRouter();
  const [scheduledDate, setScheduledDate] = useState(trip.scheduledDate);
  const [depotId, setDepotId] = useState(trip.depot.id);
  const [driverUserId, setDriverUserId] = useState(trip.driverUserId ?? "");
  const [notes, setNotes] = useState(trip.notes);
  const [stops, setStops] = useState(trip.stops);
  const [availableOrders, setAvailableOrders] = useState(trip.availableOrders);
  const [availableQuery, setAvailableQuery] = useState("");
  const [draggedStopId, setDraggedStopId] = useState<string | null>(null);
  // Pedido arrastrado desde el panel izquierdo. Es distinto de draggedStopId:
  // uno reordena dentro del viaje, el otro lo suma.
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [route, setRoute] = useState<DeliveryRoutePreview | null>(initialRoute);
  const [proposal, setProposal] = useState<DeliveryRoutePreview | null>(null);
  const [message, setMessage] = useState("");
  const [previewPending, setPreviewPending] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [optimizePending, setOptimizePending] = useState(false);
  const canEditTrip = trip.status === "assigned";
  const displayedRoute = proposal ?? route;
  const optimization = describeRouteImprovement(
    route
      ? { distanceMeters: route.totalDistanceMeters, durationSeconds: route.totalDurationSeconds }
      : null,
    {
      distanceMeters: proposal?.totalDistanceMeters ?? 0,
      durationSeconds: proposal?.totalDurationSeconds ?? 0
    }
  );
  const orderedStopIds = stops.map((stop) => stop.orderId);
  const depotOptions = useMemo(
    () =>
      trip.activeDepots.some((depot) => depot.id === trip.depot.id)
        ? trip.activeDepots
        : [trip.depot, ...trip.activeDepots],
    [trip.activeDepots, trip.depot]
  );
  const selectedDepot = useMemo(
    () => depotOptions.find((depot) => depot.id === depotId) ?? trip.depot,
    [depotId, depotOptions, trip.depot]
  );

  function toRoutingStops(nextStops: DeliveryPlanningStop[]): RoutingStopPayload[] {
    return nextStops.map((stop, index) => ({
      addressLine1: stop.addressLine1,
      administrativeAreaLevel1: stop.administrativeAreaLevel1,
      deliveryWindowEnd: stop.deliveryWindowEnd,
      deliveryWindowStart: stop.deliveryWindowStart,
      googlePlaceId: stop.googlePlaceId,
      locality: stop.locality,
      orderId: stop.orderId,
      sequenceNumber: index + 1
    }));
  }

  const filteredAvailableOrders = useMemo(() => {
    const query = normalizeSearchValue(availableQuery);

    return [...availableOrders]
      .filter((order) => {
        if (!query) {
          return true;
        }

        if (matchesOrderNumberQuery(availableQuery, order.orderNumber)) {
          return true;
        }

        return [
          order.customerName,
          order.addressSummary,
          order.deliveryArea,
          order.itemsSummary
        ].some((value) => matchesNormalizedSearchValues([value], query));
      })
      .sort(compareByDateAndName);
  }, [availableOrders, availableQuery]);

  async function fetchRoutePreview(nextStops: DeliveryPlanningStop[], nextDepotId = depotId) {
    setPreviewPending(true);

    try {
      const response = await fetch(`/api/panel/delivery-trips/${trip.id}/route-preview`, {
        body: JSON.stringify({
          depotId: nextDepotId,
          orderedStopIds: nextStops.map((stop) => stop.orderId),
          stops: toRoutingStops(nextStops)
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const result = (await response.json()) as ApiResponse;

      if (response.ok && result.route) {
        setRoute(result.route);
      }
    } finally {
      setPreviewPending(false);
    }
  }

  function handleDepotChange(nextDepotId: string) {
    if (!canEditTrip) {
      return;
    }

    setDepotId(nextDepotId);
    setProposal(null);
    void fetchRoutePreview(stops, nextDepotId);
  }

  function handleManualMove(targetStopId: string) {
    if (!draggedStopId || draggedStopId === targetStopId || !canEditTrip) {
      return;
    }

    const nextStops = reorderStops(stops, draggedStopId, targetStopId);
    setStops(nextStops);
    setProposal(null);
    setDraggedStopId(null);
    void fetchRoutePreview(nextStops);
  }

  function handleDropOnTrip() {
    setIsDropTarget(false);

    if (!draggedOrderId) {
      return;
    }

    const order = availableOrders.find((item) => item.orderId === draggedOrderId);
    setDraggedOrderId(null);

    if (order) {
      addOrderToTrip(order);
    }
  }

  function addOrderToTrip(order: DeliveryPlanningAvailableOrder) {
    if (!canEditTrip) {
      return;
    }

    const nextStop: DeliveryPlanningStop = {
      addressLine1: order.addressLine1,
      addressSummary: order.addressSummary,
      administrativeAreaLevel1: order.administrativeAreaLevel1,
      customerName: order.customerName,
      customerPhone: "-",
      deliveryArea: order.deliveryArea,
      deliveryDate: order.deliveryDate,
      deliveryStatus: "pending",
      deliveryWindowEnd: order.deliveryWindowEnd,
      deliveryWindowStart: order.deliveryWindowStart,
      flowGuidance: "Pedido agregado al viaje. Ajusta la secuencia antes de guardar.",
      flowLabel: "Viaje directo",
      flowTone: "sky",
      googlePlaceId: order.googlePlaceId,
      itemsCount: order.itemsCount,
      itemsSummary: order.itemsSummary,
      locality: order.locality,
      notes: null,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      orderStatus: "assigned",
      paymentMethodExpected: "unknown",
      paymentStatus: "pending",
      resellerName: null,
      sequenceNumber: stops.length + 1,
      totalAmount: order.totalAmount,
      tripOrderId: `pending-${order.orderId}`
    };

    const nextStops = [...stops, nextStop];
    setStops(nextStops);
    setAvailableOrders((current) => current.filter((item) => item.orderId !== order.orderId));
    setProposal(null);
    void fetchRoutePreview(nextStops);
  }

  function removeStopFromTrip(stop: DeliveryPlanningStop) {
    if (!canEditTrip) {
      return;
    }

    const nextStops = stops.filter((item) => item.orderId !== stop.orderId);
    setStops(nextStops);
    setAvailableOrders((current) =>
      [...current, {
        addressLine1: stop.addressLine1,
        addressSummary: stop.addressSummary,
        administrativeAreaLevel1: stop.administrativeAreaLevel1,
        customerName: stop.customerName,
        deliveryArea: stop.deliveryArea,
        deliveryDate: stop.deliveryDate,
        deliveryWindowEnd: stop.deliveryWindowEnd,
        deliveryWindowStart: stop.deliveryWindowStart,
        googlePlaceId: stop.googlePlaceId,
        itemsCount: stop.itemsCount,
        itemsSummary: stop.itemsSummary,
        locality: stop.locality,
        orderId: stop.orderId,
        orderNumber: stop.orderNumber,
        totalAmount: stop.totalAmount
      }].sort(compareByDateAndName)
    );
    setProposal(null);
    void fetchRoutePreview(nextStops);
  }

  async function handleSave() {
    setMessage("");
    setSavePending(true);

    try {
      const response = await fetch(`/api/panel/delivery-trips/${trip.id}/sequence`, {
        body: JSON.stringify({
          depotId,
          driverUserId: driverUserId || null,
          notes,
          orderedStopIds,
          scheduledDate
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const result = (await response.json()) as ApiResponse;
      setMessage(result.message ?? "");

      if (response.ok) {
        setProposal(null);
        router.refresh();
      }
    } finally {
      setSavePending(false);
    }
  }

  async function handleOptimize() {
    setMessage("");
    setOptimizePending(true);

    try {
      const response = await fetch(`/api/panel/delivery-trips/${trip.id}/optimize`, {
        body: JSON.stringify({
          depotId,
          orderedStopIds,
          scheduledDate,
          stops: toRoutingStops(stops)
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const result = (await response.json()) as ApiResponse;
      setMessage(result.message ?? "");

      if (response.ok && result.proposal) {
        setProposal(result.proposal);
      }
    } finally {
      setOptimizePending(false);
    }
  }

  async function handleApplyOptimization() {
    if (!proposal) {
      return;
    }

    const stopById = new Map(stops.map((stop) => [stop.orderId, stop]));
    const nextStops = proposal.orderedStopIds
      .map((stopId) => stopById.get(stopId))
      .filter((stop): stop is DeliveryPlanningStop => Boolean(stop));

    const response = await fetch(`/api/panel/delivery-trips/${trip.id}/apply-optimization`, {
      body: JSON.stringify({
        depotId,
        driverUserId: driverUserId || null,
        notes,
        orderedStopIds: proposal.orderedStopIds,
        scheduledDate
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const result = (await response.json()) as ApiResponse;
    setMessage(result.message ?? "");

    if (response.ok) {
      setStops(nextStops);
      setRoute(proposal);
      setProposal(null);
      router.refresh();
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-card border border-line bg-paper p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-display font-semibold tracking-tight text-ink">Armado del viaje</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-ink-soft">
              <span className="font-medium text-ink">
                {stops.length} {stops.length === 1 ? "parada" : "paradas"}
              </span>
              <span aria-hidden>·</span>
              <span>{formatDistanceMeters(displayedRoute?.totalDistanceMeters ?? 0)}</span>
              <span aria-hidden>·</span>
              <span>{formatDurationSeconds(displayedRoute?.totalDurationSeconds ?? 0)}</span>
              <span aria-hidden>·</span>
              <span>{getDeliveryTripStatusLabel(trip.status)}</span>
              {previewPending ? <span className="text-ink-faint">· recalculando…</span> : null}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canEditTrip || savePending}
              onClick={() => void handleSave()}
              className="inline-flex h-11 items-center justify-center rounded-control bg-accent px-5 text-body font-medium text-accent-fg transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savePending ? "Guardando..." : "Guardar viaje"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3 border-t border-line pt-4">
          <label className="grid gap-1.5 text-meta text-ink-faint">
            Fecha
            <DateInput
              value={scheduledDate}
              onChange={setScheduledDate}
              disabled={!canEditTrip}
              className="h-9 w-[9.5rem] rounded-control border border-line bg-paper-muted px-3 text-body text-ink outline-hidden focus:border-info-line disabled:opacity-60"
            />
          </label>

          <label className="grid gap-1.5 text-meta text-ink-faint">
            Repartidor
            <select
              value={driverUserId}
              onChange={(event) => setDriverUserId(event.target.value)}
              disabled={!canEditTrip}
              className="h-9 rounded-control border border-line bg-paper-muted px-3 text-body text-ink outline-hidden focus:border-info-line disabled:opacity-60"
            >
              <option value="">Sin asignar</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-meta text-ink-faint">
            Sale de
            <select
              value={depotId}
              onChange={(event) => handleDepotChange(event.target.value)}
              disabled={!canEditTrip}
              className="h-9 rounded-control border border-line bg-paper-muted px-3 text-body text-ink outline-hidden focus:border-info-line disabled:opacity-60"
            >
              {depotOptions.map((depot) => (
                <option key={depot.id} value={depot.id}>
                  {depot.label}{trip.activeDepots.some((activeDepot) => activeDepot.id === depot.id) ? "" : " (inactivo)"}
                </option>
              ))}
            </select>
          </label>

          <label className="grid min-w-[12rem] flex-1 gap-1.5 text-meta text-ink-faint">
            Notas del viaje
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={!canEditTrip}
              placeholder="Opcional"
              className="h-9 rounded-control border border-line bg-paper-muted px-3 text-body text-ink outline-hidden placeholder:text-ink-faint focus:border-info-line disabled:opacity-60"
            />
          </label>
        </div>

        {message ? <p className="mt-3 text-body text-ink-soft">{message}</p> : null}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(300px,0.85fr)_minmax(380px,1fr)]">
        <section className="rounded-card border border-line bg-paper p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-title font-semibold text-ink">Pedidos disponibles</p>
              <p className="mt-1 text-body text-ink-soft">Arrastralos a la derecha para sumarlos.</p>
            </div>
            <span className="rounded-control border border-line bg-paper-muted px-3 py-1 text-meta text-ink-soft">
              {availableOrders.length}
            </span>
          </div>

          <input
            value={availableQuery}
            onChange={(event) => setAvailableQuery(event.target.value)}
            placeholder="Buscar por cliente o dirección..."
            className="mt-4 h-11 w-full rounded-control border border-line bg-paper-muted px-4 text-body text-ink outline-hidden focus:border-info-line"
          />

          <div className="mt-4 grid gap-3">
            {filteredAvailableOrders.length ? (
              filteredAvailableOrders.map((order) => (
                <article
                  key={order.orderId}
                  draggable={canEditTrip}
                  onDragStart={() => setDraggedOrderId(order.orderId)}
                  onDragEnd={() => {
                    setDraggedOrderId(null);
                    setIsDropTarget(false);
                  }}
                  className={`rounded-card border bg-paper-muted p-4 transition ${
                    canEditTrip ? "cursor-grab active:cursor-grabbing" : ""
                  } ${draggedOrderId === order.orderId ? "border-info-line opacity-50" : "border-line"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-body font-semibold text-ink">
                        <span className="text-ink-faint">{formatOrderNumber(order.orderNumber)}</span>{" "}
                        {order.customerName}
                      </p>
                      <p className="mt-1 text-meta text-ink-faint">{order.addressSummary}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!canEditTrip}
                      onClick={() => addOrderToTrip(order)}
                      aria-label={`Agregar ${order.customerName} al viaje`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-line text-title text-ink transition hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      +
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 text-meta text-ink-soft">
                    <p>{order.itemsSummary}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-control bg-paper px-2.5 py-1">{formatDeliveryArea(order.deliveryArea)}</span>
                      <span className="rounded-control bg-paper px-2.5 py-1">
                        {formatWindow(order.deliveryWindowStart, order.deliveryWindowEnd)}
                      </span>
                      <span className="rounded-control bg-paper px-2.5 py-1">{formatCurrency(order.totalAmount)}</span>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-card border border-dashed border-line bg-paper-muted px-4 py-6 text-body text-ink-soft">
                No hay pedidos disponibles con ese filtro.
              </div>
            )}
          </div>
        </section>

        <section
          onDragOver={(event) => {
            if (draggedOrderId) {
              event.preventDefault();
              setIsDropTarget(true);
            }
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setIsDropTarget(false);
            }
          }}
          onDrop={handleDropOnTrip}
          className={`rounded-card border bg-paper p-5 transition ${
            isDropTarget ? "border-success-line ring-2 ring-success-line" : "border-line"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-title font-semibold text-ink">Paradas del viaje</p>
              <p className="mt-1 text-body text-ink-soft">Arrastrá para cambiar el orden del recorrido.</p>
            </div>
            <button
              type="button"
              disabled={!canEditTrip || optimizePending || stops.length < 2}
              onClick={() => void handleOptimize()}
              title={stops.length < 2 ? "Agregá al menos dos paradas para poder optimizar" : undefined}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-control border border-line-strong bg-paper px-4 text-body font-medium text-ink transition hover:bg-paper-raised disabled:cursor-not-allowed disabled:border-line disabled:bg-paper-muted disabled:text-ink-faint"
            >
              {optimizePending ? "Optimizando..." : "Optimizar orden"}
            </button>
          </div>

          {proposal ? (
            <div
              className={`mt-4 rounded-card border p-4 ${
                optimization.improves
                  ? "border-success-line bg-success-bg"
                  : "border-line bg-paper-muted"
              }`}
            >
              <p
                className={`text-body font-medium ${
                  optimization.improves ? "text-success-fg" : "text-ink"
                }`}
              >
                {optimization.headline}
              </p>
              <p className="mt-1 text-meta text-ink-soft">
                {formatDistanceMeters(route?.totalDistanceMeters ?? 0)} ·{" "}
                {formatDurationSeconds(route?.totalDurationSeconds ?? 0)}
                {" → "}
                {formatDistanceMeters(proposal.totalDistanceMeters)} ·{" "}
                {formatDurationSeconds(proposal.totalDurationSeconds)}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {optimization.improves ? (
                  <button
                    type="button"
                    onClick={handleApplyOptimization}
                    className="inline-flex h-9 items-center justify-center rounded-control bg-accent px-4 text-body font-medium text-accent-fg transition hover:bg-accent-strong"
                  >
                    Aplicar este orden
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setProposal(null)}
                  className="inline-flex h-9 items-center justify-center rounded-control border border-line-strong bg-paper px-4 text-body text-ink transition hover:bg-paper-raised"
                >
                  {optimization.improves ? "Descartar" : "Entendido"}
                </button>
              </div>
            </div>
          ) : null}

          {stops.length ? (
            // Pegado arriba: con muchas paradas, un mapa al final de la lista
            // queda fuera de pantalla justo cuando mas se lo mira.
            <div className="mt-4 lg:sticky lg:top-4 lg:z-10 lg:bg-paper lg:pb-3">
              <TripRouteMap depot={selectedDepot} route={displayedRoute} stops={stops} />
            </div>
          ) : null}

          <div className="mt-4 grid gap-3">
            {stops.length ? (
              stops.map((stop, index) => (
                <article
                  key={stop.orderId}
                  draggable={canEditTrip}
                  onDragStart={() => setDraggedStopId(stop.orderId)}
                  onDragEnd={() => setDraggedStopId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleManualMove(stop.orderId)}
                  className={`rounded-card border p-4 transition ${
                    draggedStopId === stop.orderId
                      ? "border-info-line bg-info-bg"
                      : "border-line bg-paper-muted hover:border-line"
                  } ${canEditTrip ? "cursor-move" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-body font-semibold text-ink">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-body font-semibold text-ink">
                          <span className="text-ink-faint">{formatOrderNumber(stop.orderNumber)}</span>{" "}
                          {stop.customerName}
                        </p>
                        <p className="mt-1 text-meta text-ink-faint">{stop.addressSummary}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-meta text-ink-soft">
                          <span className="rounded-control bg-paper px-2.5 py-1">{stop.itemsSummary}</span>
                          <span className="rounded-control bg-paper px-2.5 py-1">
                            {formatWindow(stop.deliveryWindowStart, stop.deliveryWindowEnd)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canEditTrip || stops.length === 1}
                      onClick={() => removeStopFromTrip(stop)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-line text-title text-ink transition hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      −
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div
                className={`rounded-card border border-dashed px-4 py-10 text-center text-body transition ${
                  isDropTarget
                    ? "border-success-line bg-success-bg text-success-fg"
                    : "border-line bg-paper-muted text-ink-soft"
                }`}
              >
                {isDropTarget
                  ? "Soltá para sumarlo al viaje"
                  : "Arrastrá un pedido desde la izquierda, o usá el botón +"}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
