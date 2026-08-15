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
    <div className="relative w-full sm:w-80">
      <input
        type="search"
        defaultValue={defaultValue}
        onChange={handleChange}
        aria-label="Buscar pedidos"
        placeholder="Buscar por número, nombre o teléfono"
        className="h-8 w-full rounded-control border border-line-strong bg-paper px-3 pr-20 text-body text-ink outline-hidden transition-colors placeholder:text-ink-faint focus:border-accent"
      />
      {isPending ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-meta text-ink-faint">
          Buscando...
        </span>
      ) : null}
    </div>
  );
}
