import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { UsersTable } from "./users-table";
import { UserFormDialog } from "./user-form-dialog";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .in("role", ["camareira", "manutencao", "gerente_operacional"])
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        subtitle="Cadastre camareiras, funcionários de manutenção e gerentes operacionais, e gerencie o acesso ao sistema."
        action={<UserFormDialog />}
      />
      <UsersTable users={(users ?? []) as Profile[]} />
    </div>
  );
}
