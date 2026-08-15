"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PublicNav() {
  const pathname = usePathname();
  const isOnOrderPage = pathname === "/order";

  return (
    <header className="border-b border-line bg-paper-muted backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="h-2 w-2 rounded-full bg-accent ring-4 ring-accent transition group-hover:ring-accent" />
          <span className="text-body font-semibold tracking-tight text-ink">
            La Candelaria
          </span>
          <span className="hidden text-meta text-ink-faint sm:inline">Paltas</span>
        </Link>

        <nav className="flex items-center gap-2">
          {isOnOrderPage ? (
            <Link
              href="/"
              className="rounded-control border border-line bg-paper px-4 py-2 text-body text-ink-soft transition hover:border-line hover:text-ink"
            >
              ← Inicio
            </Link>
          ) : (
            <Link
              href="/order"
              className="rounded-control border border-accent bg-accent-soft px-4 py-2 text-body font-medium text-accent transition hover:bg-accent-soft"
            >
              Hacer pedido
            </Link>
          )}
          <Link
            href="/panel"
            className="rounded-control border border-line bg-paper px-3 py-2 text-meta text-ink-faint transition hover:text-ink-soft"
          >
            Panel
          </Link>
        </nav>
      </div>
    </header>
  );
}
