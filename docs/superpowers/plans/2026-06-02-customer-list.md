# Customer List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la página `/panel/customers` con listado de clientes, búsqueda por nombre/teléfono, y acceso desde el panel principal.

**Architecture:** Página server component que lee `?q=` de searchParams y filtra en la query de Supabase. El input de búsqueda es un client component separado que actualiza la URL. El resto es server-rendered, siguiendo el patrón del proyecto.

**Tech Stack:** Next.js 14 App Router, Supabase (admin client), Tailwind CSS, TypeScript

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/app/panel/customers/page.tsx` | Crear | Server page: fetch clientes con filtro opcional, render tabla + cards |
| `src/components/customer-search.tsx` | Crear | Client component: input de búsqueda que actualiza `?q=` en la URL |
| `src/app/panel/page.tsx` | Modificar | Agregar card de acceso rápido a `/panel/customers` |

---

## Task 1: Crear el client component de búsqueda

**Files:**
- Create: `src/components/customer-search.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

export function CustomerSearch({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set("q", e.target.value);
    } else {
      params.delete("q");
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="relative">
      <input
        type="search"
        defaultValue={defaultValue}
        onChange={handleChange}
        placeholder="Buscar por nombre o teléfono..."
        className="w-full rounded-2xl border border-stone-700 bg-stone-900/80 px-4 py-3 text-sm text-stone-100 placeholder-stone-500 outline-none transition focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 sm:max-w-sm"
      />
      {isPending ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">
          Buscando...
        </span>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que no hay errores de TypeScript**

```bash
cd /Users/jdebuchy/Projects/lacandelaria-app && npx tsc --noEmit
```

Expected: sin errores en el archivo nuevo.

- [ ] **Step 3: Commit**

```bash
git add src/components/customer-search.tsx
git commit -m "feat: add customer search input component"
```

---

## Task 2: Crear la página de listado de clientes

**Files:**
- Create: `src/app/panel/customers/page.tsx`

- [ ] **Step 1: Crear el directorio y la página**

```tsx
import { SiteNav } from "@/components/site-nav";
import { CustomerSearch } from "@/components/customer-search";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatWhatsAppPhone } from "@/lib/contact";

const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  referred: "Referido",
  repeat: "Recurrente",
  reseller: "Revendedora"
};

type SearchParams = Promise<{ q?: string }>;

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("customers")
    .select("id, full_name, phone, neighborhood, zone, source, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data: customers } = await query;
  const rows = customers ?? [];

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-16">
        <div className="space-y-4">
          <SiteNav />
          <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-200">
            Clientes
          </span>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
                Listado de clientes
              </h1>
              <p className="mt-2 text-stone-400">
                {rows.length} {q ? "resultado(s) para la búsqueda" : "clientes registrados"}
              </p>
            </div>
            <CustomerSearch defaultValue={q ?? ""} />
          </div>
        </div>

        {/* Mobile: cards */}
        <div className="space-y-3 md:hidden">
          {rows.length ? (
            rows.map((customer) => (
              <article
                key={customer.id}
                className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-stone-50">{customer.full_name}</p>
                    <p className="mt-1 text-sm text-stone-400">
                      {formatWhatsAppPhone(customer.phone)}
                    </p>
                  </div>
                  <span className="rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-300">
                    {SOURCE_LABELS[customer.source] ?? customer.source}
                  </span>
                </div>
                {(customer.neighborhood || customer.zone) ? (
                  <p className="mt-3 text-sm text-stone-400">
                    {[customer.neighborhood, customer.zone].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/70 px-4 py-8 text-center text-sm text-stone-500">
              {q ? `No se encontraron clientes para "${q}".` : "Todavía no hay clientes registrados."}
            </div>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden overflow-hidden rounded-3xl border border-stone-800 bg-stone-900/70 md:block">
          <div className="grid grid-cols-5 border-b border-stone-800 bg-stone-900 px-6 py-3 text-xs uppercase tracking-[0.18em] text-stone-400">
            {["Cliente", "Teléfono", "Zona", "Origen", "Alta"].map((col) => (
              <div key={col}>{col}</div>
            ))}
          </div>
          {rows.length ? (
            rows.map((customer) => (
              <div
                key={customer.id}
                className="grid grid-cols-5 border-b border-stone-800 px-6 py-4 text-sm text-stone-300 last:border-b-0 hover:bg-stone-900/50"
              >
                <div className="font-medium text-stone-100">{customer.full_name}</div>
                <div>{formatWhatsAppPhone(customer.phone)}</div>
                <div>{[customer.neighborhood, customer.zone].filter(Boolean).join(" · ") || "-"}</div>
                <div>{SOURCE_LABELS[customer.source] ?? customer.source}</div>
                <div>
                  {new Date(customer.created_at).toLocaleDateString("es-AR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center text-sm text-stone-500">
              {q ? `No se encontraron clientes para "${q}".` : "Todavía no hay clientes registrados."}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd /Users/jdebuchy/Projects/lacandelaria-app && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/panel/customers/page.tsx
git commit -m "feat: add /panel/customers list page with search"
```

---

## Task 3: Agregar acceso desde el panel principal

**Files:**
- Modify: `src/app/panel/page.tsx`

- [ ] **Step 1: Agregar sección de módulos del panel**

Después del bloque de métricas (los 4 `<article>` del grid `grid-cols-2 md:grid-cols-4`), agregar una sección de accesos rápidos a los módulos. Insertar antes de la sección `<section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">`:

```tsx
<section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  {[
    { href: "/panel/customers", label: "Clientes", detail: "Listado y búsqueda de clientes registrados.", color: "sky" },
  ].map((module) => (
    <a
      key={module.href}
      href={module.href}
      className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5 transition hover:border-sky-400/40 hover:bg-stone-900"
    >
      <p className="text-base font-semibold text-stone-50">{module.label}</p>
      <p className="mt-2 text-sm text-stone-400">{module.detail}</p>
      <p className="mt-3 text-xs text-sky-400">{module.href} →</p>
    </a>
  ))}
</section>
```

- [ ] **Step 2: Verificar tipos**

```bash
cd /Users/jdebuchy/Projects/lacandelaria-app && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/panel/page.tsx
git commit -m "feat: add module quick-access section to panel dashboard"
```

---

## Self-Review

**Spec coverage:**
- ✅ Listado de clientes en `/panel/customers`
- ✅ Búsqueda por nombre y teléfono vía `?q=`
- ✅ Vista mobile (cards) y desktop (tabla)
- ✅ Acceso desde `/panel`
- ✅ Sigue patrones del proyecto (createAdminClient, SiteNav, Tailwind stone/emerald)

**Placeholder scan:** ninguno encontrado.

**Type consistency:** `customers` row type inferido de Supabase directamente, sin tipos intermedios que puedan desincronizarse.
