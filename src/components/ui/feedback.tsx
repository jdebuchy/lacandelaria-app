import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faSpinnerThird } from "@fortawesome/pro-regular-svg-icons";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { TONE_CLASS, type Tone } from "@/lib/status-tone";
import { Icon } from "./icon";

/**
 * Estados vacios, de carga y de error.
 *
 * Antes: 25 bloques `border-dashed` cada uno con su markup y su copy, ningun
 * spinner en toda la app (el loading era cambiarle el texto al boton), y 26
 * banners de error escritos a mano.
 */

export function Spinner({ className, label = "Cargando" }: { className?: string; label?: string }) {
  return (
    <Icon
      aria-label={label}
      className={cn("animate-spin text-ink-faint", className)}
      icon={faSpinnerThird}
      role="status"
    />
  );
}

/** Bloque gris que ocupa el lugar del contenido mientras carga. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-control bg-paper-raised", className)} />;
}

/**
 * Pantalla vacia.
 *
 * Una pantalla vacia es una invitacion a hacer algo, no un cartel de error: por
 * eso acepta una accion y el texto describe el proximo paso.
 */
export function EmptyState({
  action,
  description,
  icon,
  title
}: {
  action?: ReactNode;
  description?: ReactNode;
  icon?: IconDefinition;
  title: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line-strong bg-paper px-6 py-10 text-center">
      {icon ? <Icon aria-hidden className="text-2xl text-ink-faint" icon={icon} /> : null}
      <p className="text-title text-ink">{title}</p>
      {description ? <p className="max-w-md text-body text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * Aviso dentro del flujo: error de formulario, advertencia, confirmacion.
 *
 * Los errores no piden disculpas y no son vagos: dicen que paso y como se
 * arregla. El `role="alert"` hace que un lector de pantalla lo anuncie apenas
 * aparece, en vez de que el usuario descubra el error al tabular.
 */
export function Notice({
  children,
  className,
  tone = "danger"
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <p
      className={cn("rounded-control border px-3 py-2 text-body", TONE_CLASS[tone], className)}
      role={tone === "danger" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
