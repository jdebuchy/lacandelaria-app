"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  {
    href: "/",
    label: "Inicio",
    description: "Resumen del sistema y accesos."
  },
  {
    href: "/order",
    label: "Pedido online",
    description: "Formulario publico para clientes."
  },
  {
    href: "/panel",
    label: "Operacion",
    description: "Pedidos, usuarios y seguimiento diario."
  },
  {
    href: "/panel/logistics/delivery",
    label: "Reparto",
    description: "Ruta del dia y estados de entrega."
  }
];

function MenuIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-4 w-5" aria-hidden="true">
      <span
        className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition ${
          open ? "translate-y-[7px] rotate-45" : ""
        }`}
      />
      <span
        className={`absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-current transition ${
          open ? "opacity-0" : ""
        }`}
      />
      <span
        className={`absolute left-0 top-[14px] h-0.5 w-5 rounded-full bg-current transition ${
          open ? "-translate-y-[7px] -rotate-45" : ""
        }`}
      />
    </span>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <header className="relative z-30">
      <div className="flex items-center justify-between gap-3 rounded-3xl border border-stone-800 bg-stone-950/85 px-4 py-3 backdrop-blur sm:hidden">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Navegacion</p>
          <p className="mt-1 text-sm font-medium text-stone-100">
            {links.find((link) => link.href === pathname)?.label ?? "Menu"}
          </p>
        </div>

        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="site-mobile-nav"
          aria-label={isOpen ? "Cerrar menu" : "Abrir menu"}
          onClick={() => setIsOpen((current) => !current)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-700 bg-stone-900 text-stone-100 transition hover:border-emerald-400/40 hover:text-emerald-200"
        >
          <MenuIcon open={isOpen} />
        </button>
      </div>

      <nav className="hidden flex-wrap items-center gap-3 text-sm text-stone-300 sm:flex">
        {links.map((link) => {
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full border px-4 py-2 transition ${
                isActive
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                  : "border-stone-800 bg-stone-900/70 hover:border-emerald-400/40 hover:text-stone-50"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {isOpen ? (
        <div className="sm:hidden">
          <button
            type="button"
            aria-label="Cerrar menu"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          <nav
            id="site-mobile-nav"
            className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-50 rounded-[2rem] border border-stone-800 bg-stone-950/95 p-3 shadow-2xl shadow-black/40"
          >
            <div className="grid gap-2">
              {links.map((link) => {
                const isActive = pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-[1.5rem] border px-4 py-4 transition ${
                      isActive
                        ? "border-emerald-400/40 bg-emerald-500/10"
                        : "border-stone-800 bg-stone-900/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            isActive ? "text-emerald-200" : "text-stone-100"
                          }`}
                        >
                          {link.label}
                        </p>
                        <p className="mt-1 text-sm text-stone-400">{link.description}</p>
                      </div>
                      <span
                        className={`mt-0.5 rounded-full px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${
                          isActive
                            ? "bg-emerald-400/15 text-emerald-200"
                            : "bg-stone-800 text-stone-400"
                        }`}
                      >
                        {isActive ? "Actual" : "Ir"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
