"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getRoleLabel } from "@/lib/auth-shared";
import type { UserRole } from "@/lib/types";

type PanelNavProps = {
  role: UserRole;
  userEmail: string | null;
  userName: string;
};

type NavIconKey =
  | "overview"
  | "orders"
  | "logistics"
  | "customers"
  | "users"
  | "products"
  | "driver";

type NavItem = {
  exact?: boolean;
  href: string;
  iconKey: NavIconKey;
  label: string;
  match: string[];
  section: "main" | "system";
};

const linksByRole: Record<UserRole, NavItem[]> = {
  admin: [
    {
      href: "/panel",
      exact: true,
      iconKey: "overview",
      label: "Resumen",
      match: ["/panel"],
      section: "main"
    },
    {
      href: "/panel/customers",
      iconKey: "customers",
      label: "Clientes",
      match: ["/panel/customers"],
      section: "main"
    },
    {
      href: "/panel/orders",
      iconKey: "orders",
      label: "Pedidos",
      match: ["/panel/orders"],
      section: "main"
    },
    {
      href: "/panel/logistics",
      iconKey: "logistics",
      label: "Logística",
      match: ["/panel/logistics"],
      section: "main"
    },
    {
      href: "/driver",
      iconKey: "driver",
      label: "Reparto",
      match: ["/driver"],
      section: "main"
    },
    {
      href: "/panel/products",
      iconKey: "products",
      label: "Productos",
      match: ["/panel/products"],
      section: "main"
    },
    {
      href: "/panel/users",
      iconKey: "users",
      label: "Usuarios",
      match: ["/panel/users"],
      section: "system"
    }
  ],
  seller: [
    {
      href: "/panel",
      exact: true,
      iconKey: "overview",
      label: "Resumen",
      match: ["/panel"],
      section: "main"
    },
    {
      href: "/panel/customers",
      iconKey: "customers",
      label: "Clientes",
      match: ["/panel/customers"],
      section: "main"
    },
    {
      href: "/panel/orders",
      iconKey: "orders",
      label: "Pedidos",
      match: ["/panel/orders"],
      section: "main"
    },
    {
      href: "/panel/logistics",
      iconKey: "logistics",
      label: "Logística",
      match: ["/panel/logistics"],
      section: "main"
    }
  ],
  collector: [
    {
      href: "/panel",
      exact: true,
      iconKey: "overview",
      label: "Resumen",
      match: ["/panel"],
      section: "main"
    },
    {
      href: "/panel/customers",
      iconKey: "customers",
      label: "Clientes",
      match: ["/panel/customers"],
      section: "main"
    },
    {
      href: "/panel/orders",
      iconKey: "orders",
      label: "Pedidos",
      match: ["/panel/orders"],
      section: "main"
    },
    {
      href: "/panel/logistics",
      iconKey: "logistics",
      label: "Logística",
      match: ["/panel/logistics"],
      section: "main"
    }
  ],
  driver: [
    {
      href: "/driver",
      iconKey: "driver",
      label: "Reparto",
      match: ["/driver"],
      section: "main"
    }
  ]
};

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-4 w-5" aria-hidden="true">
      <span
        className={classNames(
          "absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition",
          open && "translate-y-[7px] rotate-45"
        )}
      />
      <span
        className={classNames(
          "absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-current transition",
          open && "opacity-0"
        )}
      />
      <span
        className={classNames(
          "absolute left-0 top-[14px] h-0.5 w-5 rounded-full bg-current transition",
          open && "-translate-y-[7px] -rotate-45"
        )}
      />
    </span>
  );
}

