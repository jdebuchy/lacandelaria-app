import { InternalUsersManager } from "@/components/internal-users-manager";
import { requirePageRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

const ADMIN_ONLY: readonly UserRole[] = ["admin"];

export default async function UsersPage() {
  await requirePageRole(ADMIN_ONLY, "/panel/users");
  const supabase = createAdminClient();
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, active, auth_user_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("profiles fetch failed", error);
  }

  return (
    <main>
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-200">
            Usuarios internos
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
            Alta de usuarios y repartidores
          </h1>
          <p className="max-w-3xl text-base leading-7 text-stone-300">
            Desde aquí puedes crear perfiles internos para reparto, ventas, cobranza o administración.
            Los mails ficticios sirven para asignación interna; solo los mails reales podrán iniciar sesión
            con Google.
          </p>
        </div>

        <InternalUsersManager users={users ?? []} />
      </section>
    </main>
  );
}
