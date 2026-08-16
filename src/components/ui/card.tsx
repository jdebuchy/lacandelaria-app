import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Contenedor de bloque.
 *
 * Regla del sistema: una caja por bloque, nunca caja dentro de caja. Antes
 * habia cinco firmas de card distintas conviviendo, y el patron
 * `rounded-2xl bg-stone-950/80 p-3` aparecia 16 veces *adentro* de otra card.
 * Eso es lo que hacia que todo se viera acolchonado y sin jerarquia.
 *
 * Si necesitas separar contenido adentro de una Card, usa CardRow: divide con
 * una linea, no con otra caja.
 */
export function Card({
  children,
  className,
  padded = true
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-card border border-line bg-paper",
        padded && "p-4 sm:p-5",
        className
      )}
    >
      {children}
    </section>
  );
}

/** Fila dentro de una Card. Separa con linea, no con otra caja. */
export function CardRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("border-t border-line px-4 py-3 first:border-t-0 sm:px-5", className)}>
      {children}
    </div>
  );
}

/** Encabezado de una Card o de una seccion dentro de la pagina. */
export function CardHeader({
  action,
  className,
  description,
  title
}: {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-title text-ink">{title}</h2>
        {description ? <p className="mt-1 text-body text-ink-soft">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Encabezado de pagina: titulo y contexto a la izquierda, accion primaria
 * arriba a la derecha. Es la convencion que ya venia documentada en
 * docs/panel-ux-refresh.md, ahora en un solo lugar en vez de repetida a mano
 * en 15 paginas.
 */
export function PageHeader({
  action,
  description,
  title
}: {
  action?: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-display text-ink">{title}</h1>
        {description ? <p className="mt-1 text-body text-ink-soft">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/** Contenedor de pagina. Un solo ancho maximo para todo el panel. */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6", className)}>
      {children}
    </div>
  );
}
