import { FontAwesomeIcon, type FontAwesomeIconProps } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { cn } from "@/lib/cn";

type IconProps = { icon: IconDefinition } & Omit<FontAwesomeIconProps, "icon">;

/**
 * Icono de FontAwesome Pro.
 *
 * Se dimensiona en em, no en px: hereda el tamaño de fuente del contexto, asi
 * que el mismo icono achica solo dentro de una fila de tabla y agranda dentro
 * de un boton tactil de /reparto, sin que nadie tenga que pasarle un tamaño.
 *
 * Mismo wrapper que 40q-bi-scripts/crm/frontend, a proposito.
 */
export function Icon({ icon, className, ...props }: IconProps) {
  return (
    <FontAwesomeIcon icon={icon} className={cn("h-[1em] w-[1em]", className)} {...props} />
  );
}
