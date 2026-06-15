"use client";

import { FormEvent, useState } from "react";
import { AddressInput } from "@/components/address-input";
import { EMPTY_STRUCTURED_ADDRESS, type StructuredAddress } from "@/lib/address";
import { formatLogisticsDepotAddress } from "@/lib/logistics-depots";

type DepotRecord = {
  active: boolean;
  address_line_1: string;
  administrative_area_level_1: string;
  code: string;
  google_place_id: string | null;
  id: string;
  label: string;
  locality: string;
};

type LogisticsDepotsManagerProps = {
  depots: DepotRecord[];
};

type DepotFormState = {
  active: boolean;
  address: StructuredAddress;
  label: string;
};

type Feedback = {
  message: string;
  success: boolean;
};

const emptyFeedback: Feedback = {
  message: "",
  success: false
};

const emptyDepotForm: DepotFormState = {
  active: true,
  address: EMPTY_STRUCTURED_ADDRESS,
  label: ""
};

function formStateFromDepot(depot: DepotRecord): DepotFormState {
  return {
    active: depot.active,
    address: {
      ...EMPTY_STRUCTURED_ADDRESS,
      addressLine1: depot.address_line_1,
      administrativeAreaLevel1: depot.administrative_area_level_1,
      googlePlaceId: depot.google_place_id ?? "",
      locality: depot.locality,
      addressSource: depot.google_place_id ? "google_places" : "manual"
    },
    label: depot.label
  };
}

export function LogisticsDepotsManager({ depots }: LogisticsDepotsManagerProps) {
  const [newDepot, setNewDepot] = useState<DepotFormState>(emptyDepotForm);
  const [forms, setForms] = useState<Record<string, DepotFormState>>(() =>
    Object.fromEntries(depots.map((depot) => [depot.id, formStateFromDepot(depot)]))
  );
  const [feedback, setFeedback] = useState<Feedback>(emptyFeedback);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function updateForm(depotId: string, patch: Partial<DepotFormState>) {
    setForms((current) => ({
      ...current,
      [depotId]: {
        ...current[depotId],
        ...patch
      }
    }));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(emptyFeedback);
    setPendingId("new");

    const response = await fetch("/api/panel/logistics-depots", {
      body: JSON.stringify(newDepot),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const result = (await response.json()) as Feedback;
    setFeedback(result);
    setPendingId(null);

    if (response.ok) {
      setNewDepot(emptyDepotForm);
      window.location.reload();
    }
  }

  async function handleUpdate(depotId: string) {
    const form = forms[depotId];

    if (!form) {
      return;
    }

    setFeedback(emptyFeedback);
    setPendingId(depotId);

    const response = await fetch(`/api/panel/logistics-depots/${depotId}`, {
      body: JSON.stringify(form),
      headers: {
        "Content-Type": "application/json"
      },
      method: "PATCH"
    });
    const result = (await response.json()) as Feedback;
    setFeedback(result);
    setPendingId(null);

    if (response.ok) {
      window.location.reload();
    }
  }

  const inputClass =
    "h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none transition focus:border-sky-400";

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-stone-50">Depósitos de salida</h2>
        <p className="text-sm text-stone-400">
          Administrá domicilios que pueden funcionar como origen y destino de un viaje.
        </p>
      </div>

      {feedback.message ? (
        <p className={`mt-4 text-sm ${feedback.success ? "text-emerald-300" : "text-rose-300"}`}>
          {feedback.message}
        </p>
      ) : null}

      <form onSubmit={handleCreate} className="mt-5 grid gap-4 rounded-2xl border border-stone-800 bg-stone-950/60 p-4">
        <p className="text-sm font-medium text-stone-100">Nuevo depósito</p>
        <label className="grid gap-2 text-sm text-stone-300">
          Nombre del depósito
          <input
            value={newDepot.label}
            onChange={(event) => setNewDepot((current) => ({ ...current, label: event.target.value }))}
            className={inputClass}
            placeholder="Casa Juan"
            required
          />
        </label>
        <AddressInput
          value={newDepot.address}
          onChange={(address) => setNewDepot((current) => ({ ...current, address }))}
          required
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pendingId === "new"}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingId === "new" ? "Creando..." : "Crear depósito"}
          </button>
        </div>
      </form>

      <div className="mt-5 grid gap-3">
        {depots.length ? (
          depots.map((depot) => {
            const form = forms[depot.id] ?? formStateFromDepot(depot);

            return (
              <article key={depot.id} className="rounded-2xl border border-stone-800 bg-stone-950/60 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-stone-100">{depot.label}</p>
                      <span className="rounded-full border border-stone-700 bg-stone-900 px-2.5 py-1 text-xs text-stone-300">
                        {depot.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      {formatLogisticsDepotAddress({
                        addressLine1: depot.address_line_1,
                        administrativeAreaLevel1: depot.administrative_area_level_1,
                        locality: depot.locality
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleUpdate(depot.id)}
                    disabled={pendingId === depot.id}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-700 px-4 text-sm font-medium text-stone-100 transition hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingId === depot.id ? "Guardando..." : "Guardar"}
                  </button>
                </div>

                <div className="mt-4 grid gap-4">
                  <label className="grid gap-2 text-sm text-stone-300">
                    Nombre del depósito
                    <input
                      value={form.label}
                      onChange={(event) => updateForm(depot.id, { label: event.target.value })}
                      className={inputClass}
                      placeholder="Nombre"
                    />
                  </label>
                  <AddressInput
                    value={form.address}
                    onChange={(address) => updateForm(depot.id, { address })}
                    required
                  />
                  <label className="grid gap-2 text-sm text-stone-300">
                    Google Place ID
                    <input
                      value={form.address.googlePlaceId}
                      readOnly
                      className="h-10 rounded-xl border border-stone-800 bg-stone-950/70 px-3 text-sm text-stone-500 outline-none"
                      placeholder="Se completa al elegir una sugerencia"
                    />
                  </label>
                </div>

                <label className="mt-3 flex items-center gap-3 text-sm text-stone-300">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) => updateForm(depot.id, { active: event.target.checked })}
                    className="h-4 w-4 rounded border-stone-600 bg-stone-950 text-sky-400 focus:ring-sky-400"
                  />
                  Disponible para nuevos viajes
                </label>
              </article>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-800 bg-stone-950/40 px-4 py-6 text-sm text-stone-400">
            Todavía no hay depósitos cargados.
          </div>
        )}
      </div>
    </section>
  );
}
