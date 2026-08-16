import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { TONE_TEXT_CLASS, type Tone } from "@/lib/status-tone";

/**
 * Tarjeta de metrica.
 *
 * Este componente ya existia: era `MetricCard` y `KpiCard` dentro de
 * reports/page.tsx, pero como `function` local sin export, asi que las otras
 * seis pantallas lo volvieron a escribir a mano y fueron divergiendo
 * (bg-stone-900/60 en unas, /70 en otras; text-2xl sm:text-3xl en unas,
 * text-3xl fijo en otras).
 *
 * El tono se elige por significado, no por variedad. En el panel viejo los
 * cuatro KPI de Pedidos eran ambar, verde, azul y blanco sin criterio, y encima
 * el color no coincidia con el badge del mismo estado en la tabla de abajo.
 */
type MetricCardProps = {
  detail?: ReactNode;
  href?: string;
  label: ReactNode;
  tone?: Tone;
  value: ReactNode;
};

export function MetricCard({ detail, href, label, tone = "neutral", value }: MetricCardProps) {
  const content = (
    <>
      <p className="text-label text-ink-soft">{label}</p>
      <p className={cn("mt-1 text-[1.75rem] font-semibold leading-none", TONE_TEXT_CLASS[tone])} data-numeric>
        {value}
      </p>
      {detail ? <p className="mt-1.5 text-meta text-ink-faint">{detail}</p> : null}
    </>
  );

  const className = cn(
    "rounded-card border border-line bg-paper p-4",
    href && "transition-colors hover:border-line-strong hover:bg-paper-raised"
  );

  if (href) {
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    );
  }

  return <article className={className}>{content}</article>;
}

/** Grilla estandar de metricas. Dos columnas en telefono, cuatro en escritorio. */
export function MetricGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>{children}</div>
  );
}
