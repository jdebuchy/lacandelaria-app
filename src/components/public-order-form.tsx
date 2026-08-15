"use client";

import { FormEvent, useEffect, useState } from "react";
import { AddressInput } from "@/components/address-input";
import { AutofillDecoy } from "@/components/autofill-decoy";
import { OrderItemsEditor } from "@/components/order-items-editor";
import { PhoneInput } from "@/components/phone-input";
import { EMPTY_STRUCTURED_ADDRESS } from "@/lib/address";
import { getDefaultSellableVariantId } from "@/lib/products";
import type { ExpectedPaymentMethod, OrderItemInput, ProductFamily } from "@/lib/types";

type PublicOrderFormState = {
  success: boolean;
  message: string;
};

type PublicOrderFormProps = {
  products: ProductFamily[];
};

const initialState: PublicOrderFormState = {
  success: false,
  message: ""
};

export function PublicOrderForm({ products }: PublicOrderFormProps) {
  const activeProducts = products.filter(
    (product) => product.active && product.variants.some((variant) => variant.active && variant.visibility === "sellable")
  );
  const initialVariantId = activeProducts[0] ? getDefaultSellableVariantId(activeProducts[0]) : null;
  const initialItems: OrderItemInput[] = initialVariantId
    ? [{ productId: initialVariantId, quantity: 1 }]
    : [];

  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [startedAt, setStartedAt] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [address, setAddress] = useState(EMPTY_STRUCTURED_ADDRESS);
  const [items, setItems] = useState<OrderItemInput[]>(initialItems);
  const [paymentMethodExpected, setPaymentMethodExpected] = useState<ExpectedPaymentMethod>("unknown");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setStartedAt(String(Date.now()));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState(initialState);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      firstName,
      lastName,
      phone,
      instagram,
      ...address,
      items,
      paymentMethodExpected,
      notes,
      leadSource: formData.get("leadSource"),
      website: formData.get("website"),
      startedAt: Number(formData.get("startedAt"))
    };

    const response = await fetch("/api/public-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = (await response.json()) as PublicOrderFormState;
    setState(result);
    setPending(false);

    if (response.ok) {
      form.reset();
      setStartedAt(String(Date.now()));
      setFirstName("");
      setLastName("");
      setPhone("");
      setInstagram("");
      setAddress(EMPTY_STRUCTURED_ADDRESS);
      setItems(initialItems);
      setPaymentMethodExpected("unknown");
      setNotes("");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      autoComplete="off"
      className="rounded-card border border-line bg-paper p-4 sm:p-6"
    >
      <AutofillDecoy />
      <input type="hidden" name="leadSource" value="direct_link" />
      <input type="hidden" name="startedAt" value={startedAt} />
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {!activeProducts.length ? (
        <div className="rounded-card border border-warn-line bg-warn-bg p-4 text-sm text-warn-fg">
          No hay productos activos en el catálogo. Cargalos desde el panel antes de recibir pedidos.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-ink-soft">
          Nombre
          <input
            name="firstName"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="Jose"
            className="h-12 rounded-control border border-line bg-paper-muted px-4 text-base text-ink outline-hidden focus:border-accent"
          />
        </label>

        <label className="grid gap-2 text-sm text-ink-soft">
          Apellido
          <input
            name="lastName"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Debuchy"
            className="h-12 rounded-control border border-line bg-paper-muted px-4 text-base text-ink outline-hidden focus:border-accent"
          />
        </label>

        <PhoneInput name="phone" required value={phone} onChange={setPhone} />

        <label className="grid gap-2 text-sm text-ink-soft">
          Instagram
          <input
            name="instagram"
            value={instagram}
            onChange={(event) => setInstagram(event.target.value)}
            placeholder="usuario"
            className="h-12 rounded-control border border-line bg-paper-muted px-4 text-base text-ink outline-hidden focus:border-accent"
          />
          <span aria-hidden="true" className="text-xs text-transparent">
            .
          </span>
        </label>

        <AddressInput required value={address} onChange={setAddress} className="md:col-span-2" />

        <label className="grid gap-2 text-sm text-ink-soft md:col-span-2">
          Forma de pago
          <select
            name="paymentMethodExpected"
            value={paymentMethodExpected}
            onChange={(event) => setPaymentMethodExpected(event.target.value as ExpectedPaymentMethod)}
            className="h-12 rounded-control border border-line bg-paper-muted px-4 text-base text-ink outline-hidden focus:border-accent"
          >
            <option value="unknown">No definido</option>
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

        <label className="grid gap-2 text-sm text-ink-soft md:col-span-2">
          Notas de entrega
          <textarea
            name="notes"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="rounded-control border border-line bg-paper-muted px-4 py-3 text-base text-ink outline-hidden focus:border-accent"
          />
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="submit"
          disabled={pending || !activeProducts.length}
          className="inline-flex h-12 items-center justify-center rounded-control bg-accent px-5 text-base font-medium text-accent-fg transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Enviando..." : "Enviar pedido"}
        </button>

        {state.message ? (
          <p className={state.success ? "text-sm text-accent" : "text-sm text-danger-fg"}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
