"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type CustomerMatch = {
  id: string;
  full_name: string;
  phone: string;
  address: string | null;
  neighborhood: string | null;
  zone: string | null;
  delivery_notes: string | null;
};

type FormState = {
  success: boolean;
  message: string;
};

const initialState: FormState = {
  success: false,
  message: ""
};

export function ManualOrderForm() {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [lookupValue, setLookupValue] = useState("");
  const [results, setResults] = useState<CustomerMatch[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerMatch | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [zone, setZone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  useEffect(() => {
    const query = lookupValue.trim();

    if (query.length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      const response = await fetch(`/api/panel/customers/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { customers: CustomerMatch[] };
      setResults(payload.customers);
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [lookupValue]);

  function applyCustomer(customer: CustomerMatch) {
    setSelectedCustomer(customer);
    setLookupValue(customer.full_name);
    setResults([]);
    setFullName(customer.full_name);
    setPhone(customer.phone);
    setAddress(customer.address ?? "");
    setNeighborhood(customer.neighborhood ?? "");
    setZone(customer.zone ?? customer.neighborhood ?? "");
    setDeliveryNotes(customer.delivery_notes ?? "");
  }

  function clearSelectedCustomer() {
    setSelectedCustomer(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState(initialState);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      customerId: formData.get("customerId"),
      fullName: formData.get("fullName"),
      phone: formData.get("phone"),
      address: formData.get("address"),
      neighborhood: formData.get("neighborhood"),
      zone: formData.get("zone"),
      deliveryNotes: formData.get("deliveryNotes"),
      quantityBoxes: Number(formData.get("quantityBoxes")),
      paymentMethodExpected: formData.get("paymentMethodExpected"),
      deliveryDate: formData.get("deliveryDate"),
      notes: formData.get("notes")
    };

    const response = await fetch("/api/panel/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = (await response.json()) as FormState & { orderId?: string };
    setState(result);
    setPending(false);

    if (response.ok) {
      form.reset();
      setSelectedCustomer(null);
      setLookupValue("");
      setResults([]);
      setFullName("");
      setPhone("");
      setAddress("");
      setNeighborhood("");
      setZone("");
      setDeliveryNotes("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4 sm:p-6">
      <input type="hidden" name="customerId" value={selectedCustomer?.id ?? ""} />

      <div className="grid gap-6">
        <div className="grid gap-2">
          <label className="text-sm text-stone-300">Buscar cliente existente</label>
          <input
            value={lookupValue}
            onChange={(event) => {
              setLookupValue(event.target.value);
              if (selectedCustomer && event.target.value !== selectedCustomer.full_name) {
                clearSelectedCustomer();
              }
            }}
            placeholder="Nombre o telefono"
            className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-sky-400"
          />
          {results.length ? (
            <div className="rounded-2xl border border-stone-800 bg-stone-950/90 p-2">
              {results.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => applyCustomer(customer)}
                  className="flex w-full items-start justify-between rounded-xl px-3 py-3 text-left transition hover:bg-stone-900"
                >
                  <div>
                    <p className="text-sm font-medium text-stone-100">{customer.full_name}</p>
                    <p className="mt-1 text-xs text-stone-400">{customer.phone}</p>
                  </div>
                  <p className="text-xs text-stone-500">
                    {[customer.neighborhood, customer.zone].filter(Boolean).join(" · ") || "-"}
                  </p>
                </button>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-stone-500">
            Si el cliente existe, lo seleccionas y el formulario se completa solo. Si no, se crea
            en CRM al guardar el pedido.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-stone-300">
            Nombre completo
            <input
              name="fullName"
              required
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                if (selectedCustomer && event.target.value !== selectedCustomer.full_name) {
                  clearSelectedCustomer();
                }
              }}
              className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-300">
            WhatsApp
            <input
              name="phone"
              type="tel"
              required
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                if (selectedCustomer && event.target.value !== selectedCustomer.phone) {
                  clearSelectedCustomer();
                }
              }}
              placeholder="+54 11 2345-6789"
              className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
            Direccion
            <input
              name="address"
              required
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-300">
            Barrio
            <input
              name="neighborhood"
              required
              value={neighborhood}
              onChange={(event) => setNeighborhood(event.target.value)}
              className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-300">
            Zona
            <input
              name="zone"
              required
              value={zone}
              onChange={(event) => setZone(event.target.value)}
              className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-300">
            Cantidad de cajas
            <input
              name="quantityBoxes"
              type="number"
              min="1"
              max="50"
              defaultValue="1"
              required
              className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-300">
            Forma de pago
            <select
              name="paymentMethodExpected"
              defaultValue="cash"
              className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
            >
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
            Fecha tentativa de entrega
            <input
              name="deliveryDate"
              type="date"
              className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
            Notas de entrega del cliente
            <textarea
              name="deliveryNotes"
              rows={3}
              value={deliveryNotes}
              onChange={(event) => setDeliveryNotes(event.target.value)}
              className="rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 text-base text-stone-100 outline-none focus:border-emerald-400"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
            Notas internas del pedido
            <textarea
              name="notes"
              rows={4}
              className="rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 text-base text-stone-100 outline-none focus:border-emerald-400"
            />
          </label>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 text-base font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Crear pedido manual"}
        </button>
        <Link
          href="/panel/orders"
          className="inline-flex h-12 items-center justify-center rounded-xl border border-stone-700 bg-stone-950 px-5 text-base text-stone-300 transition hover:border-stone-600 hover:text-stone-100"
        >
          Volver a pedidos
        </Link>
      </div>

      {state.message ? (
        <p className={`mt-4 text-sm ${state.success ? "text-emerald-300" : "text-rose-300"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
