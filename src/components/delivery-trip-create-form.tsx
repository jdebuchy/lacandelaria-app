"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState, useTransition } from "react";

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
  drivers,
  orders
}: DeliveryTripCreateFormProps) {
  const router = useRouter();
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
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
    <form onSubmit={handleSubmit} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <label className="flex min-w-[180px] flex-1 flex-col gap-2 text-sm text-stone-300">
          <span>Fecha del viaje</span>
          <input
            type="date"
            value={scheduledDate}
            onChange={(event) => setScheduledDate(event.target.value)}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-stone-100 outline-none transition focus:border-sky-400"
            required
          />
        </label>

        <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-sm text-stone-300">
          <span>Repartidor</span>
          <select
            value={driverUserId}
            onChange={(event) => setDriverUserId(event.target.value)}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-stone-100 outline-none transition focus:border-sky-400"
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

      <label className="mt-4 flex flex-col gap-2 text-sm text-stone-300">
        <span>Notas del viaje</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className="rounded-2xl border border-stone-700 bg-stone-950 px-3 py-3 text-stone-100 outline-none transition focus:border-sky-400"
          placeholder="Indicaciones para el armado o el reparto"
        />
      </label>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="text-sm text-stone-400">
          {selectedOrderIds.length ? `${selectedOrderIds.length} pedidos seleccionados` : "Selecciona pedidos sin viaje"}
        </div>
        <button
          type="submit"
          disabled={isPending || !selectedOrderIds.length || !scheduledDate}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Creando..." : "Crear viaje"}
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-stone-400">{message}</p> : null}

      <div className="mt-5 rounded-3xl border border-stone-800 bg-stone-950/50">
        <div className="flex flex-col gap-3 border-b border-stone-800 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-stone-300">
              <span>Zona</span>
              <select
                value={areaFilter}
                onChange={(event) => setAreaFilter(event.target.value as AreaFilter)}
                className="h-10 rounded-xl border border-stone-700 bg-stone-950 px-3 text-stone-100 outline-none transition focus:border-sky-400"
              >
                <option value="all">Todos</option>
                <option value="capital_federal">Capital</option>
                <option value="province">Provincia</option>
              </select>
            </label>
            <span className="text-sm text-stone-500">{filteredOrders.length} visibles</span>
          </div>

          {filteredOrders.length ? (
            <label className="flex items-center gap-2 text-sm text-stone-300">
              <input
                type="checkbox"
                checked={visibleSelectedCount > 0 && visibleSelectedCount === filteredOrders.length}
                onChange={(event) => toggleVisibleOrders(event.target.checked)}
                className="h-4 w-4 rounded border-stone-600 bg-stone-950 text-sky-400 focus:ring-sky-400"
              />
              Seleccionar visibles
            </label>
          ) : null}
        </div>

        {filteredOrders.length ? (
          <div className="divide-y divide-stone-800">
            {filteredOrders.map((order) => {
              const checked = selectedOrderIds.includes(order.id);

              return (
                <label
                  key={order.id}
                  className={`grid cursor-pointer grid-cols-[auto_minmax(0,1.2fr)_minmax(0,0.9fr)_auto] items-center gap-3 px-4 py-3 transition ${
                    checked
                      ? "bg-sky-500/10"
                      : "hover:bg-stone-900/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOrder(order.id)}
                    className="h-4 w-4 rounded border-stone-600 bg-stone-950 text-sky-400 focus:ring-sky-400"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-100">{order.customerName}</p>
                    <p className="truncate text-xs text-stone-500">{order.label}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-stone-300">{order.itemsSummary}</p>
                  </div>
                  <div className="justify-self-end">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${
                        order.area === "capital_federal"
                          ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
                          : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                      }`}
                    >
                      {getAreaLabel(order.area)}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-6 text-sm text-stone-500">
            No hay pedidos pendientes para consolidar con ese filtro.
          </div>
        )}
      </div>
    </form>
  );
}