function NavIcon({ iconKey }: { iconKey: NavIconKey }) {
  const commonProps = {
    className: "h-5 w-5",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24"
  };

  switch (iconKey) {
    case "overview":
      return (
        <svg {...commonProps}>
          <path d="M4 12.5 12 5l8 7.5" />
          <path d="M6.5 10.5V20h11V10.5" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    case "orders":
      return (
        <svg {...commonProps}>
          <rect x="4" y="5" width="16" height="14" rx="2.5" />
          <path d="M8 9.5h8" />
          <path d="M8 13h8" />
          <path d="M8 16.5h5" />
        </svg>
      );
    case "logistics":
      return (
        <svg {...commonProps}>
          <path d="M4 7.5h10v8H4z" />
          <path d="M14 10h3l3 3v2.5h-2" />
          <path d="M7.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
          <path d="M16.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
        </svg>
      );
    case "customers":
      return (
        <svg {...commonProps}>
          <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M5 19a7 7 0 0 1 14 0" />
        </svg>
      );
    case "users":
      return (
        <svg {...commonProps}>
          <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M17 12.5a2.5 2.5 0 1 0 0-5" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M15 16.5a4.5 4.5 0 0 1 5.5 2.5" />
        </svg>
      );
    case "products":
      return (
        <svg {...commonProps}>
          <path d="M12 4 5 7.5 12 11l7-3.5L12 4Z" />
          <path d="M5 7.5V16l7 4 7-4V7.5" />
          <path d="M12 11v9" />
        </svg>
      );
    case "driver":
      return (
        <svg {...commonProps}>
          <path d="M5 8h9v6H5z" />
          <path d="M14 10h2.5l2.5 2.5V14h-2" />
          <path d="M8 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
          <path d="M17 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
        </svg>
      );
  }
}

function FooterActionIcon({ type }: { type: "home" | "logout" | "menu" }) {
  const commonProps = {
    className: "h-4 w-4",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24"
  };

  if (type === "home") {
    return (
      <svg {...commonProps}>
        <path d="M4 12.5 12 5l8 7.5" />
        <path d="M7 10.5V19h10v-8.5" />
      </svg>
    );
  }

  if (type === "menu") {
    return (
      <svg {...commonProps}>
        <circle cx="5" cy="12" r="1.25" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1.25" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M10 7H6.5A1.5 1.5 0 0 0 5 8.5v7A1.5 1.5 0 0 0 6.5 17H10" />
      <path d="M13 8.5 17.5 12 13 15.5" />
      <path d="M9 12h8.5" />
    </svg>
  );
}

function isItemActive(pathname: string, item: NavItem) {
  return item.match.some((match) =>
    item.exact ? pathname === match : pathname === match || pathname.startsWith(`${match}/`)
  );
}

function SidebarContent({
  links,
  pathname,
  role,
  userEmail,
  userName
}: {
  links: NavItem[];
  pathname: string;
  role: UserRole;
  userEmail: string | null;
  userName: string;
}) {
  const mainLinks = links.filter((item) => item.section === "main");
  const systemLinks = links.filter((item) => item.section === "system");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [userMenuOpen]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-6">
        <Link href="/" className="inline-flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sm font-semibold text-sky-200">
            LC
          </span>
          <span className="min-w-0">
            <span className="block text-xs uppercase tracking-[0.28em] text-stone-500">
              La Candelaria
            </span>
            <span className="mt-1 block truncate text-base font-semibold text-stone-50">
              Panel interno
            </span>
          </span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="px-3 text-[11px] uppercase tracking-[0.24em] text-stone-500">Operación</p>
        <nav className="mt-3">
          <ul className="space-y-1">
            {mainLinks.map((item) => {
              const isActive = isItemActive(pathname, item);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={classNames(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                      isActive
                        ? "bg-stone-900 text-stone-50"
                        : "text-stone-400 hover:bg-stone-900/70 hover:text-stone-100"
                    )}
                  >
                    <span
                      className={classNames(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                        isActive
                          ? "text-sky-200"
                          : "text-stone-500 group-hover:text-stone-300"
                      )}
                    >
                      <NavIcon iconKey={item.iconKey} />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {systemLinks.length ? (
          <>
            <div className="mx-3 my-5 border-t border-stone-800/80" />
            <p className="px-3 text-[11px] uppercase tracking-[0.24em] text-stone-500">Sistema</p>
            <nav className="mt-3">
              <ul className="space-y-1">
                {systemLinks.map((item) => {
                  const isActive = isItemActive(pathname, item);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={classNames(
                          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                          isActive
                            ? "bg-stone-900 text-stone-50"
                            : "text-stone-400 hover:bg-stone-900/70 hover:text-stone-100"
                        )}
                      >
                        <span
                          className={classNames(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                            isActive
                              ? "text-sky-200"
                              : "text-stone-500 group-hover:text-stone-300"
                          )}
                        >
                          <NavIcon iconKey={item.iconKey} />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </>
        ) : null}
      </div>

      <div className="border-t border-stone-800/80 px-4 py-3">
        <div ref={userMenuRef} className="relative flex items-center gap-2">
          <button
            type="button"
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            aria-label="Abrir menú de usuario"
            onClick={() => setUserMenuOpen((current) => !current)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-stone-800 bg-stone-900/50 px-3 py-2 text-left text-stone-400 transition hover:border-stone-700 hover:text-stone-100"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-xs font-semibold text-emerald-200">
              {userName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() ?? "")
                .join("") || "LC"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-stone-100">{userName}</span>
              <span className="block truncate text-xs text-stone-500">
                {userEmail || getRoleLabel(role)}
              </span>
            </span>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-800 bg-stone-950/70">
              <FooterActionIcon type="menu" />
            </span>
          </button>

          {userMenuOpen ? (
            <div className="absolute bottom-[calc(100%+0.75rem)] left-0 right-0 z-20 overflow-hidden rounded-3xl border border-stone-800 bg-stone-950/95 shadow-2xl shadow-black/50 backdrop-blur">
              <div className="border-b border-stone-800 px-4 py-4">
                <p className="truncate text-sm font-medium text-stone-100">{userName}</p>
                <p className="mt-1 truncate text-xs text-stone-500">
                  {userEmail || getRoleLabel(role)}
                </p>
              </div>

              <div className="p-2">
                <Link
                  href="/"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center justify-between rounded-2xl px-3 py-3 text-sm text-stone-300 transition hover:bg-stone-900 hover:text-stone-100"
                >
                  <span>Sitio principal</span>
                  <span className="text-stone-500">
                    <FooterActionIcon type="home" />
                  </span>
                </Link>

                <form action="/api/auth/signout" method="post">
                  <button
                    type="submit"
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-sm text-stone-300 transition hover:bg-stone-900 hover:text-stone-100"
                  >
                    <span>Log out</span>
                    <span className="text-stone-500">
                      <FooterActionIcon type="logout" />
                    </span>
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PanelNav({ role, userEmail, userName }: PanelNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = linksByRole[role];
  const activeLink = useMemo(
    () => links.find((item) => isItemActive(pathname, item)) ?? links[0],
    [links, pathname]
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <>
      <aside className="hidden lg:flex lg:w-[16.5rem] lg:flex-col lg:border-r lg:border-stone-800/70 lg:bg-stone-950/90 lg:backdrop-blur xl:w-[17.5rem]">
        <div className="lg:sticky lg:top-0 lg:h-screen">
          <SidebarContent
            links={links}
            pathname={pathname}
            role={role}
            userEmail={userEmail}
            userName={userName}
          />
        </div>
      </aside>

      <div className="sticky top-0 z-30 border-b border-stone-800/70 bg-stone-950/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">Panel interno</p>
            <p className="mt-1 truncate text-sm font-medium text-stone-100">
              {activeLink?.label ?? "Navegación"}
            </p>
          </div>

          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="panel-mobile-nav"
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMobileOpen((current) => !current)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-700 bg-stone-900 text-stone-100 transition hover:border-sky-400/40 hover:text-sky-200"
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />

          <aside
            id="panel-mobile-nav"
            className="fixed inset-y-0 left-0 z-50 w-full max-w-sm border-r border-stone-800 bg-stone-950 shadow-2xl shadow-black/50"
          >
            <SidebarContent
              links={links}
              pathname={pathname}
              role={role}
              userEmail={userEmail}
              userName={userName}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
