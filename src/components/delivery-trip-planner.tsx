"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DateInput } from "@/components/date-input";
import { TripRouteMap } from "@/components/trip-route-map";
import type {
  DeliveryPlanningAvailableOrder,
  DeliveryPlanningDriver,
  DeliveryPlanningStop,
  DeliveryPlanningTrip
} from "@/lib/delivery-planning";
import type { DeliveryRoutePreview } from "@/lib/delivery-routing";
import { formatLogisticsDepotAddress } from "@/lib/logistics-depots";
import { getDeliveryTripStatusLabel } from "@/lib/delivery-trips";
import { matchesNormalizedSearchValues, normalizeSearchValue } from "@/lib/search";

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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

function formatDistance(distanceMeters: number) {
  if (!distanceMeters) {
    return "Sin distancia";
  }

  return distanceMeters >= 1000
    ? `${(distanceMeters / 1000).toFixed(1).replace(".", ",")} km`
    : `${Math.round(distanceMeters)} m`;
}

function formatDuration(seconds: number) {
  if (!seconds) {
    return "Sin duración";
  }

  const roundedMinutes = Math.round(seconds / 60);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (!hours) {
    return `${minutes} min`;
  }

  return `${hours} h ${minutes.toString().padStart(2, "0")} min`;
}

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
  const [route, setRoute] = useState<DeliveryRoutePreview | null>(initialRoute);
  const [proposal, setProposal] = useState<DeliveryRoutePreview | null>(null);
  const [message, setMessage] = useState("");
  const [previewPending, setPreviewPending] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [optimizePending, setOptimizePending] = useState(false);
  const canEditTrip = trip.status === "assigned";
  const displayedRoute = proposal ?? route;
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
      orderStatus: "assigned",
      paymentMethodExpected: "cash",
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
      <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-3xl font-semibold tracking-tight text-stone-50">Planificador de viaje</p>
            <p className="mt-2 text-sm text-stone-400">
              Sumá pedidos, ordená las paradas y revisá la ruta antes de guardar.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canEditTrip || savePending}
              onClick={() => void handleSave()}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-700 px-4 text-sm font-medium text-stone-100 transition hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savePending ? "Guardando..." : "Guardar viaje"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <label className="grid gap-2 rounded-2xl border border-stone-800 bg-stone-950/70 p-4 text-sm text-stone-300">
            <span className="text-xs uppercase tracking-[0.18em] text-stone-500">Fecha del viaje</span>
            <DateInput
              value={scheduledDate}
              onChange={setScheduledDate}
              disabled={!canEditTrip}
              className="h-10 rounded-xl border border-stone-700 bg-stone-950 px-3 text-stone-100 outline-none focus:border-sky-400 disabled:opacity-60"
            />
          </label>
          <label className="grid gap-2 rounded-2xl border border-stone-800 bg-stone-950/70 p-4 text-sm text-stone-300">
            <span className="text-xs uppercase tracking-[0.18em] text-stone-500">Repartidor</span>
            <select
              value={driverUserId}
              onChange={(event) => setDriverUserId(event.target.value)}
              disabled={!canEditTrip}
              className="h-10 rounded-xl border border-stone-700 bg-stone-950 px-3 text-stone-100 outline-none focus:border-sky-400 disabled:opacity-60"
            >
              <option value="">Sin asignar</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Estado</p>
            <p className="mt-2 text-sm font-medium text-stone-100">{getDeliveryTripStatusLabel(trip.status)}</p>
          </div>
          <label className="grid gap-2 rounded-2xl border border-stone-800 bg-stone-950/70 p-4 text-sm text-stone-300">
            <span className="text-xs uppercase tracking-[0.18em] text-stone-500">Depósito</span>
            <select
              value={depotId}
              onChange={(event) => handleDepotChange(event.target.value)}
              disabled={!canEditTrip}
              className="h-10 rounded-xl border border-stone-700 bg-stone-950 px-3 text-stone-100 outline-none focus:border-sky-400 disabled:opacity-60"
            >
              {depotOptions.map((depot) => (
                <option key={depot.id} value={depot.id}>
                  {depot.label}{trip.activeDepots.some((activeDepot) => activeDepot.id === depot.id) ? "" : " (inactivo)"}
                </option>
              ))}
            </select>
            <span className="text-xs text-stone-500">{formatLogisticsDepotAddress(selectedDepot)}</span>
          </label>
          <div className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Pedidos</p>
            <p className="mt-2 text-sm font-medium text-stone-100">{stops.length}</p>
          </div>
          <div className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Distancia</p>
            <p className="mt-2 text-sm font-medium text-stone-100">
              {formatDistance(displayedRoute?.totalDistanceMeters ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Duración</p>
            <p className="mt-2 text-sm font-medium text-stone-100">
              {formatDuration(displayedRoute?.totalDurationSeconds ?? 0)}
            </p>
          </div>
          <label className="grid gap-2 rounded-2xl border border-stone-800 bg-stone-950/70 p-4 text-sm text-stone-300 md:col-span-2 xl:col-span-6">
            <span className="text-xs uppercase tracking-[0.18em] text-stone-500">Notas del viaje</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={!canEditTrip}
              className="rounded-xl border border-stone-700 bg-stone-950 px-3 py-3 text-stone-100 outline-none focus:border-sky-400 disabled:opacity-60"
            />
          </label>
        </div>

        {message ? <p className="mt-4 text-sm text-stone-300">{message}</p> : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.9fr)_minmax(320px,1fr)_minmax(360px,1.15fr)]">
        <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-stone-50">Pedidos disponibles</p>
              <p className="mt-1 text-sm text-stone-400">Agregá pedidos al viaje.</p>
            </div>
            <span className="rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs text-stone-300">
              {availableOrders.length}
            </span>
          </div>

          <input
            value={availableQuery}
            onChange={(event) => setAvailableQuery(event.target.value)}
            placeholder="Buscar por cliente o dirección..."
            className="mt-4 h-11 w-full rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-sky-400"
          />

          <div className="mt-4 grid gap-3">
            {filteredAvailableOrders.length ? (
              filteredAvailableOrders.map((order) => (
                <article key={order.orderId} className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-100">{order.customerName}</p>
                      <p className="mt-1 text-xs text-stone-500">{order.addressSummary}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!canEditTrip}
                      onClick={() => addOrderToTrip(order)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-700 text-lg text-stone-100 transition hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      +
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-stone-400">
                    <p>{order.itemsSummary}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-stone-900 px-2.5 py-1">{order.deliveryArea}</span>
                      <span className="rounded-full bg-stone-900 px-2.5 py-1">
                        {formatWindow(order.deliveryWindowStart, order.deliveryWindowEnd)}
                      </span>
                      <span className="rounded-full bg-stone-900 px-2.5 py-1">{formatCurrency(order.totalAmount)}</span>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-stone-800 bg-stone-950/40 px-4 py-6 text-sm text-stone-400">
                No hay pedidos disponibles con ese filtro.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-stone-50">Paradas del viaje</p>
              <p className="mt-1 text-sm text-stone-400">Arrastrá para reordenar las paradas del recorrido.</p>
            </div>
            <button
              type="button"
              disabled={!canEditTrip || previewPending || optimizePending || !stops.length}
              onClick={() => void handleOptimize()}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-sky-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {optimizePending ? "Optimizando..." : "Optimizar trayecto"}
            </button>
          </div>

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
                  className={`rounded-3xl border p-4 transition ${
                    draggedStopId === stop.orderId
                      ? "border-sky-400/40 bg-sky-500/10"
                      : "border-stone-800 bg-stone-950/70 hover:border-stone-700"
                  } ${canEditTrip ? "cursor-move" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-700 bg-stone-900 text-sm font-semibold text-stone-100">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-100">{stop.customerName}</p>
                        <p className="mt-1 text-xs text-stone-500">{stop.addressSummary}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-400">
                          <span className="rounded-full bg-stone-900 px-2.5 py-1">{stop.itemsSummary}</span>
                          <span className="rounded-full bg-stone-900 px-2.5 py-1">
                            {formatWindow(stop.deliveryWindowStart, stop.deliveryWindowEnd)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canEditTrip || stops.length === 1}
                      onClick={() => removeStopFromTrip(stop)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-700 text-lg text-stone-100 transition hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      −
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-stone-800 bg-stone-950/40 px-4 py-6 text-sm text-stone-400">
                Todavía no sumaste pedidos al viaje.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6">
          <TripRouteMap depot={selectedDepot} route={displayedRoute} stops={stops} />

          {proposal ? (
            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5">
              <p className="text-lg font-semibold text-emerald-100">Resumen de optimización</p>
              <p className="mt-1 text-sm text-emerald-200/80">
                Compará la ruta actual con la propuesta optimizada antes de aplicarla.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-300/20 bg-stone-950/40 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">Distancia actual</p>
                  <p className="mt-2 text-base font-medium text-emerald-50">
                    {formatDistance(route?.totalDistanceMeters ?? 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-300/20 bg-stone-950/40 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">Distancia optimizada</p>
                  <p className="mt-2 text-base font-medium text-emerald-50">
                    {formatDistance(proposal.totalDistanceMeters)}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-300/20 bg-stone-950/40 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">Tiempo actual</p>
                  <p className="mt-2 text-base font-medium text-emerald-50">
                    {formatDuration(route?.totalDurationSeconds ?? 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-300/20 bg-stone-950/40 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">Tiempo optimizado</p>
                  <p className="mt-2 text-base font-medium text-emerald-50">
                    {formatDuration(proposal.totalDurationSeconds)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleApplyOptimization}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-400 px-4 text-sm font-medium text-stone-950 transition hover:bg-emerald-300"
                >
                  Aplicar propuesta
                </button>
                <button
                  type="button"
                  onClick={() => setProposal(null)}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-300/30 px-4 text-sm text-emerald-100 transition hover:border-emerald-200"
                >
                  Descartar
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
