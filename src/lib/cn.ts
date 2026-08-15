import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Une clases resolviendo los conflictos de Tailwind: la ultima gana.
 *
 * Sin esto, `cn("px-4", props.className)` con un className de "px-6" deja las
 * dos y el resultado depende del orden en la hoja compilada. Es el bug que
 * aparecia con los template literals que se usaban antes.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
