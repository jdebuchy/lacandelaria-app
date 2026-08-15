import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Tabla de listado.
 *
 * El problema que resuelve: la app tenia tres tecnicas de tabla conviviendo
 * (table nativo, grids de div con grid-cols arbitrarios, y listas de article),
 * y los listados grandes renderizaban el dataset *dos veces*, una para
 * escritorio con `hidden lg:block` y otra para telefono con `lg:hidden`. En
 * Pedidos eso eran ~120 lineas duplicadas que se desincronizaban sola vez que
 * alguien tocaba una y se olvidaba de la otra.
 *
 * Aca las columnas se declaran una vez y el componente decide como mostrarlas:
 * grilla en escritorio, card en telefono.
 */
export type Column<T> = {
  /** Contenido de la celda. */
  cell: (row: T) => ReactNode;
  /** Encabezado de columna. En telefono se usa como etiqueta del par. */
  header: ReactNode;
  /** Alineacion. Los numeros van a la derecha para que aliñen. */
  align?: "left" | "right";
  key: string;
  /**
   * En telefono, esta columna es el titulo de la card en vez de un par
   * etiqueta/valor. Marca exactamente una por tabla.
   */
  primary?: boolean;
  /** Se omite en telefono. Para datos de relleno que no entran. */
  hideOnMobile?: boolean;
  /** Ancho en la grilla de escritorio. Default: 1fr. */
  width?: string;
};

type DataTableProps<T> = {
  columns: Array<Column<T>>;
  empty?: ReactNode;
  getKey: (row: T) => string;
  /** Si esta, la fila entera es un link. */
  href?: (row: T) => string;
  rows: T[];
};

export function DataTable<T>({ columns, empty, getKey, href, rows }: DataTableProps<T>) {
  if (rows.length === 0) {
    return empty ? <>{empty}</> : null;
  }

  const gridTemplate = columns.map((column) => column.width ?? "1fr").join(" ");
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const secondary = columns.filter((column) => column !== primary && !column.hideOnMobile);

  return (
    <div className="overflow-hidden rounded-card border border-line bg-paper">
      {/* Escritorio */}
      <div className="hidden lg:block">
        <div
          className="grid gap-3 border-b border-line px-4 py-2.5 text-label text-ink-faint"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {columns.map((column) => (
            <div className={cn(column.align === "right" && "text-right")} key={column.key}>
              {column.header}
            </div>
          ))}
        </div>

        {rows.map((row) => {
          const cells = (
            <div
              className="grid items-center gap-3 px-4 text-body"
              style={{ gridTemplateColumns: gridTemplate, minHeight: "var(--spacing-row)" }}
            >
              {columns.map((column) => (
                <div
                  className={cn("min-w-0 py-2", column.align === "right" && "text-right")}
                  key={column.key}
                >
                  {column.cell(row)}
                </div>
              ))}
            </div>
          );

          return href ? (
            <Link
              className="block border-t border-line transition-colors first:border-t-0 hover:bg-paper-raised"
              href={href(row)}
              key={getKey(row)}
            >
              {cells}
            </Link>
          ) : (
            <div className="border-t border-line first:border-t-0" key={getKey(row)}>
              {cells}
            </div>
          );
        })}
      </div>

      {/* Telefono */}
      <div className="lg:hidden">
        {rows.map((row) => {
          const card = (
            <div className="flex flex-col gap-2 px-4 py-3">
              <div className="text-body">{primary.cell(row)}</div>
              {secondary.length > 0 ? (
                <dl className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {secondary.map((column) => (
                    <div className="flex min-w-0 items-baseline gap-1.5" key={column.key}>
                      <dt className="text-meta text-ink-faint">{column.header}</dt>
                      <dd className="min-w-0 text-body text-ink">{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          );

          return href ? (
            <Link
              className="block border-t border-line transition-colors first:border-t-0 active:bg-paper-raised"
              href={href(row)}
              key={getKey(row)}
            >
              {card}
            </Link>
          ) : (
            <div className="border-t border-line first:border-t-0" key={getKey(row)}>
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Paginacion por links, para que funcione sin JavaScript y el navegador pueda
 * precargar la pagina siguiente.
 */
export function Pagination({
  buildHref,
  page,
  totalPages
}: {
  buildHref: (page: number) => string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const linkClass =
    "inline-flex h-9 items-center rounded-control border border-line-strong px-3 text-body text-ink transition-colors hover:bg-paper-raised";
  const disabledClass = "pointer-events-none opacity-40";

  return (
    <nav aria-label="Paginacion" className="flex items-center justify-between gap-3">
      <Link
        aria-disabled={page <= 1}
        className={cn(linkClass, page <= 1 && disabledClass)}
        href={buildHref(page - 1)}
      >
        Anterior
      </Link>
      <span className="text-meta text-ink-soft" data-numeric>
        Pagina {page} de {totalPages}
      </span>
      <Link
        aria-disabled={page >= totalPages}
        className={cn(linkClass, page >= totalPages && disabledClass)}
        href={buildHref(page + 1)}
      >
        Siguiente
      </Link>
    </nav>
  );
}
