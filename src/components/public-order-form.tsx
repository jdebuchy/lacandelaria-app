"use client";

import { FormEvent, useEffect, useState } from "react";

type PublicOrderFormState = {
  success: boolean;
  message: string;
};

const initialState: PublicOrderFormState = {
  success: false,
  message: ""
};

export function PublicOrderForm() {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [startedAt, setStartedAt] = useState("");

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
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      phone: formData.get("phone"),
      address: formData.get("address"),
      neighborhood: formData.get("neighborhood"),
      quantityBoxes: Number(formData.get("quantityBoxes")),
      paymentMethodExpected: formData.get("paymentMethodExpected"),
      notes: formData.get("notes"),
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
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4 sm:p-6">
      <input type="hidden" name="leadSource" value="direct_link" />
      <input type="hidden" name="startedAt" value={startedAt} />
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-stone-300">
          Nombre
          <input
            name="firstName"
            required
            placeholder="Jose"
            className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <label className="grid gap-2 text-sm text-stone-300">
          Apellido
          <input
            name="lastName"
            required
            placeholder="Debuchy"
            className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
          WhatsApp
          <input
            name="phone"
            type="tel"
            required
            placeholder="+54 11 2345-6789"
            className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
          Direccion
          <input
            name="address"
            required
            className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <label className="grid gap-2 text-sm text-stone-300">
          Barrio o zona
          <input
            name="neighborhood"
            required
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

        <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
          Forma de pago
          <select
            name="paymentMethodExpected"
            defaultValue="cash"
            className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
          >
            <option value="cash">Efectivo - $25.000</option>
            <option value="transfer">Transferencia - $30.000</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
          Notas de entrega
          <textarea
            name="notes"
            rows={4}
            className="rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 text-base text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 text-base font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Enviando..." : "Enviar pedido"}
        </button>

        {state.message ? (
          <p className={state.success ? "text-sm text-emerald-300" : "text-sm text-rose-300"}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
