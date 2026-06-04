"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { composeFullName, formatPersonName, formatWhatsAppPhone } from "@/lib/contact";
import { getDefaultSellableVariantId } from "@/lib/products";
import type { OrderItemInput, ProductFamily } from "@/lib/types";

export type CustomerMatch = {
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

type ManualOrderFormInitialData = {
  customer: CustomerMatch | null;
  firstName: string;
  lastName: string;
  phone: string;
  instagram: string;
  address: StructuredAddress;
  deliveryNotes: string;
  items: OrderItemInput[];
  paymentMethodExpected: "cash" | "transfer";
  deliveryDate: string;
  notes: string;
};

type ManualOrderFormProps = {
  products: ProductFamily[];
  mode?: "create" | "edit";
  orderId?: string;
  initialData?: Partial<ManualOrderFormInitialData>;
};

const initialState: FormState = {
  success: false,
  message: ""
};

function formatCustomerLookupAddress(customer: CustomerMatch) {
  return formatStructuredAddressSummary({
    addressKind: customer.address_kind,
    addressLine1: customer.address_line_1 ?? "",
    gatedCommunityName: customer.gated_community_name ?? "",
    locality: customer.locality ?? ""
  });
}

export function ManualOrderForm({
  products,
  mode = "create",
  orderId,
  initialData
}: ManualOrderFormProps) {
  const router = useRouter();
  const activeProducts = products.filter(
    (product) => product.active && product.variants.some((variant) => variant.active && variant.visibility === "sellable")
  );
  const fallbackVariantId = activeProducts[0] ? getDefaultSellableVariantId(activeProducts[0]) : null;
  const fallbackItems: OrderItemInput[] = fallbackVariantId
    ? [{ productId: fallbackVariantId, quantity: 1 }]
    : [];
  const initialItems = initialData?.items?.length ? initialData.items : fallbackItems;
  const initialCustomer = initialData?.customer ?? null;
  const initialFirstName = initialData?.firstName ?? initialCustomer?.first_name ?? "";
  const initialLastName = initialData?.lastName ?? initialCustomer?.last_name ?? "";
  const initialPhone = initialData?.phone ?? initialCustomer?.phone ?? "";
  const initialInstagram = initialData?.instagram ?? initialCustomer?.instagram ?? "";
  const initialAddress = initialData?.address ?? (
    initialCustomer
      ? {
          addressKind: initialCustomer.address_kind ?? "standard",
          addressLine1: initialCustomer.address_line_1 ?? "",
          addressLine2: initialCustomer.address_line_2 ?? "",
          gatedCommunityName: initialCustomer.gated_community_name ?? "",
          locality: initialCustomer.locality ?? "",
          administrativeAreaLevel1: initialCustomer.administrative_area_level_1 ?? "",
          postalCode: initialCustomer.postal_code ?? "",
          googlePlaceId: initialCustomer.google_place_id ?? "",
          googlePlaceLabel: initialCustomer.google_place_label ?? "",
          addressSource: initialCustomer.address_source ?? "manual"
        }
      : EMPTY_STRUCTURED_ADDRESS
  );
  const initialDeliveryNotes = initialData?.deliveryNotes ?? initialCustomer?.delivery_notes ?? "";
  const initialPaymentMethodExpected = initialData?.paymentMethodExpected ?? "cash";
  const initialDeliveryDate = initialData?.deliveryDate ?? "";
  const initialNotes = initialData?.notes ?? "";
  const initialLookupValue = initialCustomer
    ? formatPersonName(initialCustomer.first_name, initialCustomer.last_name)
    : composeFullName(initialFirstName, initialLastName);

  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [lookupValue, setLookupValue] = useState(initialLookupValue);
  const [results, setResults] = useState<CustomerMatch[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerMatch | null>(initialCustomer);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState(initialPhone);
  const [instagram, setInstagram] = useState(initialInstagram);
  const [address, setAddress] = useState<StructuredAddress>(initialAddress);
  const [deliveryNotes, setDeliveryNotes] = useState(initialDeliveryNotes);
  const [items, setItems] = useState<OrderItemInput[]>(initialItems);
  const [paymentMethodExpected, setPaymentMethodExpected] = useState<"cash" | "transfer">(
    initialPaymentMethodExpected
  );
  const [deliveryDate, setDeliveryDate] = useState(initialDeliveryDate);
  const [notes, setNotes] = useState(initialNotes);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

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
      try {
        const response = await fetch(`/api/panel/customers/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { customers: CustomerMatch[] };
        setResults(payload.customers);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [lookupValue]);

  useEffect(() => {
    if (!isCustomerModalOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsCustomerModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCustomerModalOpen]);

  function applyCustomer(customer: CustomerMatch) {
    const displayName = customerDisplayName(customer);
    setSelectedCustomer(customer);
    setLookupValue(displayName);
    setResults([]);
    setFirstName(customer.first_name ?? "");
    setLastName(customer.last_name ?? "");
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

  function openCustomerModal() {
    if (!firstName.trim() && !lastName.trim() && lookupValue.trim() && !selectedCustomer) {
      setFirstName(lookupValue.trim());
    }

    setIsCustomerModalOpen(true);
  }

  function startNewCustomer() {
    clearSelectedCustomer();
    setResults([]);

    if (!firstName.trim() && !lastName.trim() && lookupValue.trim()) {
      setFirstName(lookupValue.trim());
    }

    setIsCustomerModalOpen(true);
  }

  function resetForm() {
    setSelectedCustomer(null);
    setLookupValue("");
    setResults([]);
    setFirstName("");
    setLastName("");
    setPhone("");
    setInstagram("");
    setAddress(EMPTY_STRUCTURED_ADDRESS);
    setDeliveryNotes("");
    setItems(fallbackItems);
    setPaymentMethodExpected("cash");
    setDeliveryDate("");
    setNotes("");
    setIsCustomerModalOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState(initialState);

    const payload = {
      customerId: selectedCustomer?.id ?? "",
      firstName,
      lastName,
      phone,
      instagram,
      ...address,
      deliveryNotes,
      items,
      paymentMethodExpected,
      deliveryDate,
      notes
    };

    const url = mode === "edit" && orderId ? `/api/panel/orders/${orderId}` : "/api/panel/orders";
    const method = mode === "edit" ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = (await response.json()) as FormState & { orderId?: string };
    setState(result);
    setPending(false);

    if (!response.ok) {
      return;
    }

    if (mode === "edit") {
      router.push("/panel/orders");
      router.refresh();
      return;
    }

    resetForm();
  }

  const hasCustomerData =
    Boolean(firstName.trim()) ||
    Boolean(lastName.trim()) ||
    Boolean(phone.trim()) ||
    Boolean(instagram.trim()) ||
    Boolean((address.addressLine1 ?? "").trim()) ||
    Boolean((address.locality ?? "").trim());
  const fullName = composeFullName(firstName, lastName);
  const customerTitle = fullName || lookupValue.trim() || "Cliente sin nombre";
  const addressSummary = formatStructuredAddressSummary(address);
  const customerSummary = [
    formatWhatsAppPhone(phone),
    instagram.trim() ? `@${normalizeInstagramValue(instagram)}` : null,
    addressSummary !== "-" ? addressSummary : null
  ].filter(Boolean);

  return (
    <>
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
          <section className="grid gap-4 rounded-2xl border border-stone-800 bg-stone-950/50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="grid flex-1 gap-2">
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
                        className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-stone-900"
                      >
                        <div>
                          <p className="text-sm font-medium text-stone-100">{customerDisplayName(customer)}</p>
                          <p className="mt-1 text-xs text-stone-400">{formatWhatsAppPhone(customer.phone)}</p>
                          {customer.instagram ? (
                            <p className="mt-1 text-xs text-stone-500">@{customer.instagram}</p>
                          ) : null}
                        </div>
                        <p className="max-w-56 text-right text-xs text-stone-500">
                          {formatCustomerLookupAddress(customer)}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : null}

                <p className="text-xs text-stone-500">
                  Si el cliente ya existe, lo seleccionas y completamos la ficha. Si no, lo puedes crear sin salir del pedido.
                </p>
              </div>

              <div className="flex gap-2 lg:pt-7">
                <button
                  type="button"
                  onClick={startNewCustomer}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-200 transition hover:border-stone-500 hover:text-stone-50"
                >
                  Nuevo cliente
                </button>
                <button
                  type="button"
                  onClick={openCustomerModal}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-stone-100 px-4 text-sm font-medium text-stone-950 transition hover:bg-white"
                >
                  {hasCustomerData ? "Editar cliente" : "Cargar cliente"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-stone-50">{customerTitle}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        selectedCustomer
                          ? "bg-emerald-500/15 text-emerald-200"
                          : hasCustomerData
                            ? "bg-sky-500/15 text-sky-200"
                            : "bg-stone-800 text-stone-400"
                      }`}
                    >
                      {selectedCustomer ? "Cliente existente" : hasCustomerData ? "Cliente nuevo" : "Sin cargar"}
                    </span>
                  </div>

                  {customerSummary.length ? (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-300">
                      {customerSummary.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-stone-500">
                      Todavía no cargaste los datos del cliente. Puedes hacerlo sin perder el pedido.
                    </p>
                  )}

                  {deliveryNotes.trim() ? (
                    <p className="mt-3 text-xs text-stone-500">Notas de entrega: {deliveryNotes}</p>
                  ) : null}
                </div>

                {selectedCustomer ? (
                  <button
                    type="button"
                    onClick={() => {
                      clearSelectedCustomer();
                      setLookupValue("");
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-700 px-3 text-sm text-stone-300 transition hover:border-stone-500 hover:text-stone-100"
                  >
                    Desvincular
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid gap-4 rounded-2xl border border-stone-800 bg-stone-950/50 p-4 md:grid-cols-2">
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
          </section>

          <section className="grid gap-4 rounded-2xl border border-stone-800 bg-stone-950/50 p-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
              Fecha tentativa de entrega
              <input
                name="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(event) => setDeliveryDate(event.target.value)}
                className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
              />
            </label>

            <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
              Notas internas del pedido
              <textarea
                name="notes"
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 text-base text-stone-100 outline-none focus:border-emerald-400"
              />
            </label>
          </section>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={pending || !activeProducts.length}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 text-base font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear pedido manual"}
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

      {isCustomerModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-stone-950/80 p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-stone-700 bg-stone-900 p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-stone-50">Datos del cliente</p>
                <p className="mt-1 text-sm text-stone-400">
                  Carga o corrige la ficha del cliente sin perder el contexto del pedido.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-700 text-stone-300 transition hover:border-stone-500 hover:text-stone-100"
                aria-label="Cerrar modal de cliente"
              >
                ×
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm text-stone-300">
                Nombre
                <input
                  name="firstName"
                  value={firstName}
                  onChange={(event) => {
                    setFirstName(event.target.value);
                    if (selectedCustomer && event.target.value !== (selectedCustomer.first_name ?? "")) {
                      clearSelectedCustomer();
                    }
                  }}
                  className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
                  placeholder="Ej: María"
                />
              </label>

              <label className="grid gap-2 text-sm text-stone-300">
                Apellido
                <input
                  name="lastName"
                  value={lastName}
                  onChange={(event) => {
                    setLastName(event.target.value);
                    if (selectedCustomer && event.target.value !== (selectedCustomer.last_name ?? "")) {
                      clearSelectedCustomer();
                    }
                  }}
                  className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
                  placeholder="Ej: González"
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

              <label className="grid gap-2 text-sm text-stone-300">
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
                <span aria-hidden="true" className="text-xs text-transparent">
                  .
                </span>
              </label>

              <AddressInput required value={address} onChange={setAddress} className="md:col-span-2" />

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
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-stone-100 px-5 text-base font-medium text-stone-950 transition hover:bg-white"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
