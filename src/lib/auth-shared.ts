import type { UserRole } from "@/lib/types";

export const PANEL_ALLOWED_ROLES: readonly UserRole[] = ["admin", "seller", "collector"];
export const COLLECTION_ALLOWED_ROLES: readonly UserRole[] = ["admin", "collector"];
export const DRIVER_ALLOWED_ROLES: readonly UserRole[] = ["admin", "driver"];
export const REPORTS_ALLOWED_ROLES: readonly UserRole[] = ["admin", "seller", "collector"];
export const REPORTS_COLLECTION_ALLOWED_ROLES: readonly UserRole[] = ["admin", "collector"];

export function sanitizeRedirectPath(candidate?: string | null) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/panel";
  }

  return candidate;
}

export function getRoleLabel(role: UserRole) {
  switch (role) {
    case "admin":
      return "Admin";
    case "seller":
      return "Ventas";
    case "driver":
      return "Reparto";
    case "collector":
      return "Cobranza";
    default:
      return role;
  }
}
