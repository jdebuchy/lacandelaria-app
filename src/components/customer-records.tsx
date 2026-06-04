"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { AddressInput } from "@/components/address-input";
import { AutofillDecoy } from "@/components/autofill-decoy";
import {
  StructuredAddress,
  formatStructuredAddressLine,
  formatStructuredAddressSummary
} from "@/lib/address";
import { formatPersonName, formatWhatsAppPhone } from "@/lib/contact";
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
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  instagram?: string | null;
  address_kind: StructuredAddress["addressKind"];
  address_line_1: string | null;
  address_line_2: string | null;
  gated_community_name: string | null;
  locality: string | null;
  administrative_area_level_1: string | null;
  postal_code: string | null;
  google_place_id: string | null;
  google_place_label: string | null;
  address_source: StructuredAddress["addressSource"] | null;
  delivery_area: string | null;
  delivery_notes: string | null;
  source: string;
  created_at: string;
  updated_at?: string | null;
};

type FormState = {
  success: boolean;
  message: string;
};

type SortKey = "updated_at" | "last_name" | "created_at";
type SortDirection = "asc" | "desc";

const initialState: FormState = {
  success: false,
  message: ""
};

function CustomerEditForm({
  customer,
  onCancel
}: {
  customer: CustomerRecord;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<FormState>(initialState);
  const [firstName, setFirstName] = useState(customer.first_name ?? "");
  const [lastName, setLastName] = useState(customer.last_name ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [instagram, setInstagram] = useState(customer.instagram ?? "");
  const [address, setAddress] = useState<StructuredAddress>({
    addressKind: customer.address_kind ?? "standard",
    addressLine1: customer.address_line_1 ?? "",
    addressLine2: customer.address_line_2 ?? "",
    gatedCommunityName: customer.gated_community_name ?? "",
    locality: customer.locality ?? "",
    administrativeAreaLevel1: customer.administrative_area_level_1 ?? "",
    postalCode: customer.postal_code ?? "",
    googlePlaceId: customer.google_place_id ?? "",
    googlePlaceLabel: customer.google_place_label ?? "",
    addressSource: customer.address_source ?? "manual"
  });
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
        instagram,
        ...address,
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
    <form onSubmit={handleSubmit} autoComplete="off" className="mt-4 rounded-2xl border border-emerald-500/20 bg-stone-950/70 p-4">
      <AutofillDecoy />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-stone-300">
          Nombre
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <label className="grid gap-2 text-sm text-stone-300">
          Apellido
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <PhoneInput value={phone} onChange={setPhone} />

        <label className="grid gap-2 text-sm text-stone-300">
          Instagram
          <input
            value={instagram}
            onChange={(event) => setInstagram(event.target.value)}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-stone-100 outline-none focus:border-emerald-400"
            placeholder="usuario"
          />
          <span aria-hidden="true" className="text-xs text-transparent">
            .
          </span>
        </label>
        <AddressInput
          required
          value={address}
          onChange={setAddress}
          className="md:col-span-2"
          afterPostalCode={
            <>
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
            </>
          }
        />

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

function SortHeader({
  label,
  href,
  active,
  direction
}: {
  label: string;
  href?: string;
  active?: boolean;
  direction?: SortDirection;
}) {
  if (!href) {
    return <div>{label}</div>;
  }

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 transition hover:text-stone-200 ${active ? "text-stone-200" : ""}`}
    >
      <span>{label}</span>
      {active ? <span className="text-[10px]">{direction === "asc" ? "↑" : "↓"}</span> : null}
    </Link>
  );
}

export function CustomerRecords({
  rows,
  query,
  sort,
  direction,
  sortLinks
}: {
  rows: CustomerRecord[];
  query: string;
  sort: SortKey;
  direction: SortDirection;
  sortLinks: {
    lastName: string;
    createdAt: string;
  };
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FormState>(initialState);

  const emptyState = useMemo(() => {
    return query ? `No se encontraron clientes para "${query}".` : "Todavía no hay clientes registrados.";
  }, [query]);

  async function handleDelete(customer: CustomerRecord) {
    const displayName = formatPersonName(customer.first_name, customer.last_name, customer.instagram);
    const confirmed = window.confirm(`¿Seguro que quieres borrar a ${displayName}?`);

    if (!confirmed) {
      return;
    }

    setDeletingId(customer.id);
    setFeedback(initialState);

    const response = await fetch(`/api/panel/customers/${customer.id}`, {
      method: "DELETE"
    });

    const result = (await response.json()) as FormState;
    setDeletingId(null);
    setFeedback(result);

    if (!response.ok) {
      return;
    }

    window.location.reload();
  }

  return (
    <>
      {feedback.message ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${
          feedback.success
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
            : "border-rose-500/30 bg-rose-500/10 text-rose-200"
        }`}>
          {feedback.message}
        </div>
      ) : null}

      <div className="space-y-3 md:hidden">
        {rows.length ? (
          rows.map((customer) => {
            const isEditing = editingId === customer.id;
            const displayName = formatPersonName(
              customer.first_name,
              customer.last_name,
              customer.instagram
            );

            return (
              <article
                key={customer.id}
                className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-stone-50">{displayName}</p>
                    <p className="mt-1 text-sm text-stone-400">
                      {formatWhatsAppPhone(customer.phone)}
                    </p>
                    {customer.instagram ? (
                      <p className="mt-1 text-xs text-stone-500">{customer.instagram}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-300">
                      {SOURCE_LABELS[customer.source] ?? customer.source}
                    </span>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(isEditing ? null : customer.id)}
                        className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200 transition hover:border-sky-300/50 hover:bg-sky-500/20"
                      >
                        {isEditing ? "Cerrar" : "Editar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(customer)}
                        disabled={deletingId === customer.id}
                        className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-200 transition hover:border-rose-300/50 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === customer.id ? "Borrando..." : "Borrar"}
                      </button>
                    </div>
                  </div>
                </div>
                {customer.delivery_area ? (
                  <p className="mt-3 text-sm text-stone-400">
                    Área logística: {customer.delivery_area}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-stone-500">
                  {formatStructuredAddressSummary({
                    addressKind: customer.address_kind,
                    addressLine1: customer.address_line_1 ?? "",
                    gatedCommunityName: customer.gated_community_name ?? "",
                    locality: customer.locality ?? ""
                  })}
                </p>
                {formatStructuredAddressLine({
                  addressKind: customer.address_kind,
                  addressLine1: customer.address_line_1 ?? "",
                  addressLine2: customer.address_line_2 ?? "",
                  gatedCommunityName: customer.gated_community_name ?? ""
                }) ? (
                  <p className="mt-1 text-xs text-stone-600">{formatStructuredAddressLine({
                    addressKind: customer.address_kind,
                    addressLine1: customer.address_line_1 ?? "",
                    addressLine2: customer.address_line_2 ?? "",
                    gatedCommunityName: customer.gated_community_name ?? ""
                  })}</p>
                ) : null}
                {isEditing ? (
                  <CustomerEditForm
                    customer={customer}
                    onCancel={() => setEditingId(null)}
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
        <div className="grid grid-cols-[1fr_1fr_1.1fr_1.4fr_1fr_0.9fr_1.1fr] border-b border-stone-800 bg-stone-900 px-6 py-3 text-xs uppercase tracking-[0.18em] text-stone-400">
          <div>Nombre</div>
          <SortHeader
            label="Apellido"
            href={sortLinks.lastName}
            active={sort === "last_name"}
            direction={direction}
          />
          <div>Teléfono</div>
          <div>Dirección</div>
          <div>Origen</div>
          <SortHeader
            label="Alta"
            href={sortLinks.createdAt}
            active={sort === "created_at"}
            direction={direction}
          />
          <div>Acción</div>
        </div>
        {rows.length ? (
          rows.map((customer) => {
            const isEditing = editingId === customer.id;
            const fallbackName = !customer.first_name && !customer.last_name ? customer.instagram || "Cliente sin nombre" : "-";

            return (
              <div key={customer.id} className="border-b border-stone-800 last:border-b-0">
                <div className="grid grid-cols-[1fr_1fr_1.1fr_1.4fr_1fr_0.9fr_1.1fr] px-6 py-4 text-sm text-stone-300 hover:bg-stone-900/50">
                  <div className="font-medium text-stone-100">
                    <div>{customer.first_name || fallbackName}</div>
                    {customer.instagram ? (
                      <div className="mt-1 text-xs text-stone-500">{customer.instagram}</div>
                    ) : null}
                  </div>
                  <div className="font-medium text-stone-100">{customer.last_name || "-"}</div>
                  <div>
                    <div>{formatWhatsAppPhone(customer.phone)}</div>
                  </div>
                  <div>
                    <div>{formatStructuredAddressSummary({
                      addressKind: customer.address_kind,
                      addressLine1: customer.address_line_1 ?? "",
                      gatedCommunityName: customer.gated_community_name ?? "",
                      locality: customer.locality ?? ""
                    })}</div>
                    <div className="mt-1 text-xs text-stone-500">{customer.delivery_area || "-"}</div>
                  </div>
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(isEditing ? null : customer.id)}
                        className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200 transition hover:border-sky-300/50 hover:bg-sky-500/20"
                      >
                        {isEditing ? "Cerrar" : "Editar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(customer)}
                        disabled={deletingId === customer.id}
                        className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-200 transition hover:border-rose-300/50 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === customer.id ? "Borrando..." : "Borrar"}
                      </button>
                    </div>
                  </div>
                </div>
                {isEditing ? (
                  <div className="px-6 pb-5">
                    <CustomerEditForm
                      customer={customer}
                      onCancel={() => setEditingId(null)}
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
