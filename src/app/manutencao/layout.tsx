import { getCurrentProfile } from "@/lib/actions/session";
import { AppSidebar } from "@/components/shared/app-sidebar";

export default async function ManutencaoLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-background">
      <AppSidebar role={profile.role === "admin" ? "admin" : "manutencao"} userName={profile.name} />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl">{children}</main>
    </div>
  );
}
