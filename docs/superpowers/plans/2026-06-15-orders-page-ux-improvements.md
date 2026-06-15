# Orders Page UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the UX/UI of the `/panel/orders` page by reducing visual noise, adding color-coded status badges, making rows clickable, shortening dates, and adding a status filter.

**Architecture:** All changes are isolated to `src/app/(panel)/panel/orders/page.tsx` (server component) plus one new `OrderFilters` client component. The page already does data fetching, mapping, and rendering in one file — we keep that pattern and only improve the presentation layer.

**Tech Stack:** Next.js 14 App Router (server components), Tailwind CSS, TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/(panel)/panel/orders/page.tsx` | Modify | All rendering changes (columns, badges, dates, layout) |
| `src/components/order-filters.tsx` | Create | Client component for status filter tabs (URL param `status`) |

---

## Task 1: Quick wins — remove CANT. column, shorten dates, fix saldo display

**Files:**
- Modify: `src/app/(panel)/panel/orders/page.tsx`

Changes in this task:
- Remove the `Cant.` column header and its data cell (the `order.itemsCount` cell) from the desktop table. The quantity is already embedded in `order.itemsSummary` ("1 x Paltas Caja de 4kg").
- Change `formatDate` from `{ day: "numeric", month: "short", year: "numeric" }` to `{ day: "numeric", month: "short" }` (drop the year).
- In the TOTAL cell, only show the saldo line when `order.paymentBalanceAmount > 0`.
- Change the desktop grid from 9 columns to 8 columns by removing the `0.7fr` cant slot.

- [ ] **Step 1: Update `formatDate` to omit the year**

In `src/app/(panel)/panel/orders/page.tsx`, replace the `formatDate` function:

```ts
function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires"
  });
}
```

- [ ] **Step 2: Remove CANT. column from desktop table header**

Replace:
```tsx
<div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1.3fr_0.7fr_0.9fr_0.8fr_0.8fr] border-b border-stone-800 bg-stone-900 px-4 py-3 text-xs uppercase tracking-[0.18em] text-stone-400">
  <div>Cliente</div>
  <div>Canal</div>
  <div>Área</div>
  <div>Estado</div>
  <div>Ítems</div>
  <div>Cant.</div>
  <div>Total</div>
  <div>Alta</div>
  <div></div>
</div>
```

With:
```tsx
<div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1.5fr_0.9fr_0.8fr_0.8fr] border-b border-stone-800 bg-stone-900 px-4 py-3 text-xs uppercase tracking-[0.18em] text-stone-400">
  <div>Cliente</div>
  <div>Canal</div>
  <div>Área</div>
  <div>Estado</div>
  <div>Ítems</div>
  <div>Total</div>
  <div>Alta</div>
  <div></div>
</div>
```

- [ ] **Step 3: Remove CANT. data cell and update row grid**

Replace the row `className` and remove the `<div>{order.itemsCount}</div>` cell:

```tsx
<div
  key={order.id}
  className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1.5fr_0.9fr_0.8fr_0.8fr] border-b border-stone-800 px-4 py-4 text-sm text-stone-300 last:border-b-0 hover:bg-stone-900/50"
>
  {/* ... all cells EXCEPT the <div>{order.itemsCount}</div> cell ... */}
</div>
```

- [ ] **Step 4: Fix saldo — only show when balance > 0**

Replace the TOTAL cell content:
```tsx
<div>
  <p>{formatCurrency(order.totalAmount)}</p>
  <p className="mt-1 text-xs text-stone-500">
    Cobrado {formatCurrency(order.paidAmount)}
  </p>
  {order.paymentBalanceAmount > 0 && (
    <p className="mt-1 text-xs text-amber-300">
      Saldo {formatCurrency(order.paymentBalanceAmount)}
    </p>
  )}
</div>
```

- [ ] **Step 5: Verify in browser**

Navigate to `http://localhost:3000/panel/orders`. Confirm:
- Dates show "15 jun" (no year)
- No CANT. column
- Saldo row is hidden for fully-paid orders

- [ ] **Step 6: Commit**

```bash
git add src/app/\(panel\)/panel/orders/page.tsx
git commit -m "feat(orders): remove cant column, shorten dates, hide zero saldo"
```

---

## Task 2: Simplify ÁREA — zone label only, no address

**Files:**
- Modify: `src/app/(panel)/panel/orders/page.tsx`

