"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type FilterOption = {
  value: string;
  label: string;
};

const FILTER_OPTIONS: FilterOption[] = [
  { value: "", label: "Todos" },
  { value: "pending_confirmation", label: "Pendientes" },
  { value: "confirmed", label: "Confirmados" },
  { value: "assigned", label: "Asignados" },
  { value: "in_route", label: "En ruta" },
  { value: "delivered", label: "Entregados" },
  { value: "cancelled", label: "Cancelados" },
];

export function OrderFilters({ activeStatus }: { activeStatus: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("status", value);
    } else {
      params.delete("status");
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className={`flex flex-wrap gap-2 ${isPending ? "opacity-60" : ""}`}>
      {FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handleSelect(opt.value)}
          className={`rounded-control border px-3 py-1 text-meta font-medium transition ${
            activeStatus === opt.value
              ? "border-line-strong bg-paper-raised text-ink"
              : "border-line bg-transparent text-ink-soft hover:border-line-strong hover:text-ink-soft"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
