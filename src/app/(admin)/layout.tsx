import { getCurrentProfile } from "@/lib/actions/session";
import { AppSidebar } from "@/components/shared/app-sidebar";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") redirect("/tarefas");

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-background">
      <AppSidebar role="admin" userName={profile.name} />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl">{children}</main>
    </div>
  );
}
