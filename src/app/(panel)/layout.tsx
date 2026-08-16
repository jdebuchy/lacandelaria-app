import { PanelNav } from "@/components/panel-nav";
import { requirePageRegistration } from "@/lib/auth";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requirePageRegistration("/panel");

  return (
    <div className="min-h-screen bg-paper-muted text-ink lg:flex">
      <PanelNav role={profile.role} userEmail={profile.email} userName={profile.full_name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
