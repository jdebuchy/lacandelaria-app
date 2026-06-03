"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PublicNav() {
  const pathname = usePathname();
  const isOnOrderPage = pathname === "/order";

  return (
    <header className="border-b border-stone-800/60 bg-stone-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="h-2 w-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20 transition group-hover:ring-emerald-400/40" />
          <span className="text-sm font-semibold tracking-tight text-stone-50">
            La Candelaria
          </span>
          <span className="hidden text-xs text-stone-500 sm:inline">Paltas</span>
        </Link>

        <nav className="flex items-center gap-2">
          {isOnOrderPage ? (
            <Link
              href="/"
              className="rounded-full border border-stone-800 bg-stone-900/70 px-4 py-2 text-sm text-stone-300 transition hover:border-stone-700 hover:text-stone-50"
            >
              ← Inicio
            </Link>
          ) : (
            <Link
              href="/order"
              className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20"
            >
              Hacer pedido
            </Link>
          )}
          <Link
            href="/panel"
            className="rounded-full border border-stone-800 bg-stone-900/70 px-3 py-2 text-xs uppercase tracking-[0.18em] text-stone-500 transition hover:text-stone-300"
          >
            Panel
          </Link>
        </nav>
      </div>
    </header>
  );
}
