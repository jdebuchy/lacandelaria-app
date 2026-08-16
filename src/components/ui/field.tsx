import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Campos de formulario.
 *
 * Antes: `grid gap-2 text-sm text-stone-300` escrito literal 42 veces, mas
 * `grid gap-1 text-xs text-stone-400` otras 14, y cinco variantes del mismo
 * input que diferian solo en si el foco era emerald o sky y en si tenian
 * transition. Aca hay un solo input y un solo anillo de foco.
 */

const controlBase = [
  "w-full rounded-control border bg-paper text-ink",
  "placeholder:text-ink-faint",
  "transition-colors duration-150",
  "focus:border-accent focus:outline-hidden",
  "disabled:cursor-not-allowed disabled:opacity-60"
].join(" ");

const controlSize = {
  md: "h-10 px-3 text-body",
  // /reparto: dedo gordo, celular en la mano, camioneta en movimiento.
  touch: "h-14 px-4 text-base"
};

type Size = keyof typeof controlSize;

function borderFor(invalid?: boolean) {
  return invalid ? "border-danger-fg" : "border-line-strong";
}

/**
 * Envoltorio de campo: etiqueta, control, ayuda y error.
 *
 * Conecta label, descripcion y error con el control por id, asi que un lector
 * de pantalla anuncia el error junto con el campo en vez de dejarlo suelto.
 */
export function Field({
  children,
  className,
  error,
  hint,
  label,
  required
}: {
  children: (props: { "aria-describedby"?: string; "aria-invalid"?: boolean; id: string }) => ReactNode;
  className?: string;
  error?: string | null;
  hint?: ReactNode;
  label: ReactNode;
  required?: boolean;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-label text-ink-soft" htmlFor={id}>
        {label}
        {required ? <span className="text-danger-fg"> *</span> : null}
      </label>
      {children({ "aria-describedby": describedBy, "aria-invalid": Boolean(error), id })}
      {hint && !error ? (
        <p className="text-meta text-ink-faint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-meta text-danger-fg" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; inputSize?: Size };

export function Input({ className, inputSize = "md", invalid, ...props }: InputProps) {
  return (
    <input
      className={cn(controlBase, controlSize[inputSize], borderFor(invalid), className)}
      {...props}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; selectSize?: Size };

export function Select({ className, invalid, selectSize = "md", ...props }: SelectProps) {
  return (
    <select
      className={cn(controlBase, controlSize[selectSize], borderFor(invalid), "pr-8", className)}
      {...props}
    />
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export function Textarea({ className, invalid, rows = 3, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(controlBase, "px-3 py-2 text-body", borderFor(invalid), className)}
      rows={rows}
      {...props}
    />
  );
}
