"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";

export function OrderSearch({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateQuery(nextQuery: string) {
    const params = new URLSearchParams(searchParams.toString());
    const query = nextQuery.trim();

    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }

    const queryString = params.toString();

    startTransition(() => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    });
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateQuery(value), 250);
  }

  return (
    <div className="relative w-full sm:w-96">
      <input
        type="search"
        defaultValue={defaultValue}
        onChange={handleChange}
        aria-label="Buscar pedidos"
        placeholder="Buscar por nombre, apellido o teléfono..."
        className="w-full rounded-2xl border border-stone-700 bg-stone-900/80 px-4 py-3 pr-24 text-sm text-stone-100 placeholder-stone-500 outline-none transition focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20"
      />
      {isPending ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">
          Buscando...
        </span>
      ) : null}
    </div>
  );
}
