import { PanelNav } from "@/components/panel-nav";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <PanelNav />
      {children}
    </div>
  );
}
