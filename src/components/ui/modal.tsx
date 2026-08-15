"use client";

import { faXmark } from "@fortawesome/pro-regular-svg-icons";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";

/**
 * Dialogo modal.
 *
 * Reemplaza nueve overlays `fixed inset-0` escritos a mano, de los cuales ocho
 * no tenian rol ARIA ni cerraban con Escape, ninguno atrapaba el foco, y entre
 * todos usaban cinco alineaciones, cuatro fondos y dos z-index distintos.
 *
 * Es tanto un arreglo visual como de accesibilidad: sin foco atrapado, tabular
 * dentro de un modal te lleva a los controles de atras, que estan tapados.
 *
 * En telefono entra desde abajo y ocupa el ancho completo, que es donde llega
 * el pulgar; en escritorio queda centrado.
 */
type ModalProps = {
  children: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
  size?: "md" | "lg";
  title: ReactNode;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  children,
  description,
  footer,
  onClose,
  open,
  size = "md",
  title
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    // A quien hay que devolverle el foco cuando esto se cierre.
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus() ?? panel?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panel) {
        return;
      }

      // Foco atrapado: Tab en el ultimo elemento vuelve al primero, y
      // Shift+Tab en el primero salta al ultimo.
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = overflow;
      restoreFocusRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Cerrar"
        className="absolute inset-0 bg-ink/40 backdrop-blur-xs"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-modal="true"
        className={cn(
          "relative flex max-h-[90dvh] w-full flex-col overflow-hidden bg-paper shadow-overlay",
          "rounded-t-card sm:rounded-card",
          size === "lg" ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-title text-ink">{title}</h2>
            {description ? <p className="mt-1 text-body text-ink-soft">{description}</p> : null}
          </div>
          <IconButton icon={faXmark} label="Cerrar" onClick={onClose} size="sm" variant="ghost" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
