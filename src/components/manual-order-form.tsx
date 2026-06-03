"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AddressInput } from "@/components/address-input";
import { AutofillDecoy } from "@/components/autofill-decoy";
import { OrderItemsEditor } from "@/components/order-items-editor";
import { PhoneInput } from "@/components/phone-input";
import {
  EMPTY_STRUCTURED_ADDRESS,
  StructuredAddress,
  formatStructuredAddressSummary
} from "@/lib/address";
import { formatPersonName, formatWhatsAppPhone } from "@/lib/contact";
import type { OrderItemInput, Product } from "@/lib/types";

type CustomerMatch = {
  id: string;
  first_name: string;
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
};

type FormState = {
  success: boolean;
  message: string;
};

type ManualOrderFormProps = {
  products: Product[];
};

const initialState: FormState = {
  success: false,
  message: ""
};

export function ManualOrderForm({ products }: ManualOrderFormProps) {
  const activeProducts = products.filter((product) => product.active);
  const initialItems: OrderItemInput[] = activeProducts[0]
    ? [{ productId: activeProducts[0].id, quantity: 1 }]
    : [];

  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [lookupValue, setLookupValue] = useState("");
  const [results, setResults] = useState<CustomerMatch[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerMatch | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [address, setAddress] = useState<StructuredAddress>(EMPTY_STRUCTURED_ADDRESS);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [items, setItems] = useState<OrderItemInput[]>(initialItems);
  const [paymentMethodExpected, setPaymentMethodExpected] = useState<"cash" | "transfer">("cash");

  function customerDisplayName(customer: CustomerMatch) {
    return formatPersonName(customer.first_name, customer.last_name);
  }

  function normalizeInstagramValue(value: string) {
    return value.trim().replace(/^@+/, "");
  }

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
    const displayName = customerDisplayName(customer);
    setSelectedCustomer(customer);
    setLookupValue(displayName);
    setResults([]);
    setFullName(displayName);
    setPhone(customer.phone ?? "");
    setInstagram(customer.instagram ?? "");
    setAddress({
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
    const payload = {
      customerId: selectedCustomer?.id ?? "",
      fullName,
      phone,
      instagram,
      ...address,
      deliveryNotes,
      items,
      paymentMethodExpected,
      deliveryDate: new FormData(form).get("deliveryDate"),
      notes: new FormData(form).get("notes")
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
      setInstagram("");
      setAddress(EMPTY_STRUCTURED_ADDRESS);
      setDeliveryNotes("");
      setItems(initialItems);
      setPaymentMethodExpected("cash");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      autoComplete="off"
      className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4 sm:p-6"
    >
      <AutofillDecoy />
      <input type="hidden" name="customerId" value={selectedCustomer?.id ?? ""} />

      {!activeProducts.length ? (
        <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-200">
          No hay productos activos en el catálogo. Cargalos desde el panel antes de crear pedidos.
        </div>
      ) : null}

      <div className="grid gap-6">
        <div className="grid gap-2">
          <label className="text-sm text-stone-300">Buscar cliente existente</label>
          <input
            value={lookupValue}
            onChange={(event) => {
              setLookupValue(event.target.value);
              if (selectedCustomer && event.target.value !== customerDisplayName(selectedCustomer)) {
                clearSelectedCustomer();
              }
            }}
            placeholder="Nombre, telefono o Instagram"
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
                    <p className="text-sm font-medium text-stone-100">{customerDisplayName(customer)}</p>
                    <p className="mt-1 text-xs text-stone-400">{formatWhatsAppPhone(customer.phone)}</p>
                    {customer.instagram ? (
                      <p className="mt-1 text-xs text-stone-500">{customer.instagram}</p>
                    ) : null}
                  </div>
                  <p className="text-xs text-stone-500">
                    {formatStructuredAddressSummary({
                      addressKind: customer.address_kind,
                      addressLine1: customer.address_line_1 ?? "",
                      gatedCommunityName: customer.gated_community_name ?? "",
                      locality: customer.locality ?? ""
                    })}
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
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                if (selectedCustomer && event.target.value !== customerDisplayName(selectedCustomer)) {
                  clearSelectedCustomer();
                }
              }}
              className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
            />
          </label>

          <PhoneInput
            name="phone"
            required
            value={phone}
            onChange={(nextPhone) => {
              setPhone(nextPhone);
              if (selectedCustomer && nextPhone !== (selectedCustomer.phone ?? "")) {
                clearSelectedCustomer();
              }
            }}
          />

          <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
            Instagram
            <input
              name="instagram"
              value={instagram}
              onChange={(event) => {
                setInstagram(event.target.value);
                if (
                  selectedCustomer &&
                  normalizeInstagramValue(event.target.value) !== (selectedCustomer.instagram ?? "")
                ) {
                  clearSelectedCustomer();
                }
              }}
              placeholder="usuario"
              className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
            />
          </label>

          <AddressInput required value={address} onChange={setAddress} className="md:col-span-2" />

          <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
            Forma de pago
            <select
              name="paymentMethodExpected"
              value={paymentMethodExpected}
              onChange={(event) => setPaymentMethodExpected(event.target.value as "cash" | "transfer")}
              className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
            >
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
            </select>
          </label>

          {activeProducts.length ? (
            <OrderItemsEditor
              items={items}
              onChange={setItems}
              paymentMethod={paymentMethodExpected}
              products={activeProducts}
            />
          ) : null}

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
          disabled={pending || !activeProducts.length}
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
