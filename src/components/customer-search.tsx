"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef, useTransition } from "react";

const AREA_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "gated", label: "Barrios Privados" },
  { value: "capital", label: "Capital" },
  { value: "province", label: "Provincia" },
  { value: "pending_review", label: "Pending review" }
] as const;

const PAGE_SIZE_OPTIONS = [
  { value: "50", label: "50" },
  { value: "100", label: "100" },
  { value: "200", label: "200" }
] as const;

export function CustomerSearch({
  defaultValue = "",
  defaultArea = "all",
  defaultLimit = "100"
}: {
  defaultValue?: string;
  defaultArea?: string;
  defaultLimit?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateParams(nextQuery: string, nextArea: string, nextLimit: string) {
    const params = new URLSearchParams(searchParams.toString());
    const sort = searchParams.get("sort");
    const dir = searchParams.get("dir");

    if (nextQuery) {
      params.set("q", nextQuery);
    } else {
      params.delete("q");
    }

    if (nextArea && nextArea !== "all") {
      params.set("area", nextArea);
    } else {
      params.delete("area");
    }

    if (nextLimit && nextLimit !== "100") {
      params.set("limit", nextLimit);
    } else {
      params.delete("limit");
    }

    if (sort) {
      params.set("sort", sort);
    }

    if (dir) {
      params.set("dir", dir);
    }

    params.delete("page");

    const queryString = params.toString();

    startTransition(() => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams(
        value,
        searchParams.get("area") ?? defaultArea,
        searchParams.get("limit") ?? defaultLimit
      );
    }, 250);
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <div className="relative">
        <input
          type="search"
          defaultValue={defaultValue}
          onChange={handleChange}
          aria-label="Buscar clientes"
          placeholder="Buscar por nombre, teléfono o Instagram..."
          className="w-full rounded-2xl border border-stone-700 bg-stone-900/80 px-4 py-3 pr-24 text-sm text-stone-100 placeholder-stone-500 outline-none transition focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 sm:w-80"
        />
        {isPending ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">
            Buscando...
          </span>
        ) : null}
      </div>

      <select
        defaultValue={defaultArea}
        onChange={(event) => updateParams(
          searchParams.get("q") ?? defaultValue,
          event.target.value,
          searchParams.get("limit") ?? defaultLimit
        )}
        aria-label="Filtrar clientes por zona"
        className="rounded-2xl border border-stone-700 bg-stone-900/80 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20"
      >
        {AREA_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        defaultValue={defaultLimit}
        onChange={(event) => updateParams(
          searchParams.get("q") ?? defaultValue,
          searchParams.get("area") ?? defaultArea,
          event.target.value
        )}
        aria-label="Cantidad de clientes a mostrar"
        className="rounded-2xl border border-stone-700 bg-stone-900/80 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20"
      >
        {PAGE_SIZE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} registros
          </option>
        ))}
      </select>
    </div>
  );
}
