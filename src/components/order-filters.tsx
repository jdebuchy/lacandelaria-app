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
          className={`h-8 rounded-control border px-3 text-body transition-colors ${
            activeStatus === opt.value
              ? "border-accent bg-accent-soft font-medium text-accent"
              : "border-line-strong bg-paper text-ink-soft hover:bg-paper-raised hover:text-ink"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
