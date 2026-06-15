"use client";

import { FormEvent, useState } from "react";
import { AddressInput } from "@/components/address-input";
import { AutofillDecoy } from "@/components/autofill-decoy";
import { PhoneInput } from "@/components/phone-input";
import { EMPTY_STRUCTURED_ADDRESS, StructuredAddress } from "@/lib/address";

const SOURCE_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "referred", label: "Referido" },
  { value: "repeat", label: "Recurrente" },
  { value: "reseller", label: "Revendedora" }
] as const;

type FormState = { success: boolean; message: string } | null;

const EMPTY = {
  firstName: "",
  lastName: "",
  phone: "",
  instagram: "",
  address: EMPTY_STRUCTURED_ADDRESS,
  deliveryNotes: "",
  source: "instagram" as string
};

export function AddCustomerButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<FormState>(null);
  const [fields, setFields] = useState(EMPTY);

  function set(
    key: "firstName" | "lastName" | "phone" | "instagram" | "deliveryNotes" | "source",
    value: string
  ) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function setAddress(address: StructuredAddress) {
    setFields((prev) => ({ ...prev, address }));
  }

  function handleOpen() {
    setOpen(true);
    setState(null);
    setFields(EMPTY);
  }

  function handleClose() {
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState(null);

    const response = await fetch("/api/panel/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: fields.firstName,
        lastName: fields.lastName,
        phone: fields.phone,
        instagram: fields.instagram,
        ...fields.address,
        deliveryNotes: fields.deliveryNotes,
        source: fields.source
      })
    });

    const result = (await response.json()) as { success: boolean; message: string };
    setState(result);
    setPending(false);

    if (result.success) {
      window.location.reload();
    }
  }

  const inputClass =
    "h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400";

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-stone-950 transition hover:bg-emerald-400"
      >
        + Nuevo cliente
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-3xl rounded-3xl border border-stone-800 bg-stone-950 p-7 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-50">Nuevo cliente</h2>
              <button
                type="button"
                onClick={handleClose}
                className="text-stone-500 transition hover:text-stone-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} autoComplete="off" className="mt-6 grid gap-4 md:grid-cols-2">
              <AutofillDecoy />
              <label className="grid gap-2 text-sm text-stone-300">
                Nombre
                <input
                  value={fields.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  className={inputClass}
                  placeholder="Ej: María"
                />
              </label>

              <label className="grid gap-2 text-sm text-stone-300">
                Apellido
                <input
                  value={fields.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  className={inputClass}
                  placeholder="Ej: González"
                />
              </label>

              <PhoneInput
                value={fields.phone}
                onChange={(v) => set("phone", v)}
              />

              <label className="grid gap-2 text-sm text-stone-300">
                Instagram
                <input
                  value={fields.instagram}
                  onChange={(e) => set("instagram", e.target.value)}
                  className={inputClass}
                  placeholder="usuario"
                />
                <span aria-hidden="true" className="text-xs text-transparent">
                  .
                </span>
              </label>

              <AddressInput
                value={fields.address}
                onChange={setAddress}
                className="md:col-span-2"
                afterPostalCode={
                  <>
                    Origen
                    <select
                      value={fields.source}
                      onChange={(e) => set("source", e.target.value)}
                      className={inputClass}
                    >
                      {SOURCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </>
                }
              />

              <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
                Notas de entrega
                <textarea
                  value={fields.deliveryNotes}
                  onChange={(e) => set("deliveryNotes", e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none focus:border-emerald-400"
                  placeholder="Ej: Dejar en portería, timbre 2B"
                />
              </label>

              <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-h-5 text-sm">
                  {state ? (
                    <p className={state.success ? "text-emerald-300" : "text-rose-300"}>
                      {state.message}
                    </p>
                  ) : null}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-full border border-stone-700 px-4 py-2 text-sm text-stone-300 transition hover:border-stone-500 hover:text-stone-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pending ? "Guardando..." : "Crear cliente"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
