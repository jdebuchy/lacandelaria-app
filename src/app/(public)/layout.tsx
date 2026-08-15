import { PublicNav } from "@/components/public-nav";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper-muted text-ink">
      <PublicNav />
      {children}
    </div>
  );
}
