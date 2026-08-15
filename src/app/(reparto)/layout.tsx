import { requirePageRole } from "@/lib/auth";
import { DRIVER_ALLOWED_ROLES } from "@/lib/auth-shared";

export default async function RepartoLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(DRIVER_ALLOWED_ROLES, "/reparto");

  return (
    <div
      className="min-h-dvh bg-stone-950 text-stone-100"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)"
      }}
    >
      {children}
    </div>
  );
}
