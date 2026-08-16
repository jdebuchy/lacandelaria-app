import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faSpinnerThird } from "@fortawesome/pro-regular-svg-icons";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

/**
 * El boton de la app.
 *
 * Antes habia 75 strings de clase distintos cumpliendo esta funcion, de los
 * cuales 57 aparecian una sola vez, repartidos en 181 elementos accionables.
 * Seis alturas para lo que en realidad son tres tamaños.
 *
 * El tamaño "touch" existe para /reparto: 56px de alto es lo que necesita un
 * pulgar sobre un pozo, y no es negociable por estetica.
 */
const button = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-control font-medium",
    "transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-50"
  ],
  {
    defaultVariants: {
      size: "md",
      variant: "secondary"
    },
    variants: {
      size: {
        sm: "h-8 px-3 text-label",
        md: "h-10 px-4 text-body",
        lg: "h-12 px-5 text-body",
        // Se maneja con el pulgar, en movimiento y con una sola mano.
        touch: "h-14 w-full px-5 text-[1.0625rem] font-semibold"
      },
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-accent-strong",
        secondary: "border border-line-strong bg-paper text-ink hover:bg-paper-raised",
        ghost: "text-ink-soft hover:bg-paper-raised hover:text-ink",
        danger: "border border-danger-line bg-danger-bg text-danger-fg hover:border-danger-fg",
        // Maximo contraste, para la accion irreversible que cierra un flujo.
        inverted: "bg-ink text-paper hover:opacity-90"
      }
    }
  }
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    /** Icono a la izquierda. Durante `loading` lo reemplaza el spinner. */
    icon?: IconDefinition;
    /** Icono a la derecha, para acciones que avanzan. */
    iconAfter?: IconDefinition;
    loading?: boolean;
  };

export function Button({
  children,
  className,
  disabled,
  icon,
  iconAfter,
  loading = false,
  size,
  type = "button",
  variant,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(button({ size, variant }), className)}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? (
        <Icon aria-hidden className="animate-spin" icon={faSpinnerThird} />
      ) : icon ? (
        <Icon aria-hidden icon={icon} />
      ) : null}
      {children}
      {iconAfter && !loading ? <Icon aria-hidden icon={iconAfter} /> : null}
    </button>
  );
}

/**
 * Boton de solo icono. Siempre cuadrado y siempre con etiqueta accesible: sin
 * texto visible, `label` es lo unico que tiene un lector de pantalla.
 */
type IconButtonProps = Omit<ButtonProps, "children" | "iconAfter" | "icon"> & {
  icon: IconDefinition;
  label: string;
};

export function IconButton({ className, icon, label, size = "md", ...props }: IconButtonProps) {
  const square = {
    sm: "h-8 w-8 p-0",
    md: "h-10 w-10 p-0",
    lg: "h-12 w-12 p-0",
    touch: "h-14 w-14 p-0"
  }[size ?? "md"];

  return (
    <Button aria-label={label} className={cn(square, className)} size={size} title={label} {...props}>
      <Icon aria-hidden icon={icon} />
    </Button>
  );
}

/**
 * Un link que se ve como boton.
 *
 * Existe porque `<Link><Button/></Link>` produce un <button> dentro de un <a>,
 * que es HTML invalido: el navegador no sabe cual de los dos recibe el click y
 * los lectores de pantalla anuncian dos controles donde hay uno.
 */
type ButtonLinkProps = ComponentProps<typeof Link> &
  VariantProps<typeof button> & {
    icon?: IconDefinition;
    iconAfter?: IconDefinition;
  };

export function ButtonLink({
  children,
  className,
  icon,
  iconAfter,
  size,
  variant,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(button({ size, variant }), className)} {...props}>
      {icon ? <Icon aria-hidden icon={icon} /> : null}
      {children}
      {iconAfter ? <Icon aria-hidden icon={iconAfter} /> : null}
    </Link>
  );
}

export { button as buttonVariants };
