import { PanelNav } from "@/components/panel-nav";
import { requirePageRegistration } from "@/lib/auth";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requirePageRegistration("/panel");

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <PanelNav
        role={profile.role}
        userEmail={profile.email}
        userName={profile.full_name}
      />
      {children}
    </div>
  );
}
