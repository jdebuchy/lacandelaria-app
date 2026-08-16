"use client";

import { useRouter } from "next/navigation";
import { ZoneStamp } from "@/components/ui/badge";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { DateInput } from "@/components/date-input";
import {
  DEFAULT_LOGISTICS_DEPOT_CODE,
  formatLogisticsDepotAddress,
  type LogisticsDepot
} from "@/lib/logistics-depots";

type SelectableOrder = {
  area: string;
  customerName: string;
  deliveryDate: string | null;
  id: string;
  itemsSummary: string;
  label: string;
};

type DriverOption = {
  id: string;
  name: string;
};

type DeliveryTripCreateFormProps = {
  defaultDate: string;
  depots: LogisticsDepot[];
  drivers: DriverOption[];
  orders: SelectableOrder[];
};

type AreaFilter = "all" | "capital_federal" | "province";

function getAreaLabel(area: string) {
  if (area === "capital_federal") {
    return "Capital";
  }

  if (area === "pending_review") {
    return "Revisar";
  }

  return "Provincia";
}

export function DeliveryTripCreateForm({
  defaultDate,
  depots,
  drivers,
  orders
}: DeliveryTripCreateFormProps) {
  const router = useRouter();
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const [depotId, setDepotId] = useState(
    depots.find((depot) => depot.code === DEFAULT_LOGISTICS_DEPOT_CODE)?.id ?? depots[0]?.id ?? ""
  );
  const [driverUserId, setDriverUserId] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [areaFilter, setAreaFilter] = useState<AreaFilter>("all");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const sortedOrders = useMemo(
    () =>
      [...orders].sort((left, right) => {
        const leftDate = left.deliveryDate ?? "9999-12-31";
        const rightDate = right.deliveryDate ?? "9999-12-31";
        return leftDate.localeCompare(rightDate) || left.customerName.localeCompare(right.customerName, "es");
      }),
    [orders]
  );

  const filteredOrders = useMemo(
    () =>
      sortedOrders.filter((order) => {
        if (areaFilter === "capital_federal") {
          return order.area === "capital_federal";
        }

        if (areaFilter === "province") {
          return order.area !== "capital_federal";
        }

        return true;
      }),
    [areaFilter, sortedOrders]
  );

  const visibleSelectedCount = filteredOrders.filter((order) => selectedOrderIds.includes(order.id)).length;

  function toggleOrder(orderId: string) {
    setSelectedOrderIds((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId]
    );
  }

  function toggleVisibleOrders(nextChecked: boolean) {
    const visibleIds = filteredOrders.map((order) => order.id);

    setSelectedOrderIds((current) => {
      if (nextChecked) {
        return Array.from(new Set([...current, ...visibleIds]));
      }

      return current.filter((id) => !visibleIds.includes(id));
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/panel/delivery-trips", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        depotId,
        scheduledDate,
        driverUserId,
        notes,
        orderIds: selectedOrderIds
      })
    });

    const result = (await response.json()) as { success: boolean; message: string; tripId?: string };
    setMessage(result.message);

    if (!response.ok) {
      return;
    }

    setSelectedOrderIds([]);
    setNotes("");
    startTransition(() => {
      if (result.tripId) {
        router.push(`/panel/logistics/${result.tripId}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card border border-line bg-paper p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <label className="flex min-w-[240px] flex-1 flex-col gap-2 text-body text-ink-soft">
          <span>Depósito de salida</span>
          <select
            value={depotId}
            onChange={(event) => setDepotId(event.target.value)}
            className="h-11 rounded-control border border-line bg-paper-muted px-3 text-ink outline-hidden transition focus:border-info-line"
            required
          >
            {depots.map((depot) => (
              <option key={depot.id} value={depot.id}>
                {depot.label} · {formatLogisticsDepotAddress(depot)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[180px] flex-1 flex-col gap-2 text-body text-ink-soft">
          <span>Fecha del viaje</span>
          <DateInput
            value={scheduledDate}
            onChange={setScheduledDate}
            className="h-11 rounded-control border border-line bg-paper-muted px-3 text-ink outline-hidden transition focus:border-info-line"
            required
          />
        </label>

        <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-body text-ink-soft">
          <span>Repartidor</span>
          <select
            value={driverUserId}
            onChange={(event) => setDriverUserId(event.target.value)}
            className="h-11 rounded-control border border-line bg-paper-muted px-3 text-ink outline-hidden transition focus:border-info-line"
          >
            <option value="">Sin asignar</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 flex flex-col gap-2 text-body text-ink-soft">
        <span>Notas del viaje</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className="rounded-card border border-line bg-paper-muted px-3 py-3 text-ink outline-hidden transition focus:border-info-line"
          placeholder="Indicaciones para el armado o el reparto"
        />
      </label>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="text-body text-ink-soft">
          {selectedOrderIds.length ? `${selectedOrderIds.length} pedidos seleccionados` : "Selecciona pedidos sin viaje"}
        </div>
        <button
          type="submit"
          disabled={isPending || !selectedOrderIds.length || !scheduledDate || !depotId}
          className="inline-flex h-11 items-center justify-center rounded-control bg-accent px-4 text-body font-medium text-accent-fg transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Creando..." : "Crear viaje"}
        </button>
      </div>

      {message ? <p className="mt-3 text-body text-ink-soft">{message}</p> : null}

      <div className="mt-5 rounded-card border border-line bg-paper-muted">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-body text-ink-soft">
              <span>Zona</span>
              <select
                value={areaFilter}
                onChange={(event) => setAreaFilter(event.target.value as AreaFilter)}
                className="h-10 rounded-control border border-line bg-paper-muted px-3 text-ink outline-hidden transition focus:border-info-line"
              >
                <option value="all">Todos</option>
                <option value="capital_federal">Capital</option>
                <option value="province">Provincia</option>
              </select>
            </label>
            <span className="text-body text-ink-faint">{filteredOrders.length} visibles</span>
          </div>

          {filteredOrders.length ? (
            <label className="flex items-center gap-2 text-body text-ink-soft">
              <input
                type="checkbox"
                checked={visibleSelectedCount > 0 && visibleSelectedCount === filteredOrders.length}
                onChange={(event) => toggleVisibleOrders(event.target.checked)}
                className="h-4 w-4 rounded-control border-line bg-paper-muted text-info-fg focus:ring-info-fg"
              />
              Seleccionar visibles
            </label>
          ) : null}
        </div>

        {filteredOrders.length ? (
          <div className="divide-y divide-line">
            {filteredOrders.map((order) => {
              const checked = selectedOrderIds.includes(order.id);

              return (
                <label
                  key={order.id}
                  className={`grid cursor-pointer grid-cols-[auto_minmax(0,1.2fr)_minmax(0,0.9fr)_auto] items-center gap-3 px-4 py-3 transition ${
                    checked
                      ? "bg-info-bg"
                      : "hover:bg-paper"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOrder(order.id)}
                    className="h-4 w-4 rounded-control border-line bg-paper-muted text-info-fg focus:ring-info-fg"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium text-ink">{order.customerName}</p>
                    <p className="truncate text-meta text-ink-faint">{order.label}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-body text-ink-soft">{order.itemsSummary}</p>
                  </div>
                  {/* Aca el sello se gana el lugar: la zona es el criterio con
                      el que se decide que pedidos entran en cada camioneta, y
                      aparece agrupado en vez de salpicado en 50 filas. */}
                  <div className="justify-self-end">
                    <ZoneStamp>{getAreaLabel(order.area)}</ZoneStamp>
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-6 text-body text-ink-faint">
            No hay pedidos pendientes para consolidar con ese filtro.
          </div>
        )}
      </div>
    </form>
  );
}
