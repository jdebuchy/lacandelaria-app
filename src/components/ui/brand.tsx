import { cn } from "@/lib/cn";

/**
 * La marca.
 *
 * El dibujo ya existia en src/app/icon.svg, donde se usa como favicon y como
 * icono de la PWA, pero la interfaz no lo usaba en ningun lado: el sidebar
 * mostraba un cuadrado que decia "LC". Habia identidad disponible y sin
 * estrenar.
 *
 * Los verdes originales (#14532d de fondo, #d9f99d de pulpa, #3f6212 de
 * carozo) no eran ninguno del sistema. Ahora salen de los tokens, con lo que
 * se cierra el problema de tres familias de verde conviviendo: el emerald de
 * la UI, el green del manifest y el lime del icono.
 *
 * Donde aparece: sidebar, login, /reparto y estados vacios. O sea el chrome y
 * los umbrales, nunca los datos. En una tabla la marca compite con la
 * informacion; en el borde de la pantalla, acompaña.
 */

/**
 * Los colores de la marca no son tokens: son fijos en los dos temas.
 *
 * Un logo no se re-tinta con el tema, igual que no se re-tinta una etiqueta
 * impresa. Ademas, atarlo a los tokens lo rompia: en oscuro `accent` se aclara
 * a #7fb98c y quedaba verde claro contra la pulpa amarillenta, sin contraste.
 *
 * Coinciden con la paleta Campo en claro, que es donde se definieron.
 */
const BRAND = {
  ground: "#2e5d3c",
  flesh: "#c6d06b",
  pit: "#234a2f"
} as const;

export function PaltaMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("h-full w-full", className)}
      role="presentation"
      viewBox="0 0 512 512"
    >
      <path
        d="M256 88c44 0 74 42 82 98 10 64 34 100 34 136 0 58-52 102-116 102s-116-44-116-102c0-36 24-72 34-136 8-56 38-98 82-98z"
        fill={BRAND.flesh}
      />
      <circle cx="256" cy="322" fill={BRAND.pit} r="58" />
    </svg>
  );
}

/**
 * La palta dentro de su cuadrado, para cuando necesita fondo propio: sidebar,
 * avatar de la app, header de /reparto.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-control p-1", className)}
      style={{ backgroundColor: BRAND.ground }}
    >
      <PaltaMark />
    </span>
  );
}

/**
 * Silueta suelta, sin fondo, para los estados vacios. Es un momento de respiro
 * en la pantalla, asi que la marca puede aparecer en grande y en voz baja.
 */
export function BrandGlyph({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("block opacity-40", className)}>
      <PaltaMark />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("truncate font-semibold tracking-tight text-ink", className)}>
      La Candelaria
    </span>
  );
}
