"use client";

import { faArrowRightFromBracket, faBars, faHouse, faXmark } from "@fortawesome/pro-regular-svg-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getRoleLabel } from "@/lib/auth-shared";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/lib/types";
import {
  NAV_ICONS,
  getActiveItemLabel,
  isItemActive,
  isMatchActive,
  linksByRole,
  type NavItem
} from "./panel-nav-links";

type PanelNavProps = {
  role: UserRole;
  userEmail: string | null;
  userName: string;
};

const SECTIONS = [
  { key: "main", label: "Operación" },
  { key: "management", label: "Gestión" },
  { key: "system", label: "Sistema" }
] as const;

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "LC"
  );
}

/**
 * Un item del menu, con sus hijos si los tiene.
 *
 * Antes este bloque estaba escrito tres veces, una por seccion, identico salvo
 * por el array que recorria. Cualquier ajuste habia que hacerlo tres veces.
 */
function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isItemActive(pathname, item);

  return (
    <li>
      <Link
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-control px-3 py-2 text-body transition-colors",
          active
            ? "bg-accent-soft font-medium text-accent"
            : "text-ink-soft hover:bg-paper-raised hover:text-ink"
        )}
        href={item.href}
      >
        <Icon aria-hidden className="shrink-0 text-base" icon={NAV_ICONS[item.iconKey]} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </Link>

      {item.children?.length ? (
        <ul className="mt-0.5 space-y-0.5 border-l border-line pl-3 ml-6">
          {item.children.map((child) => {
            const childActive = isMatchActive(pathname, child);

            return (
              <li key={child.href}>
                <Link
                  aria-current={childActive ? "page" : undefined}
                  className={cn(
                    "block truncate rounded-control px-3 py-1.5 text-body transition-colors",
                    childActive
                      ? "font-medium text-accent"
                      : "text-ink-faint hover:bg-paper-raised hover:text-ink"
                  )}
                  href={child.href}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

function SidebarContent({
  links,
  onNavigate,
  pathname,
  role,
  userEmail,
  userName
}: {
  links: NavItem[];
  onNavigate?: () => void;
  pathname: string;
  role: UserRole;
  userEmail: string | null;
  userName: string;
}) {
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
    <div className="flex h-full flex-col bg-paper">
      <div className="flex items-center justify-between gap-2 px-4 py-4">
        <Link className="flex min-w-0 items-center gap-2.5" href="/" onClick={onNavigate}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-accent text-label font-semibold text-accent-fg">
            LC
          </span>
          <span className="min-w-0 truncate text-body font-semibold text-ink">La Candelaria</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {SECTIONS.map((section) => {
          const items = links.filter((item) => item.section === section.key);

          if (items.length === 0) {
            return null;
          }

          return (
            <nav aria-label={section.label} className="mt-4 first:mt-0" key={section.key}>
              <p className="px-3 pb-1.5 text-label text-ink-faint">{section.label}</p>
              <ul className="space-y-0.5" onClick={onNavigate}>
                {items.map((item) => (
                  <NavLink item={item} key={item.href} pathname={pathname} />
                ))}
              </ul>
            </nav>
          );
        })}
      </div>

      <div className="border-t border-line p-3">
        <div className="relative" ref={userMenuRef}>
          <button
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            className="flex w-full min-w-0 items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors hover:bg-paper-raised"
            onClick={() => setUserMenuOpen((current) => !current)}
            type="button"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-label font-semibold text-accent">
              {initials(userName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-medium text-ink">{userName}</span>
              <span className="block truncate text-meta text-ink-faint">
                {userEmail || getRoleLabel(role)}
              </span>
            </span>
          </button>

          {userMenuOpen ? (
            <div
              className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-20 overflow-hidden rounded-card border border-line bg-paper shadow-overlay"
              role="menu"
            >
              <Link
                className="flex items-center gap-2.5 px-3 py-2.5 text-body text-ink-soft transition-colors hover:bg-paper-raised hover:text-ink"
                href="/"
                onClick={() => setUserMenuOpen(false)}
                role="menuitem"
              >
                <Icon aria-hidden icon={faHouse} />
                Sitio principal
              </Link>

              <form action="/api/auth/signout" method="post">
                <button
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-body text-ink-soft transition-colors hover:bg-paper-raised hover:text-ink"
                  role="menuitem"
                  type="submit"
                >
                  <Icon aria-hidden icon={faArrowRightFromBracket} />
                  Cerrar sesión
                </button>
              </form>
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
  const activeLabel = useMemo(() => getActiveItemLabel(links, pathname), [links, pathname]);

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
      <aside className="hidden border-r border-line lg:flex lg:w-64 lg:flex-col">
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

      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-paper px-4 py-2.5 lg:hidden">
        <p className="min-w-0 truncate text-body font-medium text-ink">{activeLabel}</p>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <IconButton
            aria-controls="panel-mobile-nav"
            aria-expanded={mobileOpen}
            icon={mobileOpen ? faXmark : faBars}
            label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMobileOpen((current) => !current)}
            variant="ghost"
          />
        </div>
      </div>

      {mobileOpen ? (
        <div className="lg:hidden">
          <button
            aria-label="Cerrar menú"
            className="fixed inset-0 z-40 bg-ink/40"
            onClick={() => setMobileOpen(false)}
            type="button"
          />

          <aside
            className="fixed inset-y-0 left-0 z-50 w-full max-w-xs border-r border-line shadow-overlay"
            id="panel-mobile-nav"
          >
            <SidebarContent
              links={links}
              onNavigate={() => setMobileOpen(false)}
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
