"use client";

import { FormEvent, useMemo, useState } from "react";
import { formatWhatsAppPhone } from "@/lib/contact";
import { PhoneInput } from "@/components/phone-input";

const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  referred: "Referido",
  repeat: "Recurrente",
  reseller: "Revendedora"
};

const SOURCE_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "referred", label: "Referido" },
  { value: "repeat", label: "Recurrente" },
  { value: "reseller", label: "Revendedora" }
] as const;

export type CustomerRecord = {
  id: string;
  full_name: string;
  first_name?: string;
  last_name?: string | null;
  phone: string;
  alternate_phone: string | null;
  address: string | null;
  neighborhood: string | null;
  zone: string | null;
  delivery_notes: string | null;
  source: string;
  created_at: string;
};

type FormState = {
  success: boolean;
  message: string;
};

const initialState: FormState = {
  success: false,
  message: ""
};

function CustomerEditForm({
  customer,
  onCancel,
  onSaved
}: {
  customer: CustomerRecord;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<FormState>(initialState);
  const parsedFirst = customer.first_name ?? (customer.full_name.includes(" ")
    ? customer.full_name.replace(/ [^ ]+$/, "")
    : customer.full_name);
  const parsedLast = customer.last_name ?? (customer.full_name.includes(" ")
    ? customer.full_name.replace(/^.* /, "")
    : "");
  const [firstName, setFirstName] = useState(parsedFirst);
  const [lastName, setLastName] = useState(parsedLast);
  const [phone, setPhone] = useState(customer.phone);
  const [address, setAddress] = useState(customer.address ?? "");
  const [neighborhood, setNeighborhood] = useState(customer.neighborhood ?? "");
  const [zone, setZone] = useState(customer.zone ?? "");
  const [deliveryNotes, setDeliveryNotes] = useState(customer.delivery_notes ?? "");
  const [source, setSource] = useState(customer.source);
  const sourceOptions = useMemo(() => {
    if (SOURCE_OPTIONS.some((option) => option.value === customer.source)) {
      return SOURCE_OPTIONS;
    }

    return [{ value: customer.source, label: customer.source }, ...SOURCE_OPTIONS];
  }, [customer.source]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState(initialState);

    const response = await fetch(`/api/panel/customers/${customer.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        firstName,
        lastName,
        phone,
        address,
        neighborhood,
        zone,
        deliveryNotes,
        source
      })
    });

    const result = (await response.json()) as FormState;
    setState(result);
    setPending(false);

    if (!response.ok) {
      return;
    }

    window.location.reload();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-2xl border border-emerald-500/20 bg-stone-950/70 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-stone-300">
          Nombre
          <input
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <label className="grid gap-2 text-sm text-stone-300">
          Apellido
          <input
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <PhoneInput required value={phone} onChange={setPhone} className="md:col-span-2" />

        <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
          Dirección
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <label className="grid gap-2 text-sm text-stone-300">
          Barrio
          <input
            value={neighborhood}
            onChange={(event) => setNeighborhood(event.target.value)}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <label className="grid gap-2 text-sm text-stone-300">
          Zona
          <input
            value={zone}
            onChange={(event) => setZone(event.target.value)}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <label className="grid gap-2 text-sm text-stone-300">
          Origen
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none focus:border-emerald-400"
          >
            {sourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
          Notas de entrega
          <textarea
            value={deliveryNotes}
            onChange={(event) => setDeliveryNotes(event.target.value)}
            rows={3}
            className="rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-5 text-sm">
          {state.message ? (
            <p className={state.success ? "text-emerald-300" : "text-rose-300"}>{state.message}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-stone-700 px-4 py-2 text-sm text-stone-300 transition hover:border-stone-500 hover:text-stone-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function CustomerRecords({ rows, query }: { rows: CustomerRecord[]; query: string }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyState = useMemo(() => {
    return query ? `No se encontraron clientes para "${query}".` : "Todavía no hay clientes registrados.";
  }, [query]);

  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.length ? (
          rows.map((customer) => {
            const isEditing = editingId === customer.id;

            return (
              <article
                key={customer.id}
                className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-stone-50">{customer.full_name}</p>
                    <p className="mt-1 text-sm text-stone-400">
                      {formatWhatsAppPhone(customer.phone)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-300">
                      {SOURCE_LABELS[customer.source] ?? customer.source}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : customer.id)}
                      className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200 transition hover:border-sky-300/50 hover:bg-sky-500/20"
                    >
                      {isEditing ? "Cerrar" : "Editar"}
                    </button>
                  </div>
                </div>
                {(customer.neighborhood || customer.zone) ? (
                  <p className="mt-3 text-sm text-stone-400">
                    {[customer.neighborhood, customer.zone].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                {customer.address ? <p className="mt-2 text-sm text-stone-500">{customer.address}</p> : null}
                {isEditing ? (
                  <CustomerEditForm
                    customer={customer}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => setEditingId(null)}
                  />
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/70 px-4 py-8 text-center text-sm text-stone-500">
            {emptyState}
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-3xl border border-stone-800 bg-stone-900/70 md:block">
        <div className="grid grid-cols-[1.6fr_1.1fr_1.4fr_1fr_0.9fr_0.8fr] border-b border-stone-800 bg-stone-900 px-6 py-3 text-xs uppercase tracking-[0.18em] text-stone-400">
          {["Cliente", "Teléfono", "Zona", "Origen", "Alta", "Acción"].map((col) => (
            <div key={col}>{col}</div>
          ))}
        </div>
        {rows.length ? (
          rows.map((customer) => {
            const isEditing = editingId === customer.id;

            return (
              <div key={customer.id} className="border-b border-stone-800 last:border-b-0">
                <div className="grid grid-cols-[1.6fr_1.1fr_1.4fr_1fr_0.9fr_0.8fr] px-6 py-4 text-sm text-stone-300 hover:bg-stone-900/50">
                  <div className="font-medium text-stone-100">{customer.full_name}</div>
                  <div>{formatWhatsAppPhone(customer.phone)}</div>
                  <div>{[customer.neighborhood, customer.zone].filter(Boolean).join(" · ") || "-"}</div>
                  <div>{SOURCE_LABELS[customer.source] ?? customer.source}</div>
                  <div>
                    {new Date(customer.created_at).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "America/Argentina/Buenos_Aires"
                    })}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : customer.id)}
                      className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200 transition hover:border-sky-300/50 hover:bg-sky-500/20"
                    >
                      {isEditing ? "Cerrar" : "Editar"}
                    </button>
                  </div>
                </div>
                {isEditing ? (
                  <div className="px-6 pb-5">
                    <CustomerEditForm
                      customer={customer}
                      onCancel={() => setEditingId(null)}
                      onSaved={() => setEditingId(null)}
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="px-6 py-8 text-center text-sm text-stone-500">{emptyState}</div>
        )}
      </div>
    </>
  );
}