The ÁREA column currently stacks the delivery zone slug (`capital_federal`) and the full street address. We want to show only a human-readable zone label and remove the address (it's available in the edit form).

- [ ] **Step 1: Add `getDeliveryAreaLabel` helper**

Add this function near the other helpers at the top of `page.tsx`:

```ts
function getDeliveryAreaLabel(area: string) {
  switch (area) {
    case "capital_federal":
      return "Cap. Federal";
    case "standard":
      return "GBA";
    case "pending_review":
      return "Sin zona";
    default:
      return area;
  }
}
```

- [ ] **Step 2: Simplify the ÁREA cell in the desktop table**

Replace:
```tsx
<div>
  <div>{order.deliveryArea}</div>
  <div className="mt-1 text-xs text-stone-500">{order.addressSummary}</div>
</div>
```

With:
```tsx
<div>{getDeliveryAreaLabel(order.deliveryArea)}</div>
```

- [ ] **Step 3: Verify in browser**

ÁREA column should now show short labels ("Cap. Federal", "GBA", "Sin zona") with no address text underneath. Rows should be more compact.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(panel\)/panel/orders/page.tsx
git commit -m "feat(orders): simplify area column to zone label only"
```

---

## Task 3: Move CANAL to CLIENTE cell, remove CANAL column

**Files:**
- Modify: `src/app/(panel)/panel/orders/page.tsx`

The CANAL column only adds value when the channel is not "internal". Move it as a small inline badge next to the customer name, visible only when channel ≠ "internal". Remove the dedicated CANAL column.

- [ ] **Step 1: Update desktop grid from 8 to 7 columns (remove canal slot)**

Header:
```tsx
<div className="grid grid-cols-[1.8fr_1fr_1fr_1.5fr_0.9fr_0.8fr_0.8fr] border-b border-stone-800 bg-stone-900 px-4 py-3 text-xs uppercase tracking-[0.18em] text-stone-400">
  <div>Cliente</div>
  <div>Área</div>
  <div>Estado</div>
  <div>Ítems</div>
  <div>Total</div>
  <div>Alta</div>
  <div></div>
</div>
```

Row `className`:
```tsx
className="grid grid-cols-[1.8fr_1fr_1fr_1.5fr_0.9fr_0.8fr_0.8fr] border-b border-stone-800 px-4 py-4 text-sm text-stone-300 last:border-b-0 hover:bg-stone-900/50"
```

- [ ] **Step 2: Update CLIENTE cell to show channel badge for non-internal orders**

Replace:
```tsx
<div>
  <p className="font-medium text-stone-100">{order.customerName}</p>
  <p className="mt-1 text-xs text-stone-500">
    {formatWhatsAppPhone(order.customerPhone)}
  </p>
</div>
```

With:
```tsx
<div>
  <div className="flex items-center gap-2">
    <p className="font-medium text-stone-100">{order.customerName}</p>
    {order.channel !== "internal" && (
      <span className="rounded-full border border-stone-700 px-2 py-0.5 text-xs text-stone-400">
        {getChannelLabel(order.channel)}
      </span>
    )}
  </div>
  <p className="mt-1 text-xs text-stone-500">
    {formatWhatsAppPhone(order.customerPhone)}
  </p>
</div>
```

- [ ] **Step 3: Remove the `<div>{getChannelLabel(order.channel)}</div>` cell from the row**

Delete the standalone CANAL cell from the row (the one that renders `getChannelLabel(order.channel)`).

- [ ] **Step 4: Verify in browser**

- CANAL column gone
- Internal orders: no badge
- Non-internal orders (Formulario, Revendedora, etc.): small badge inline with name

- [ ] **Step 5: Commit**

```bash
git add src/app/\(panel\)/panel/orders/page.tsx
git commit -m "feat(orders): inline channel badge on cliente, remove canal column"
```

---

## Task 4: Color-coded status badges + cleaner ESTADO cell

**Files:**
- Modify: `src/app/(panel)/panel/orders/page.tsx`

Replace plain text status with color-coded pill badges. Keep payment method below the badge. Remove the trip link from the table (too noisy — it's available in the edit form).

- [ ] **Step 1: Add `getStatusBadgeClass` helper**

```ts
function getStatusBadgeClass(status: string) {
  switch (status) {
    case "pending_confirmation":
      return "border-amber-700 bg-amber-950/60 text-amber-300";
    case "confirmed":
      return "border-sky-700 bg-sky-950/60 text-sky-300";
    case "assigned":
      return "border-violet-700 bg-violet-950/60 text-violet-300";
    case "in_route":
      return "border-emerald-700 bg-emerald-950/60 text-emerald-300";
    case "delivered":
      return "border-stone-700 bg-stone-950/60 text-stone-400";
    case "cancelled":
      return "border-red-800 bg-red-950/60 text-red-400";
    default:
      return "border-stone-700 bg-stone-900 text-stone-400";
  }
}
```

- [ ] **Step 2: Replace ESTADO cell in desktop table**

Replace:
```tsx
<div>
  <p>{getOrderStatusLabel(order.status)}</p>
  {order.tripId ? (
    <p className="mt-1 text-xs text-sky-300">Viaje {order.tripId.slice(0, 8)}</p>
  ) : null}
  <p className="mt-1 text-xs text-stone-500">
    {getPaymentStatusLabel(order.paymentStatus)} ·{" "}
    {getPaymentMethodLabel(order.paymentMethodExpected)}
  </p>
</div>
```

With:
```tsx
<div>
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
    {getOrderStatusLabel(order.status)}
  </span>
  <p className="mt-1.5 text-xs text-stone-500">
    {getPaymentMethodLabel(order.paymentMethodExpected)}
  </p>
</div>
```

- [ ] **Step 3: Update mobile card ESTADO section similarly**

In the mobile card view, replace:
```tsx
<div className="rounded-2xl bg-stone-950/80 p-3">
  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Estado</p>
  <p className="mt-1 text-stone-200">{getOrderStatusLabel(order.status)}</p>
  {order.tripId ? <p className="mt-1 text-xs text-sky-300">Viaje {order.tripId.slice(0, 8)}</p> : null}
</div>
```

With:
```tsx
<div className="rounded-2xl bg-stone-950/80 p-3">
  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Estado</p>
  <div className="mt-1">
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
      {getOrderStatusLabel(order.status)}
    </span>
  </div>
  <p className="mt-1 text-xs text-stone-500">
    {getPaymentMethodLabel(order.paymentMethodExpected)}
  </p>
</div>
```

- [ ] **Step 4: Verify in browser**

Status column should show colored pill badges. Pendiente=amber, Confirmado=sky, Asignado=violet, En ruta=emerald, Entregado=gray, Cancelado=red.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(panel\)/panel/orders/page.tsx
git commit -m "feat(orders): add color-coded status badges"
```

---

## Task 5: Make rows clickable with stretched link pattern

**Files:**
- Modify: `src/app/(panel)/panel/orders/page.tsx`

Make the entire row clickable by adding a stretched `<Link>` overlay (z-0) and raising the action button above it (z-10). This is a pure CSS trick — no client component needed.

- [ ] **Step 1: Add `relative` to row container and add stretched link**

Replace the row opening div:
```tsx
<div
  key={order.id}
  className="grid grid-cols-[1.8fr_1fr_1fr_1.5fr_0.9fr_0.8fr_0.8fr] relative border-b border-stone-800 px-4 py-4 text-sm text-stone-300 last:border-b-0 hover:bg-stone-900/50"
>
```

Then add as the FIRST child inside the row (before all content cells):
```tsx
<Link
  href={`/panel/orders/${order.id}/edit`}
  className="absolute inset-0 z-0"
  aria-label={`Ver pedido de ${order.customerName}`}
/>
```

- [ ] **Step 2: Raise the actions cell above the overlay**

Wrap the actions cell content in a relative z-10 div:
```tsx
<div className="relative z-10 flex justify-end">
  {order.isEditable ? (
    <Link
      href={`/panel/orders/${order.id}/edit`}
      className="inline-flex h-9 items-center justify-center rounded-lg border border-stone-700 px-3 text-xs font-medium text-stone-200 transition hover:border-stone-500 hover:text-stone-50"
    >
      Editar
    </Link>
  ) : (
    <span
      title="El pedido está en ruta o entregado y no puede editarse"
      className="inline-flex h-9 cursor-help items-center justify-center rounded-lg border border-stone-800 px-3 text-xs font-medium text-stone-500"
    >
      Bloqueado
    </span>
  )}
</div>
```

Note the `title` attribute on the "Bloqueado" span — this is the native browser tooltip explaining why it's locked.

- [ ] **Step 3: Add `cursor-pointer` to row hover styles**

Update row className to include `cursor-pointer`:
```tsx
className="relative grid grid-cols-[1.8fr_1fr_1fr_1.5fr_0.9fr_0.8fr_0.8fr] cursor-pointer border-b border-stone-800 px-4 py-4 text-sm text-stone-300 last:border-b-0 hover:bg-stone-900/50"
```

- [ ] **Step 4: Verify in browser**

Hover over any row — entire row should be highlighted and cursor changes to pointer. Clicking anywhere on the row (except the Editar button) should navigate to the edit page. Hovering "Bloqueado" should show the tooltip.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(panel\)/panel/orders/page.tsx
git commit -m "feat(orders): make rows clickable, add tooltip to bloqueado"
```

---

## Task 6: Add status filter tabs

**Files:**
- Create: `src/components/order-filters.tsx`
- Modify: `src/app/(panel)/panel/orders/page.tsx`

Add filter tabs above the table (All | Pendientes | Confirmados | Asignados | En ruta | Entregados) using a URL param `status`. Filtering is client-side since the data is already loaded.

- [ ] **Step 1: Create `src/components/order-filters.tsx`**

```tsx
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
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            activeStatus === opt.value
              ? "border-stone-400 bg-stone-700 text-stone-100"
              : "border-stone-700 bg-transparent text-stone-400 hover:border-stone-500 hover:text-stone-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Read `status` URL param in `page.tsx`**

Update the `SearchParams` type and destructuring:

```ts
type SearchParams = Promise<{ q?: string; status?: string }>;
```

```ts
const { q, status: statusFilter } = await searchParams;
const normalizedStatusFilter = statusFilter ?? "";
```

- [ ] **Step 3: Apply status filter to `visibleOrderRows`**

Replace the current filter logic:
```ts
const visibleOrderRows = safeQ
  ? orderRows.filter((order) =>
      matchesNormalizedSearchValues(
        [order.customerFirstName, order.customerLastName, order.customerName, order.resellerName, order.customerPhone],
        safeQ
      )
    )
  : orderRows;
```

With:
```ts
const visibleOrderRows = orderRows.filter((order) => {
  const matchesSearch = safeQ
    ? matchesNormalizedSearchValues(
        [order.customerFirstName, order.customerLastName, order.customerName, order.resellerName, order.customerPhone],
        safeQ
      )
    : true;
  const matchesStatus = normalizedStatusFilter ? order.status === normalizedStatusFilter : true;
  return matchesSearch && matchesStatus;
});
```

- [ ] **Step 4: Add `OrderFilters` to the page UI**

Import and add the component. In `page.tsx`, add to imports:
```ts
import { OrderFilters } from "@/components/order-filters";
```

In the JSX, add `OrderFilters` between the heading and the search box:
```tsx
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h2 className="text-lg font-semibold text-stone-50">Todos los pedidos</h2>
    <p className="mt-1 text-sm text-stone-500">
      {visibleOrderRows.length} {normalizedQuery ? "resultado(s)" : "pedido(s)"}
    </p>
  </div>
  <Suspense>
    <OrderSearch defaultValue={normalizedQuery} />
  </Suspense>
</div>
<Suspense>
  <OrderFilters activeStatus={normalizedStatusFilter} />
</Suspense>
```

- [ ] **Step 5: Verify in browser**

- Filter tabs appear below the heading
- Clicking "Pendientes" filters to `pending_confirmation` orders
- Clicking "Todos" resets the filter
- Search and status filter work together

- [ ] **Step 6: Commit**

```bash
git add src/app/\(panel\)/panel/orders/page.tsx src/components/order-filters.tsx
git commit -m "feat(orders): add status filter tabs"
```

---

## Self-Review

**Spec coverage:**
- ✅ Remove CANT. column — Task 1
- ✅ Shorten date format — Task 1
- ✅ Fix saldo always red — Task 1
- ✅ Simplify ÁREA column — Task 2
- ✅ Remove CANAL column — Task 3
- ✅ Status color badges — Task 4
- ✅ Make rows clickable — Task 5
- ✅ Bloqueado tooltip — Task 5
- ✅ Status filter — Task 6

**Placeholder scan:** No TBDs, all code blocks are complete.

**Type consistency:** `normalizedStatusFilter` string is passed to `OrderFilters` as `activeStatus` string. `order.status` is `OrderStatus` enum — compared with `===` against the string value from URL params which is safe in TS since it's just a string comparison.
