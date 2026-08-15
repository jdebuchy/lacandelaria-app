import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { TONE_CLASS, type Tone } from "@/lib/status-tone";

type BadgeProps = {
  children: ReactNode;
  className?: string;
  tone?: Tone;
};

/**
 * Pastilla de estado.
 *
 * El color no se elige aca: llega desde status-tone.ts, que es la unica fuente
 * de verdad de que significa cada estado. Antes esto estaba resuelto ocho veces
 * en ocho archivos, con resultados distintos entre el listado y el detalle del
 * mismo pedido.
 */
export function Badge({ children, className, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-label",
        TONE_CLASS[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * El sello de zona.
 *
 * Es la firma visual del sistema, y el unico lugar de toda la app donde se usa
 * el color pulpa. Existe porque la zona es el campo que mas pesa operativamente
 * despues del nombre: define en que viaje entra el pedido. Como texto gris
 * chico obligaba a leer las 50 filas; como sello, se agrupa de un vistazo.
 *
 * Si esto empieza a aparecer en otros lugares, deja de funcionar.
 */
export function ZoneStamp({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-control bg-pulp px-1.5 py-0.5",
        "text-[0.6875rem] font-semibold uppercase leading-none tracking-wide text-pulp-fg",
        className
      )}
    >
      {children}
    </span>
  );
}
