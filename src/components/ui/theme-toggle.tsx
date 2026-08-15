"use client";

import { faMoon, faSun } from "@fortawesome/pro-regular-svg-icons";
import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";
import { IconButton } from "./button";

/**
 * Cambia entre claro y oscuro y lo recuerda en el dispositivo.
 *
 * El estado inicial se lee del DOM, no de localStorage: el script inline del
 * layout ya corrio y ya puso la clase, asi que el DOM es la fuente de verdad y
 * no hay riesgo de que el boton muestre un sol mientras la pantalla esta
 * oscura.
 *
 * Hasta que monta, renderiza el boton deshabilitado en vez de nada, para que la
 * barra no salte de ancho al hidratar.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";

    document.documentElement.classList.toggle("dark", next === "dark");
    setTheme(next);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Safari en modo privado no deja escribir. El tema igual cambia, solo
      // que no sobrevive a la recarga.
    }
  }

  const isDark = theme === "dark";

  return (
    <IconButton
      className={className}
      disabled={theme === null}
      icon={isDark ? faSun : faMoon}
      label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      onClick={toggle}
      size="sm"
      variant="ghost"
    />
  );
}
