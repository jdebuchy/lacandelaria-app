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
        placeholder="Buscar por número de pedido, nombre o teléfono..."
        className="w-full rounded-card border border-line bg-paper px-4 py-3 pr-24 text-body text-ink placeholder:text-ink-faint outline-hidden transition focus:border-accent focus:ring-1 focus:ring-accent"
      />
      {isPending ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-meta text-ink-faint">
          Buscando...
        </span>
      ) : null}
    </div>
  );
}
