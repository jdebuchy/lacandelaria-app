"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getRoleLabel } from "@/lib/auth-shared";
import type { UserRole } from "@/lib/types";

type PanelNavProps = {
  role: UserRole;
  userEmail: string | null;
  userName: string;
};

const linksByRole: Record<UserRole, { href: string; label: string }[]> = {
  admin: [
    { href: "/panel", label: "Resumen" },
    { href: "/panel/orders", label: "Pedidos" },
    { href: "/panel/logistics", label: "Logística" },
    { href: "/panel/customers", label: "Clientes" },
    { href: "/panel/users", label: "Usuarios" },
    { href: "/panel/products", label: "Catálogo" },
    { href: "/driver", label: "Reparto" }
  ],
  seller: [
    { href: "/panel", label: "Resumen" },
    { href: "/panel/orders", label: "Pedidos" },
    { href: "/panel/logistics", label: "Logística" },
    { href: "/panel/customers", label: "Clientes" }
  ],
  collector: [
    { href: "/panel", label: "Resumen" },
    { href: "/panel/orders", label: "Pedidos" },
    { href: "/panel/logistics", label: "Logística" },
    { href: "/panel/customers", label: "Clientes" }
  ],
  driver: [{ href: "/driver", label: "Reparto" }]
};

export function PanelNav({ role, userEmail, userName }: PanelNavProps) {
  const pathname = usePathname();
  const links = linksByRole[role];

  return (
    <header className="sticky top-0 z-30 border-b border-stone-800/60 bg-stone-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs text-stone-600 transition hover:text-stone-400"
            title="Volver al sitio publico"
          >
            ← Sitio
          </Link>
          <span className="h-3 w-px bg-stone-800" />
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-400 ring-4 ring-sky-400/20" />
            <span className="text-xs uppercase tracking-[0.2em] text-stone-400">Panel interno</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    isActive
                      ? "border-sky-400/40 bg-sky-500/10 text-sky-200"
                      : "border-transparent text-stone-400 hover:border-stone-800 hover:text-stone-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden rounded-2xl border border-stone-800 bg-stone-900/80 px-3 py-2 text-right sm:block">
            <p className="text-sm text-stone-100">{userName}</p>
            <p className="text-xs text-stone-500">
              {getRoleLabel(role)}
              {userEmail ? ` · ${userEmail}` : ""}
            </p>
          </div>

          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-full border border-stone-800 bg-stone-900/70 px-4 py-2 text-sm text-stone-300 transition hover:border-stone-700 hover:text-stone-100"
            >
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
