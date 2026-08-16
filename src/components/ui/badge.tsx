import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { TONE_CLASS, TONE_TEXT_CLASS, type Prominence, type Tone } from "@/lib/status-tone";

type BadgeProps = {
  children: ReactNode;
  className?: string;
  /**
   * Cuanto grita. Sale de status-tone.ts, no se elige a mano en cada pantalla.
   * Ver `orderStatusProminence` y sus hermanas.
   */
  prominence?: Prominence;
  tone?: Tone;
};

/**
 * Estado de una fila.
 *
 * El color no se elige aca: llega desde status-tone.ts, que es la unica fuente
 * de verdad de que significa cada estado. Antes esto estaba resuelto ocho veces
 * en ocho archivos, con resultados distintos entre el listado y el detalle del
 * mismo pedido.
 *
 * La prominencia es lo que evita el muro de color: en una tabla donde el 90%
 * de las filas dice "Entregado", la caja no informa, solo ocupa.
 */
export function Badge({ children, className, prominence = "loud", tone = "neutral" }: BadgeProps) {
  if (prominence === "flat") {
    return <span className={cn("text-ink-soft", className)}>{children}</span>;
  }

  if (prominence === "soft") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-ink-soft", className)}>
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full bg-current", TONE_TEXT_CLASS[tone])}
        />
        {children}
      </span>
    );
  }

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
 * Reservado a Armado de viajes y a Delivery, que es donde agrupar por zona ES
 * la tarea: define que pedidos entran en cada camioneta. Ahi el sello aparece
 * agrupado y se gana el lugar.
 *
 * En Pedidos la zona va como texto plano. Se probo con el sello y se veia mal:
 * repetido en las 50 filas gritaba mas que el nombre del cliente. Algo que
 * aparece 50 veces por pantalla no es una firma, es fondo.
 *
 * Junto con la marca, es el unico uso de pulpa en toda la app.
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
